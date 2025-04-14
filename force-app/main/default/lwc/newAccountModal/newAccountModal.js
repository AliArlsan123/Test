import { api, LightningElement, track, wire } from "lwc";
import CONTACT_OBJECT from "@salesforce/schema/Contact";
import EMAIL_FIELD from "@salesforce/schema/Contact.Email";
import ACCOUNT_NAME_FIELD from "@salesforce/schema/Contact.AccountId";
import ROLES_FIELD from "@salesforce/schema/AccountContactRelation.Roles";
import PORTAL_PERMISSION_FIELD from "@salesforce/schema/Contact.Portal_Permission__c";
import STREET_FIELD from "@salesforce/schema/Contact.MailingStreet";
import CITY_FIELD from "@salesforce/schema/Contact.MailingCity";
import STATE_FIELD from "@salesforce/schema/Contact.MailingState";
import POSTAL_CODE_FIELD from "@salesforce/schema/Contact.MailingPostalCode";
import COUNTRY_FIELD from "@salesforce/schema/Contact.MailingCountry";
import APARTMENT_FIELD from "@salesforce/schema/Contact.Mailing_Street_2__c";
import IS_PO_BOX_FIELD from "@salesforce/schema/Contact.Is_PO_Box__c";
import STEP_FIELD from "@salesforce/schema/Contact.Step__c";
import putContactRecords from "@salesforce/apex/MyAccountPageController.putContactRecords";
import checkEmailValidity from "@salesforce/apex/MyAccountPageController.checkEmailValidity";
import getRelatedContacts from "@salesforce/apex/GuidedContactCreationController.getRelatedContacts";
import createContact from "@salesforce/apex/GuidedContactCreationController.createContact";
import getFieldsFromContactFieldSets from "@salesforce/apex/MyAccountPageController.getFieldsFromContactFieldSets";
import getContactAndRelatedAccounts from "@salesforce/apex/MyAccountPageController.getContactAndRelatedAccounts";
import getAccountName from "@salesforce/apex/MyAccountPageController.getAccountName";
import isCommunityExist from "@salesforce/apex/GuidedContactCreationController.isCommunityExist";
import getCommunityUserContactId from "@salesforce/apex/MyAccountPageController.getCommunityUserContactId";
import STYLES from "@salesforce/resourceUrl/SelfServiceCenterPortal_ReloadStyles";
import USER_ID from "@salesforce/user/Id";
import USER_ROLE_ID from "@salesforce/schema/User.UserRole.Id";
import { getRecord, getRecordNotifyChange } from "lightning/uiRecordApi";
import { getObjectInfo, getPicklistValues } from "lightning/uiObjectInfoApi";
import { CloseActionScreenEvent } from "lightning/actions";
import { CurrentPageReference, NavigationMixin } from "lightning/navigation";
import { loadStyle } from "lightning/platformResourceLoader";
import { composeImportedPicklistValues, handleToastEvent } from "c/lwcUtils";

export default class NewAccountModal extends NavigationMixin(LightningElement) {
  isCurrentUserHasARole = true;

  _recordId;
  _objectApiName;

  @api set objectApiName(value) {
    this._objectApiName = value;
    if (this._recordId && this._objectApiName === "Contact") {
      this.getEditData(this._recordId);
      this.getAccountName(this._recordId);
    }
  }

  get objectApiName() {
    return this._objectApiName;
  }
  @api set recordId(value) {
    this._recordId = value;

    if (this._recordId && this._objectApiName === "Contact") {
      this.getEditData(this._recordId);
      this.getAccountName(this._recordId);
    }

    if (!this.isCurrentUserHasARole) {
      handleToastEvent(
        this,
        "In order to run the guided Wizard you must have a Role assigned to you. Please, contact an Administrator for role assignment",
        "error"
      );
      this.dispatchEvent(new CloseActionScreenEvent());
    }
  }

  get recordId() {
    return this._recordId;
  }

  _accountId;

  @api set accountId(value) {
    this._accountId = value;

    if (this.accountId) {
      this.notCommunityLabel = "New Contact";
      this.isNewAccountWizard = true;
      this.recordId = this._accountId;
      this.getAccountName(this._accountId);
    }
  }

  get accountId() {
    return this._accountId;
  }

  @api accountName;

  @api relatedAccounts;
  @api relatedContacts;
  @api parentAccount;

  @api isNewAccountWizard = false;
  @api isEditAccountWizard = false;

  @api editContactData;

  @api isOpenFromBillingPage;
  @api isPrimaryContact;
  @api isBillingContact;

  @api isAccountTaxExemption = false;
  @api isOpenTaxExemption = false;
  @api parentAccountIdTaxExemption;

  modalWizardClass = "slds-modal slds-fade-in-open slds-backdrop";

  objectApiName = "Contact";
  stepsArray = [
    { value: "1", stepName: "User Information", active: true },
    { value: "2", stepName: "Contact Information", active: false },
    { value: "3", stepName: "Communication", active: false },
    { value: "4", stepName: "Account & Permissions", active: false },
    { value: "5", stepName: "Address Information", active: false },
  ];
  relatedContactsClass =
    "slds-combobox slds-dropdown-trigger slds-dropdown-trigger_click";
  @track fieldsArray;
  currentStep = "1";
  notCommunityLabel = "New Contact";

  showLoading = false;
  isOpenCustomAlert = false;

  isCommunity = true;
  isPageLayout = false;
  isAppTab = false;
  showAlert = false;
  @track addressToAlert;
  @track addressToReturn;
  apartStr = "";

  @track relatedAccountPicklist;
  @track rolesPicklist = [];
  isOpenCombobox = false;

  @track changeComm = false;
  @track isValid = false;

  isPOBox = false;

  strStreet;
  strCity;
  strCountry;
  strState;
  strPostalCode;

  strStreetPOBox;
  strCityPOBox;
  strCountryPOBox;
  strStatePOBox;
  strPostalCodePOBox;

  @track accountRole = [];
  @track accountRoleObj = [];
  valueAcc = "";
  @track rolePicklist = [];

  @track showDraftButton;
  @track relatedContactList;
  @track isOver;
  @track isEnableList = true;
  @track clearReportsToContactIconFlag = false;
  @track inputRelatedContactReadOnly = false;
  @track selectedReportsToContact;
  @track loadingText = false;
  @track messageFlag = false;

  @track selectedRole = [];

  @track relatedContactsNotCommunity = [];

  @track userInformationFields = [];
  @track contactInformationFields = [];
  @track communicationFields = [];

  @track isDisableButton = true;

  isGuidedEditAccountWizard = false;

  codeKey;

  isCommunityExistAndActive = false;

  currentCommunityContactId = "";

  @wire(CurrentPageReference)
  getPageReferenceParameters(currentPageReference) {
    if (currentPageReference.type === "standard__quickAction") {
      this.isCommunity = false;
      this.isPageLayout = true;
      this.modalWizardClass = "slds-modal slds-fade-in-open";
      if (currentPageReference.attributes.apiName.includes("Contact.")) {
        this.isGuidedEditAccountWizard = true;
        this.notCommunityLabel = "Edit Contact";
        this.getEditData(currentPageReference.state.recordId);
      } else if (currentPageReference.attributes.apiName.includes("Account.")) {
        this.notCommunityLabel = "New Contact";
        this.isNewAccountWizard = true;
        this.recordId = currentPageReference.state.recordId;
        this.accountId = currentPageReference.state.recordId;
        this.getAccountName(currentPageReference.state.recordId);
      }
    } else if (
      currentPageReference.attributes.hasOwnProperty("componentName") &&
      currentPageReference.attributes.componentName.includes(
        "guidedAccountCreation"
      )
    ) {
      this.isCommunity = false;
      this.accountId = this.recordId;
      this.getAccountName(this.recordId);
    } else if (
      currentPageReference.attributes.hasOwnProperty("componentName") &&
      currentPageReference.attributes.componentName.includes(
        "guidedContactCreation"
      )
    ) {
      this.isCommunity = false;
    } else if (currentPageReference.type !== "comm__namedPage") {
      this.isCommunity = false;
    }
  }

  @wire(getRecord, { recordId: USER_ID, fields: [USER_ROLE_ID] })
  userDetails({ error, data }) {
    if (error) {
      console.log("get record portal");
      // handleToastEvent(this, error, "error");
    } else if (data) {
      this.isCurrentUserHasARole = data.fields.UserRole.value !== null;

      if (!this.isCurrentUserHasARole && !this.isCommunity) {
        handleToastEvent(
          this,
          "In order to run the guided Wizard you must have a Role assigned to you. Please, contact an Administrator for role assignment",
          "error"
        );
        this.dispatchEvent(new CloseActionScreenEvent());
      }
    }
  }

  getAccountName(accountId) {
    getAccountName({ accountId: accountId })
      .then((result) => {
        this.accountName = result;
        this.getCurrentRelatedContacts().then((r) => { });
        this.initializeFieldsArray();
      })
      .catch((error) => {
        this.error = error;
      });
  }

  @wire(getObjectInfo, { objectApiName: CONTACT_OBJECT })
  objectInfo;

  @wire(getPicklistValues, {
    recordTypeId: "$objectInfo.data.defaultRecordTypeId",
    fieldApiName: PORTAL_PERMISSION_FIELD,
  })
  portalPermissionPicklist2({ error, data }) {
    if (data) {
      this.portalPermissionPicklist = composeImportedPicklistValues(data);
      this.initializeFieldsArray();
    } else if (error) {
      handleToastEvent(this, error, "error");
    }
  }

  @wire(getPicklistValues, {
    recordTypeId: "$objectInfo.data.defaultRecordTypeId",
    fieldApiName: ROLES_FIELD,
  })
  rolesPicklistValues({ error, data }) {
    if (data) {
      this.rolesPicklist = [...data.values];
      if (this.isOpenFromBillingPage) {
        if (this.isPrimaryContact) {
          this.selectedRole = ["Primary Contact"];
        }
        if (this.isBillingContact) {
          this.selectedRole = ["Billing Contact"];
        }
      }
      this.initializeFieldsArray();
    } else if (error) {
      handleToastEvent(this, error, "error");
    }
  }

  @wire(getFieldsFromContactFieldSets)
  contactFields({ error, data }) {
    if (data) {
      let contactFieldsData = JSON.parse(data);
      this.communicationFields = contactFieldsData["ContactCommInfo"];
      this.contactInformationFields = contactFieldsData["ContactContactInfo"];
      this.userInformationFields = contactFieldsData["ContactUserInfo"];

      // Added Dmitry Bibikov
      if (this.communicationFields) {
        this.communicationFields.forEach((item) => {
          if (item.picklist) {
            item.options.unshift({ label: "--None--", value: "" });
          }
        });
      }
      //Added Dmitry Bibikov
      this.initializeFieldsArray();
    } else if (error) {
      handleToastEvent(this, error, "error");
    }
  }

  async connectedCallback() {
    try {
      this.checkCommunity();
      this.isCommunityExistAndActive = await this.isCommunityExist();
      this.currentCommunityContactId = await this.getCommunityUserContactId();
      this.getDataForCommunity();
      const relatedContacts = await this.getCurrentRelatedContacts();

      if (relatedContacts !== "There are no related Contacts") {
        this.relatedContacts = JSON.parse(relatedContacts);
        this.initializeFieldsArray();
      }
    } catch (error) {
     // handleToastEvent(this, error, "error");
    }
  }

  checkCommunity() {
    if (this.isAppTab) {
      this.isCommunity = false;
      this.isNewAccountWizard = true;
      this.notCommunityLabel = "New Contact";
    }
  }

  isCommunityExist() {
    return isCommunityExist();
  }

  getCommunityUserContactId() {
    return getCommunityUserContactId();
  }

  getEditData(recordId) {
    getContactAndRelatedAccounts({ contactId: recordId })
      .then((result) => {
        const contactDataParse = JSON.parse(result);
        if (contactDataParse.length) {
          this.editGuidedContactData = contactDataParse;
          this.accountId = contactDataParse[0].AccountId;
          this.accountName = contactDataParse[0].Account.Name;
          this.isGuidedEditAccountModal = true;
          this.isGuidedEditAccountWizard = true;
          this.notCommunityLabel = "Edit Contact";
          this.getCurrentRelatedContacts().then((r) => { });
        }
      })
      .catch((error) => {
        this.error = error;
        handleToastEvent(this, error, "error");
      });
  }

  getDataForCommunity() {
    if (this.isCommunity) {
      this.relatedAccountPicklist = [
        ...JSON.parse(JSON.stringify(this.relatedAccounts)),
      ];
      this.relatedContactList = [...this.relatedContacts];
      if (!this.fieldsArray) {
        this.initializeFieldsArray();
      }
    }
  }

  renderedCallback() {
    Promise.all([loadStyle(this, STYLES + "/styles/NewAccountWizardQA.css")]);

    this.template.addEventListener("click", (event) => {
      let e = this.template.querySelector(`[data-open="true"]`);
      if (e && !e.contains(event.target)) {
        this.isOpenCombobox = false;
      }
    });
  }

  getCurrentRelatedContacts() {
    return getRelatedContacts({ accountId: this.accountId });
  }

  initializeFieldsArray() {
    if (
      this.portalPermissionPicklist &&
      this.rolesPicklist &&
      this.communicationFields &&
      this.contactInformationFields &&
      this.userInformationFields
    ) {
      if (!this.isCommunity && this.accountName) {
        this.fieldsArray = [
          {
            value: "1",
            stepName: "User Information",
            isCurrentStep: true,
            isValidFields: false,
            fields: this.userInformationFields,
          },
          {
            value: "2",
            stepName: "Contact Information",
            isCurrentStep: false,
            isValidFields: false,
            fields: this.contactInformationFields,
          },
          {
            value: "3",
            stepName: "Communication",
            isCurrentStep: false,
            isValidFields: true,
            fields: this.communicationFields,
          },
          {
            value: "4",
            stepName: "Account & Permissions",
            isCurrentStep: false,
            isValidFields: !this.isCommunityExistAndActive,
            fields: [
              {
                name: ACCOUNT_NAME_FIELD.fieldApiName,
                value: this.accountName,
                multipicklist: false,
                isTypeInput: true,
                input: false,
                inputDisabled: true,
                label: "Account Name",
                required: true,
                custom: true, //Added for Custom MultiPiklist
              },
              {
                name: PORTAL_PERMISSION_FIELD.fieldApiName,
                value: "",
                // defaultValue: 'Not Required',
                picklist: true,
                input: false,
                options: this.portalPermissionPicklist,
                label: "Portal Permission",
                required: true,
                isPortalPermission: true,
              },
              {
                name: ROLES_FIELD.fieldApiName,
                value: [],
                // defaultValue: 'Not Required',
                multipicklist: true,
                isTypeInput: false,
                input: false,
                options: this.rolesPicklist,
                requiredOption: this.selectedRole,
                label: "Role",
                required: false,
              },
            ],
          },
          {
            value: "5",
            isCurrentStep: false,
            stepName: "Address Information",
            isValidFields: true,
            isAddress: true,
            fields: [
              { name: STREET_FIELD.fieldApiName, value: "", required: true },
              { name: CITY_FIELD.fieldApiName, value: "", required: true },
              { name: STATE_FIELD.fieldApiName, value: "", required: true },
              {
                name: POSTAL_CODE_FIELD.fieldApiName,
                value: "",
                required: true,
              },
              { name: COUNTRY_FIELD.fieldApiName, value: "", required: true },
            ],
          },
        ];

        if (this.isGuidedEditAccountModal) {
          this.putDataToFields(this.editGuidedContactData);
        }
      } else if (
        this.isCommunity &&
        this.parentAccount &&
        this.relatedAccountPicklist
      ) {
        this.fieldsArray = [
          {
            value: "1",
            stepName: "User Information",
            isCurrentStep: true,
            isValidFields: false,
            fields: this.userInformationFields,
          },
          {
            value: "2",
            stepName: "Contact Information",
            isCurrentStep: false,
            isValidFields: false,
            fields: this.contactInformationFields,
          },
          {
            value: "3",
            stepName: "Communication",
            isCurrentStep: false,
            isValidFields: true,
            fields: this.communicationFields,
          },
          {
            value: "4",
            stepName: "Account & Permissions",
            isCurrentStep: false,
            isValidFields: !this.isCommunityExistAndActive,
            fields: [
              {
                name: ACCOUNT_NAME_FIELD.fieldApiName,
                value: this.parentAccount.value,
                multipicklist: true,
                isTypeInput: true,
                input: false,
                options: this.relatedAccountPicklist,
                label: "Account Name",
                required: true,
                custom: true, //Added for Custom MultiPiklist
              },
              {
                name: PORTAL_PERMISSION_FIELD.fieldApiName,
                value: "",
                // defaultValue: 'Not Required',
                picklist: true,
                input: false,
                options: this.portalPermissionPicklist,
                label: "Portal Permission",
                required: true,
                isPortalPermission: true,
              },
              {
                name: ROLES_FIELD.fieldApiName,
                value: [],
                // defaultValue: 'Not Required',
                multipicklist: true,
                isTypeInput: false,
                input: false,
                options: this.rolesPicklist,
                requiredOption: this.selectedRole,
                label: "Role",
                required: false,
              },
            ],
          },
          {
            value: "5",
            isCurrentStep: false,
            stepName: "Address Information",
            isValidFields: true,
            isAddress: true,
            fields: [
              { name: STREET_FIELD.fieldApiName, value: "", required: true },
              { name: CITY_FIELD.fieldApiName, value: "", required: true },
              { name: STATE_FIELD.fieldApiName, value: "", required: true },
              {
                name: POSTAL_CODE_FIELD.fieldApiName,
                value: "",
                required: true,
              },
              { name: COUNTRY_FIELD.fieldApiName, value: "", required: true },
            ],
          },
        ];
        if (this.isEditAccountWizard) {
          this.putDataToFields(this.editContactData);
        }
      }
    }
    this.showLoading = false;
  }

  handleNextStep() {
    let currentPageStep = Number(this.currentStep);
    if (currentPageStep == 4) {
      let address = this.fieldsArray[4].fields;
      this.isDisableButton = true;
      if (this.isPOBox) {
        if (
          this.strStreetPOBox &&
          this.strCityPOBox &&
          this.strStatePOBox &&
          this.strPostalCodePOBox
        ) {
          this.isDisableButton = this.validateAddress(
            this.strStreetPOBox,
            this.strCityPOBox,
            this.strStatePOBox,
            this.strPostalCodePOBox
          );
        }
      } else {
        if (
          address.find((item) => item.name == "MailingStreet").value &&
          address.find((item) => item.name == "MailingCity").value &&
          address.find((item) => item.name == "MailingState").value &&
          address.find((item) => item.name == "MailingPostalCode").value
        ) {
          this.isDisableButton = this.validateAddress(
            address.find((item) => item.name == "MailingStreet").value,
            address.find((item) => item.name == "MailingCity").value,
            address.find((item) => item.name == "MailingState").value,
            address.find((item) => item.name == "MailingPostalCode").value
          );
        }
      }
    }

    if (currentPageStep != 1 && currentPageStep != 4) {
      this.isDisableButton = true;
      this.changeComm = false;
    }
    if (currentPageStep == 1) {
      const mobile = this.fieldsArray[1].fields.find(
        (item) => item.name == "MobilePhone"
      )?.required;
      const home = this.fieldsArray[1].fields.find(
        (item) => item.name == "HomePhone"
      )?.required;
      const work = this.fieldsArray[1].fields.find(
        (item) => item.name == "Work_Phone__c"
      )?.required;
      if (mobile || home || work) {
        if (mobile) {
          let value = this.fieldsArray[1].fields
            .find((item) => item.name == "MobilePhone")
            .value.toString();
          this.changeComm = value.length === 10 ? false : true;
          this.isDisableButton = this.changeComm;
        }
        if (home) {
          let value = this.fieldsArray[1].fields
            .find((item) => item.name == "HomePhone")
            .value.toString();
          this.changeComm = value.length === 10 ? false : true;
          this.isDisableButton = this.changeComm;
        }
        if (work) {
          let value = this.fieldsArray[1].fields
            .find((item) => item.name == "Work_Phone__c")
            .value.toString();
          this.changeComm = value.length === 10 ? false : true;
          this.isDisableButton = this.changeComm;
        }
      } else {
        this.isDisableButton = true;
        this.changeComm = false;
      }
    }
    if (currentPageStep == 2) {
      this.showLoading = !this.showLoading;
      let strEmail = this.fieldsArray[1].fields
        .find((item) => item.name == EMAIL_FIELD.fieldApiName)
        .value.toString();
      let strContactId = "";
      if (this.isEditAccountWizard) {
        strContactId = this.editContactData[0].Id.toString();
      } else if (this.isGuidedEditAccountModal) {
        strContactId = this.editGuidedContactData[0].Id.toString();
      }
      // let strContactId = this.isEditAccountWizard ? this.editContactData[0].Id.toString() : '';
      checkEmailValidity({ email: strEmail, contactId: strContactId })
        .then((result) => {
          this.showLoading = !this.showLoading;
          if (result) {
            currentPageStep += 1;
            this.fieldsArray.forEach(
              (item) =>
              (item.isCurrentStep =
                item.value == currentPageStep ? true : false)
            );
            this.stepsArray.forEach(
              (item) => (item.active = Number(item.value) <= currentPageStep)
            );
            this.currentStep = currentPageStep.toString();
          } else {
            handleToastEvent(
              this,
              "We found this email address " +
              strEmail +
              " already associated with a contact. Please update the email address. Please make sure that the profile information reflect the new addition.",
              "error"
            );
          }
        })
        .catch((error) => {
          handleToastEvent(this, error, "error");
          return false;
        });
    } else if (currentPageStep < this.fieldsArray.length) {
      currentPageStep += 1;
      this.fieldsArray.forEach(
        (item) =>
          (item.isCurrentStep = item.value == currentPageStep ? true : false)
      );
      this.stepsArray.forEach(
        (item) => (item.active = Number(item.value) <= currentPageStep)
      );
      this.currentStep = currentPageStep.toString();
    }
    this.customValidate(true); //Added for Custom MultiPiklist
  }

  handleBackStep() {
    let currentPageStep = Number(this.currentStep);
    if (currentPageStep > 0) {
      currentPageStep -= 1;
      this.fieldsArray.forEach(
        (item) =>
          (item.isCurrentStep = item.value == currentPageStep ? true : false)
      );
    }
    this.currentStep = currentPageStep.toString();

    if (currentPageStep == 2) {
      const mobile = this.fieldsArray[1].fields.find(
        (item) => item.name == "MobilePhone"
      )?.required;
      const home = this.fieldsArray[1].fields.find(
        (item) => item.name == "HomePhone"
      )?.required;
      const work = this.fieldsArray[1].fields.find(
        (item) => item.name == "Work_Phone__c"
      )?.required;
      if (mobile || home || work) {
        if (mobile) {
          let value = this.fieldsArray[1].fields
            .find((item) => item.name == "MobilePhone")
            .value.toString();
          this.changeComm = value.length === 10 ? false : true;
          this.isDisableButton = this.changeComm;
        }
        if (home) {
          let value = this.fieldsArray[1].fields
            .find((item) => item.name == "HomePhone")
            .value.toString();
          this.changeComm = value.length === 10 ? false : true;
          this.isDisableButton = this.changeComm;
        }
        if (work) {
          let value = this.fieldsArray[1].fields
            .find((item) => item.name == "Work_Phone__c")
            .value.toString();
          this.changeComm = value.length === 10 ? false : true;
          this.isDisableButton = this.changeComm;
        } else {
          this.isDisableButton = true;
          this.changeComm = false;
        }
      }
    }
    if (currentPageStep != 2) {
      this.isDisableButton = true;
      this.changeComm = false;
    }
  }

  showCurrentPage(event) {
    let currentPageStep = event.target.value;
    let stepNumber = Number(currentPageStep);
    this.fieldsArray.forEach(
      (item, index) =>
        (item.isCurrentStep = index + 1 == stepNumber ? true : false)
    );
    this.currentStep = stepNumber.toString();
    if (currentPageStep == 5) {
      let address = this.fieldsArray[4].fields;
      this.isDisableButton = true;
      if (this.isPOBox) {
        if (
          this.strStreetPOBox &&
          this.strCityPOBox &&
          this.strStatePOBox &&
          this.strPostalCodePOBox
        ) {
          this.isDisableButton = this.validateAddress(
            this.strStreetPOBox,
            this.strCityPOBox,
            this.strStatePOBox,
            this.strPostalCodePOBox
          );
        }
      } else {
        if (
          address.find((item) => item.name == "MailingStreet").value &&
          address.find((item) => item.name == "MailingCity").value &&
          address.find((item) => item.name == "MailingState").value &&
          address.find((item) => item.name == "MailingPostalCode").value
        ) {
          this.isDisableButton = this.validateAddress(
            address.find((item) => item.name == "MailingStreet").value,
            address.find((item) => item.name == "MailingCity").value,
            address.find((item) => item.name == "MailingState").value,
            address.find((item) => item.name == "MailingPostalCode").value
          );
        }
      }
    }
  }
  get isFirstStep() {
    return this.currentStep == "1";
  }
  get isLastStep() {
    return (
      this.fieldsArray && this.currentStep == this.fieldsArray.length.toString()
    );
  }
  get countCheckedAccounts() {
    let count = 0;
    this.relatedAccountPicklist.forEach((data) => {
      if (data.checked) count++;
    });
    return count;
  }
  toggleOpenCombobox(event) {
    this.isOpenCombobox = !this.isOpenCombobox;
  }
  toggleSelectRelatedAccount(event) {
    let value = event.currentTarget.dataset.value;
    this.relatedAccountPicklist.forEach((data) => {
      if (!data.cheked) {
        // delete this.accountRole[data.value];
      }
      if (data.value == value && !data.disabled) data.checked = !data.checked;
    });

    this.relatedAccountPicklist.forEach((data) => {
      if (!data.disabled && !data.cheked && data.value == value) {
        delete this.accountRole[value];
        data.role = "";
      }
    });
  }

  toggleSelect(event) {
    let currentPageStep = Number(this.currentStep);
    let multiPickListValues = [];
    let value = event.currentTarget.dataset.value;
    this.fieldsArray[currentPageStep - 1].fields
      .find((item) => item.name === event.currentTarget.dataset.name)
      ?.options.forEach((itm) => {
        if (itm.value === value && !itm.disabled) itm.checked = !itm.checked;
        if (itm.checked) {
          multiPickListValues.push(itm.value);
        }
      });
    this.fieldsArray[currentPageStep - 1].fields.find(
      (item) => item.name === event.currentTarget.dataset.name
    ).value =
      multiPickListValues.length > 0 ? multiPickListValues.join(";") : null;
    this.fieldsArray[currentPageStep - 1].fields.find(
      (item) => item.name === event.currentTarget.dataset.name
    ).count = multiPickListValues.length;
    this.checkValidRequiredFields(event.currentTarget.dataset.name);
  }

  handleClose() {
    this.isOpenCustomAlert = !this.isOpenCustomAlert;
  }

  handleCloseModalAlert(event) {
    this.isOpenCustomAlert = !this.isOpenCustomAlert;
    if (event.target.label === "Yes") {
      if (!this.isCommunity) {
        if (this.isPageLayout) {
          this.isAccountTaxExemption
            ? this.isOpenTaxExemption
              ? this.handleRedirectToTaxExemptionModal(
                this.recordId,
                this.parentAccountIdTaxExemption,
                ""
              )
              : this.dispatchEvent(new CustomEvent("closetab"))
            : this.dispatchEvent(new CloseActionScreenEvent());
        } else {
          this.isAccountTaxExemption && this.isOpenTaxExemption
            ? this.handleRedirectToTaxExemptionModal(
              this.recordId,
              this.parentAccountIdTaxExemption,
              ""
            )
            : this.dispatchEvent(new CustomEvent("closetab"));
        }
      } else {
        this.dispatchEvent(new CustomEvent("close", { detail: false }));
      }
    }
  }

  handleCloseAlert(event) {
    this.showAlert = false;
    if (event.detail != "close") {
      try {
        const address = this.template.querySelector("lightning-input-address");
        if (address) {
          address.focus();
        } else {
          console.log("undef");
        }
      } catch (e) {
        console.log(e);
      }
    }
  }

  handleRedirectToContact(contactId, contactName) {
    this.closeQuickActionComponent();
    this.dispatchEvent(new CustomEvent("closecomp"));
    this.dispatchEvent(
      new CustomEvent("navigatetorecord", { detail: { contactName } })
    );

    this[NavigationMixin.Navigate](
      {
        type: "standard__recordPage",
        attributes: {
          recordId: contactId,
          actionName: "view",
        },
      },
      true
    );
  }

  handleRedirectToContactPageLayout(contactId) {
    this[NavigationMixin.Navigate]({
      type: "standard__recordPage",
      attributes: {
        recordId: contactId,
        actionName: "view",
      },
    });
  }

  handleRedirectToTaxExemptionModal(accountId, parentAccountId, contactId) {
    this.dispatchEvent(new CustomEvent("closecomp"));
    this[NavigationMixin.Navigate](
      {
        type: "standard__component",
        attributes: {
          componentName: "c__newTaxExemptionModalComponent",
        },
        state: {
          c__accountId: accountId,
          c__parentAccountId: parentAccountId,
          c__contactId: contactId,
        },
      },
      true
    );
  }

  handleChangeField(event) {
    try {
      //Added By Dmitry US  004077 Validate Rule.
      let currentPageStep = Number(this.currentStep);
      const communicationPreferenceValuesToValidate = [
        'SMS', 'Mobile Phone (Text)', 'Mobile Phone (Call)', 'Work Phone', 'Home Phone'];
      if (event.target.dataset.name === "Communication_Preference__c") {
        if (communicationPreferenceValuesToValidate.includes(String(event.target.value))) {
          let values;
          let obj = JSON.parse(
            JSON.stringify(this.fieldsArray[currentPageStep - 1].fields)
          );
          obj.forEach((item) => {
            if (
              (event.target.value === "SMS" ||
                event.target.value === "Mobile Phone (Text)" ||
                event.target.value === "Mobile Phone (Call)") &&
              item.label === "Mobile Phone"
            ) {
              item.required = true;
              values = item.value;

              const workPhoneField = obj.find(({ label }) => label === "Work Phone");
              if (workPhoneField) {
                workPhoneField.required = false;
                setTimeout(() => {
                  this.checkValidRequiredFields(workPhoneField.name);
                }, 0);
              }

              const homePhoneField = obj.find(({ label }) => label === "Home Phone");
              if (homePhoneField) {
                homePhoneField.required = false;
                setTimeout(() => {
                  this.checkValidRequiredFields(homePhoneField.name);
                }, 0);
              }
              // obj.find((item) => item.label === "Work Phone").required = false;
              // obj.find((item) => item.label === "Home Phone").required = false;
              this.changeComm =
                values.length === 10 &&
                  values &&
                  this.fieldsArray[currentPageStep - 1].isValidFields
                  ? false
                  : true;
              this.isDisableButton = this.changeComm;
            }
            if (
              event.target.value === "Home Phone" &&
              event.target.value === item.label
            ) {
              item.required = true;
              values = item.value;

              const workPhoneField = obj.find(({ label }) => label === "Work Phone");
              if (workPhoneField) {
                workPhoneField.required = false;
                setTimeout(() => {
                  this.checkValidRequiredFields(workPhoneField.name);
                }, 0);
              }

              const mobilePhoneField = obj.find(({ label }) => label === "Mobile Phone");
              if (mobilePhoneField) {
                mobilePhoneField.required = false;
                setTimeout(() => {
                  this.checkValidRequiredFields(mobilePhoneField.name);
                }, 0);
              }
              // obj.find((item) => item.label === "Work Phone").required = false;
              // obj.find(
              //   (item) => item.label === "Mobile Phone"
              // ).required = false;
              this.changeComm =
                values.length === 10 &&
                  values &&
                  this.fieldsArray[currentPageStep - 1].isValidFields
                  ? false
                  : true;
              this.isDisableButton = this.changeComm;
            }

            if (
              event.target.value === "Work Phone" &&
              event.target.value === item.label
            ) {
              item.required = true;
              values = item.value;

              const homePhoneField = obj.find(({ label }) => label === "Home Phone");
              if (homePhoneField) {
                homePhoneField.required = false;
                setTimeout(() => {
                  this.checkValidRequiredFields(homePhoneField.name);
                }, 0);
              }

              const mobilePhoneField = obj.find(({ label }) => label === "Mobile Phone");
              if (mobilePhoneField) {
                mobilePhoneField.required = false;
                setTimeout(() => {
                  this.checkValidRequiredFields(mobilePhoneField.name);
                }, 0);
              }

              // obj.find((item) => item.label === "Home Phone").required = false;
              // obj.find(
              //   (item) => item.label === "Mobile Phone"
              // ).required = false;
              this.changeComm =
                values.length === 10 &&
                  values &&
                  this.fieldsArray[currentPageStep - 1].isValidFields
                  ? false
                  : true;
              this.isDisableButton = this.changeComm;
            }
          });
          if (
            event.target.value !== "Work Phone" &&
            event.target.value !== "Home Phone" &&
            event.target.value !== "Mobile Phone (Text)" &&
            event.target.value !== "Mobile Phone (Call)" &&
            event.target.value !== "SMS"
          ) {
            const workPhoneField = obj.find(({ label }) => label === "Work Phone");
            if (workPhoneField) {
              workPhoneField.required = false;
              setTimeout(() => {
                this.checkValidRequiredFields(workPhoneField.name);
              }, 0);
            }

            const homePhoneField = obj.find(({ label }) => label === "Home Phone");
            if (homePhoneField) {
              homePhoneField.required = false;
              setTimeout(() => {
                this.checkValidRequiredFields(homePhoneField.name);
              }, 0);
            }

            const mobilePhoneField = obj.find(({ label }) => label === "Mobile Phone");
            if (mobilePhoneField) {
              mobilePhoneField.required = false;
              setTimeout(() => {
                this.checkValidRequiredFields(mobilePhoneField.name);
              }, 0);
            }

            // obj.find((item) => item.label === "Home Phone").required = false;
            // obj.find((item) => item.label === "Mobile Phone").required = false;
            // obj.find((item) => item.label === "Work Phone").required = false;
            this.changeComm = !this.isValid;
            this.isDisableButton = this.changeComm;
          }

          this.fieldsArray[currentPageStep - 1].fields = obj;
        } else {
          let obj = JSON.parse(
            JSON.stringify(this.fieldsArray[currentPageStep - 1].fields)
          );
          const workPhoneField = obj.find(({ label }) => label === "Work Phone");
          if (workPhoneField) {
            workPhoneField.required = false;
            setTimeout(() => {
              this.checkValidRequiredFields(workPhoneField.name);
            }, 0);
          }

          const homePhoneField = obj.find(({ label }) => label === "Home Phone");
          if (homePhoneField) {
            homePhoneField.required = false;
            setTimeout(() => {
              this.checkValidRequiredFields(homePhoneField.name);
            }, 0);
          }

          const mobilePhoneField = obj.find(({ label }) => label === "Mobile Phone");
          if (mobilePhoneField) {
            mobilePhoneField.required = false;
            setTimeout(() => {
              this.checkValidRequiredFields(mobilePhoneField.name);
            }, 0);
          }

          // obj.find((item) => item.label === "Home Phone").required = false;
          // obj.find((item) => item.label === "Mobile Phone").required = false;
          // obj.find((item) => item.label === "Work Phone").required = false;
          this.changeComm = !this.isValid;
          this.isDisableButton = this.changeComm;
          this.fieldsArray[currentPageStep - 1].fields = obj;
        }
      }

      //Added By Dmitry US  004077 Validate Rule
      if (event.target.dataset.name === "Mailing_Street_2__c") {
        this.apartStr =
          event.target.value.length > 0 ? String(event.target.value) : "";
      } else if (event.target.dataset.name === "Is_PO_Box") {
        this.isDisableButton = true;
        this.isPOBox = event.target.checked;
        // Fixed PO Box By Dmitry Bibikov
        // this.strStreet =
        //   this.strCity =
        //   this.strState =
        //   this.strPostalCode =
        //   this.strCountry =
        //   this.strStreetPOBox =
        //   this.strCityPOBox =
        //   this.strStatePOBox =
        //   this.strPostalCodePOBox =
        //   this.strCountryPOBox =
        //   "";

        // this.fieldsArray[4].fields.forEach((item) => {
        //   item.value = "";
        // });
        if (event.target.checked) {
          if (
            this.strStreetPOBox != undefined &&
            this.strCityPOBox != undefined &&
            this.strPostalCodePOBox != undefined &&
            this.strStatePOBox != undefined
          ) {
            this.validateAddress(
              this.strStreetPOBox,
              this.strCityPOBox,
              this.strStatePOBox,
              this.strPostalCodePOBox
            );
          }
        } else {
          if (
            this.strStreet != undefined &&
            this.strCity != undefined &&
            this.strPostalCode != undefined &&
            this.strState != undefined
          ) {
            this.validateAddress(
              this.strStreet,
              this.strCity,
              this.strPostalCode,
              this.strState
            );
          }
        }
        // Fixed PO Box By Dmitry Bibikov
      } else {
        const selectedField = this.fieldsArray[currentPageStep - 1].fields.find(
          (item) => item.name === event.target.dataset.name
        );
        if (!selectedField.checkbox) {
          if (selectedField.type === "date") {
            selectedField.value =
              event.target.value !== null ? event.target.value : "";
          } else {
            selectedField.value = Array.isArray(event.target.value)
              ? event.target.value
              : event.target.value?.length
                ? event.target.value
                : "";
          }
        } else {
          selectedField.value = event.target.checked.toString();
          selectedField.checked = event.target.checked;
        }
        if (event.target.dataset.name != "Communication_Preference__c") {
          this.changeComm = false;
        }
      }
      this.currentStep = currentPageStep.toString();
      this.checkValidRequiredFields(event.currentTarget.dataset.name);
    } catch (e) {
      console.log("e: ", e);
    }
  }

  handleChangeRoleField(event) {
    if (!this.isCommunity) {
      this.rolePicklist = event.detail.value;
      this.accountRole = event.target.value.join(";");
    } else {
      let currentPageStep = Number(this.currentStep);
      //let accouintId = this.relatedAccountPicklist.find(item => item.label == event.target.name).value;
      // const accountRole = {'accountId' : event.target.name, 'roleValue' :event.target.value.toString().trim()};
      this.relatedAccountPicklist.forEach((item) => {
        if (item.value == event.target.name) {
          item.role = event.target.value;
          this.accountRole[event.target.name] = event.target.value.join(";");
        }
      });
      // this.accountRoleObj.push({'accountName': event.target.name ,'value': event.target.value.toString().trim()});
      // let accountId =  event.target.name;
      // let roleValue = event.target.value;
    }
  }

  handleSubmit(event) {
    this.showLoading = !this.showLoading;
    const isSaveAndNew = event.target.dataset.new.toLowerCase() === "true";
    let isDraftStatus = event.target.dataset.isDraft;
    let payload = this.composePayloadContact(isDraftStatus);
    let relatedAccounts = this.composeRelatedAccounts(Number(this.currentStep));
    this.saveContactRecords(payload, relatedAccounts, isSaveAndNew);
  }

  saveContactRecords(data, relatedAccounts, isSaveAndNew) {
    if (!this.isCommunity || this.isEditAccountWizard) {
      createContact({
        jsonContact: JSON.stringify(data),
        jsonAccountContactRelationship: JSON.stringify(relatedAccounts),
      })
        .then((result) => {
          const resultJson = JSON.parse(result);
          const contactId = resultJson.contactId,
            relationId = resultJson.relationId,
            contactName = resultJson.contactName;
          const message =
            this.isGuidedEditAccountModal || this.isEditAccountWizard
              ? "Contact has been updated successfully"
              : "Contact has been created successfully";
          handleToastEvent(this, message, "success");
          if (
            this.isPageLayout &&
            this.isGuidedEditAccountModal &&
            !isSaveAndNew
          ) {
            this.handleRedirectToContactPageLayout(contactId);
            getRecordNotifyChange([{ recordId: contactId }]);
          } else if (
            this.isPageLayout &&
            this.isNewAccountWizard &&
            !isSaveAndNew
          ) {
            if (this.isAccountTaxExemption) {
              this.isOpenTaxExemption
                ? this.handleRedirectToTaxExemptionModal(
                  this.recordId,
                  this.parentAccountIdTaxExemption,
                  resultJson.contactId
                )
                : this.handleRedirectToContact(contactId, contactName);
            } else {
              this.handleRedirectToContactPageLayout(contactId);
            }
          } else if (this.isAccountTaxExemption && !isSaveAndNew) {
            this.isOpenTaxExemption
              ? this.handleRedirectToTaxExemptionModal(
                this.recordId,
                this.parentAccountIdTaxExemption,
                resultJson.contactId
              )
              : this.handleRedirectToContact(contactId, contactName);
          } else if (isSaveAndNew) {
            this.handleSaveAndNew();
          } else if (this.isCommunity && this.isEditAccountWizard) {
            this.dispatchEvent(new CustomEvent("close", { detail: true }));
          } else {
            this.handleRedirectToContact(contactId, contactName);
          }
        })
        .catch((error) => {
          handleToastEvent(this, error, "error");
        })
        .finally(() => {
          this.showLoading = !this.showLoading;
        });
    } else {
      putContactRecords({
        jsonContact: JSON.stringify(data),
        jsonAccountContactRelation: JSON.stringify(relatedAccounts),
      })
        .then((result) => {
          let message =
            "Your Account is queued for creation. Refresh the page after a while.";
          handleToastEvent(this, message, "success");
          isSaveAndNew
            ? this.handleSaveAndNew()
            : this.dispatchEvent(new CustomEvent("close", { detail: true }));
        })
        .catch((error) => {
          handleToastEvent(this, error, "error");
        })
        .finally(() => {
          this.showLoading = !this.showLoading;
        });
    }
  }

  handleSaveAndNew() {
    this.currentStep = "1";

    this.fieldsArray.forEach((item, index) => {
      item.isCurrentStep = index + 1 === Number(this.currentStep);
      item.isValidFields = item.value === "3" || item.value === "5";
      item.fields.forEach((element) => {
        element.value =
          element.name === ACCOUNT_NAME_FIELD.fieldApiName
            ? this.isCommunity
              ? this.parentAccount.value
              : this.accountName
            : "";
      });
    });

    this.isPOBox = false;
    this.strStreet =
      this.strCity =
      this.strState =
      this.strPostalCode =
      this.strCountry =
      this.strStreetPOBox =
      this.strCityPOBox =
      this.strStatePOBox =
      this.strPostalCodePOBox =
      this.strCountryPOBox =
      "";

    this.isDisableButton = true;
  }

  customAddressValidation(street, city, state, postalCode) {
    return isValidateAddress({
      street: street,
      anotherStreet: "",
      city: city,
      state: state,
      postalCode: postalCode,
    });
  }
  composePayloadContact(isDraftStatus) {
    let currentPageStep = Number(this.currentStep);
    let payload = {};
    this.fieldsArray.forEach((item) => {
      item.fields.forEach((field) => {
        if (field.name !== ROLES_FIELD.fieldApiName) {
          payload[field.name] = field.value?.length
            ? field.value.trim()
            : field.checkbox
              ? field.checked
              : null;
        }
      });
    });
    this.currentStep = currentPageStep.toString();
    payload.vlocity_cmt__Status__c =
      isDraftStatus === "true" ? "Draft" : "Active";
    payload[APARTMENT_FIELD.fieldApiName] = this.apartStr;
    payload[IS_PO_BOX_FIELD.fieldApiName] = this.isCommunity
      ? String(this.isPOBox)
      : this.isPOBox;

    if (this.isPOBox) {
      payload.PO_Box_Address__Street__s = this.strStreetPOBox;
      payload.PO_Box_Address__City__s = this.strCityPOBox;
      payload.PO_Box_Address__StateCode__s = this.strStatePOBox;
      payload.PO_Box_Address__PostalCode__s = this.strPostalCodePOBox;
      payload.PO_Box_Address__CountryCode__s = this.strCountryPOBox;
    }

    if (!this.isCommunity) {
      payload.AccountId = this.accountId;
    }
    if (this.editContactId != null) {
      payload.Id = this.editContactId;
    }

    if (isDraftStatus) {
      payload[STEP_FIELD.fieldApiName] = Number(this.currentStep);
    }

    return payload;
  }

  composeRelatedAccounts(currentStep) {
    if (!this.isCommunity) {
      if (currentStep >= 4) {
        let obj = [];
        obj.push({ accIds: this.accountId, role: this.rolePicklist.join(";") });
        return obj;
      }
    } else {
      if (currentStep >= 4) {
        let obj = [];
        const keys = this.relatedAccountPicklist.filter((item) => item.checked);
        keys.forEach((item) => {
          obj.push({ accIds: item.value, role: this.accountRole[item.value] });
        });
        return obj;
      }
    }
  }

  checkValidRequiredFields(fieldName) {
    let customValid = this.customValidate(false); //Added for Custom MultiPiklist
    const allValid = [
      ...this.template.querySelectorAll("lightning-input"),
      ...this.template.querySelectorAll("lightning-combobox"),
      ...this.template.querySelectorAll("lightning-input-address"),
    ].reduce((validSoFar, inputCmp) => {
      let isInputValid = true;
      if (inputCmp.name === fieldName) {
        if (
            inputCmp.type === "date" &&
            inputCmp.value === null &&
            inputCmp.required &&
            this.codeKey !== "Backspace" &&
            this.codeKey !== "Delete"
        ) {
          inputCmp.setCustomValidity(
              "Your entry does not match the allowed format MM/DD/YYYY"
          );
        } else if (
            inputCmp.type === "date" &&
            inputCmp.value === null &&
            (this.codeKey === "Backspace" || this.codeKey === "Delete")
        ) {
          inputCmp.setCustomValidity("");
        } else if (inputCmp.type === "date" && inputCmp.value !== null) {
          inputCmp.setCustomValidity("");
        } else if (
            !inputCmp.required && (
                fieldName === 'Work_Phone__c' ||
                fieldName === 'HomePhone' ||
                fieldName === 'MobilePhone'
            )
        ) {
          inputCmp.setCustomValidity("");
        }
        inputCmp.reportValidity();
        isInputValid = inputCmp.checkValidity();
      }
      return validSoFar && isInputValid;
    }, true);
    this.isValid = allValid && customValid;
    this.fieldsArray[Number(this.currentStep) - 1].isValidFields =
      allValid && customValid; //Added for Custom MultiPiklist
    //Added for Custom MultiPiklist
    if (!(allValid && customValid)) {
      this.stepsArray.forEach((item) => {
        if (Number(item.value) < this.currentStep) {
          item.active = true;
        } else {
          item.active = false;
        }
      });
      this.isDisableButton = true;
    } else {
      this.isDisableButton = false;
    }
  }
  //Added for Custom MultiPiklist
  customValidate(isButton) {
    let array = [];
    if (isButton) {
      this.fieldsArray[Number(this.currentStep) - 1].fields.forEach((item) => {
        if (
          item.required &&
          item.value != null &&
          item.value != "" &&
          item.multipicklist
        ) {
          array.push(true);
        } else if (
          item.required &&
          (item.value === null || (item.value === "" && item.multipicklist))
        ) {
          array.push(false);
        }
      });
    } else {
      this.fieldsArray[Number(this.currentStep) - 1].fields.forEach((item) => {
        if (
          item.required &&
          item.value != null &&
          item.value != "" &&
          item.multipicklist
        ) {
          array.push(true);
        } else if (
          item.required &&
          (item.value === null || (item.value === "" && item.multipicklist))
        ) {
          array.push(false);
        }
      });
    }

    if ((array.length === 0 || !array) && isButton) {
      this.fieldsArray[Number(this.currentStep) - 1].fields.forEach((item) => {
        if (item.required && item.value != null && item.value) {
          array.push(true);
        } else if (
          item.required &&
          (item.value === null || item.value === "")
        ) {
          array.push(false);
        }
      });
    }
    let alltrue = array.every((val) => val === true);
    return isButton ? (this.changeComm = !alltrue) : alltrue;
  }
  //Added for Custom MultiPiklist

  get isNotValidFields() {
    try {
      if (this.isCurrentUserHasARole) {
        if (
          this.fieldsArray &&
          this.currentStep === this.fieldsArray.length.toString()
        ) {
          return this.isDisableButton;
        } else {
          if (this.isCommunityExistAndActive) {
            return !(this.fieldsArray &&
              this.fieldsArray[Number(this.currentStep) - 1].isValidFields &&
              this.fieldsArray[Number(this.currentStep) - 1].fields.length &&
              this.fieldsArray[Number(this.currentStep) - 1].fields
                .filter(({ required }) => required)
                .every(({ value }) => Array.isArray(value) ? value : value.length)
            );
          } else {
            return !(this.fieldsArray &&
              this.fieldsArray[Number(this.currentStep) - 1].isValidFields &&
              this.fieldsArray[Number(this.currentStep) - 1].fields.length &&
              this.fieldsArray[Number(this.currentStep) - 1].fields
                .filter(({ required, name }) => required && name !== 'Portal_Permission__c')
                .every(({ value }) => Array.isArray(value) ? value : value.length)
            );
          }
          // if (this.changeComm) {
          //   if (this.isCommunityExistAndActive) {
          //     return true;
          //   } else {
          //     // return this.currentStep !== '4' && this.changeComm;
          //     return this.fieldsArray[Number(this.currentStep) - 1].fields.length
          //         && !this.fieldsArray[Number(this.currentStep) - 1].fields
          //             .filter(({ required }) => required)
          //             .every(({ value }) => Array.isArray(value) ? value : value.length);
          //   }
          // }
          // // if (!this.isDisableButton) {
          // //   return this.isDisableButton;
          // // }
          // if (this.fieldsArray) {
          //   return !this.fieldsArray[Number(this.currentStep) - 1].isValidFields
          // }
        }
      } else {
        return true;
      }
    } catch (error) {
      handleToastEvent(this, error, "error");
    }
  }
  addressInputChange(event) {
    if (this.isPOBox) {
      this.strStreetPOBox = event.target.street;
      this.strCityPOBox = event.target.city;
      this.strStatePOBox = event.target.province;
      this.strPostalCodePOBox = event.target.postalCode;
      this.strCountryPOBox = event.target.country;
    } else {
      this.strStreet = event.target.street;
      this.strCity = event.target.city;
      this.strCountry = event.target.country;
      this.strState = event.target.province;
      this.strPostalCode = event.target.postalCode;
      this.fieldsArray[4].fields[0].value = event.target.street;
      this.fieldsArray[4].fields[1].value = event.target.city;
      this.fieldsArray[4].fields[2].value = event.target.province;
      this.fieldsArray[4].fields[3].value = event.target.postalCode;
      this.fieldsArray[4].fields[4].value = event.target.country;
    }
    event.target.country =
      typeof event.target.country === "undefined" ? "" : event.target.country;

    this.addressToReturn = this.buildAddress(
      event.target.street,
      event.target.city,
      event.target.province,
      event.target.postalCode,
      event.target.country
    );

    if (
      event.target.street != undefined &&
      event.target.city != undefined &&
      event.target.postalCode != undefined &&
      event.target.province != undefined
    ) {
      this.validateAddress(
        event.target.street,
        event.target.city,
        event.target.province,
        event.target.postalCode
      );
    }
  }
  // handleToastEvent(message, variant) {
  //   const evt = new ShowToastEvent({
  //     title: message,
  //     variant: variant
  //   });
  //   this.dispatchEvent(evt);
  // }
  putDataToFields(editData) {
    this.fieldsArray.forEach((item) => {
      let tempObj = item;
      item.fields.forEach((element) => {
        if (
          element.name === "Communication_Preference__c" &&
          editData[0][element.name]
        ) {
          let commValue = editData[0][element.name];
          if (commValue === "Work Phone") {
            let obj = tempObj.fields.find(
              (item) => item.name === "Work_Phone__c"
            );

            if (obj) {
              obj.required = true;
              tempObj = obj;
            }
          }
          if (commValue === "Mobile Phone (Text)" || commValue === "Mobile Phone (Call)" || commValue === "SMS") {
            let obj = tempObj.fields.find(
              (item) => item.name === "MobilePhone"
            );

            if (obj) {
              obj.required = true;
              tempObj = obj;
            }
          }
          if (commValue === "Home Phone") {
            let obj = tempObj.fields.find((item) => item.name === "HomePhone");

            if (obj) {
              obj.required = true;
              tempObj = obj;
            }
          }

          item = tempObj;
        }
        if (
          this.isCommunity &&
          element.name === "Portal_Permission__c" &&
          editData[0][element.name] === "Operation" &&
          editData[0].Id === this.currentCommunityContactId
        ) {
          element.inputDisabled = true;
        }
        if (editData[0][element.name]) {
          if (
            element.name != "MailingCity" &&
            element.name != "MailingCountry" &&
            element.name != "MailingPostalCode" &&
            element.name != "MailingState" &&
            element.name != "MailingStreet"
          ) {
            element.value = editData[0][element.name].toString();
            this.apartStr = editData[0]["Mailing_Street_2__c"];
            if (element.checkbox) {
              element.checked = editData[0][element.name];
            } else if (element.search && this.relatedContacts) {
              const reportsToContact = this.relatedContacts.find(
                (item) =>
                  item?.ContactId === editData[0][element.name] ||
                  item?.Id === editData[0][element.name]
              );
              if (reportsToContact) {
                this.selectedReportsToContact = reportsToContact?.Contact
                  ? reportsToContact.Contact.Name
                  : reportsToContact.Name;
              }
            }
          } else {
            this.strStreet = editData[0]["MailingStreet"];
            this.strCity = editData[0]["MailingCity"];
            this.strState = editData[0]["MailingState"];
            this.strPostalCode = editData[0]["MailingPostalCode"];
            this.strCountry = editData[0]["MailingCountry"];
            element.value = editData[0][element.name].toString();
            if (
              editData[0]["MailingStreet"] != undefined &&
              editData[0]["MailingCity"] != undefined &&
              editData[0]["MailingPostalCode"] != undefined &&
              editData[0]["MailingState"] != undefined
            ) {
              this.validateAddress(
                editData[0]["MailingStreet"],
                editData[0]["MailingCity"],
                editData[0]["MailingState"],
                editData[0]["MailingPostalCode"]
              );
            }
          }
        }
      });
    });
    if (editData[0].hasOwnProperty("Is_PO_Box__c")) {
      this.isPOBox = editData[0]["Is_PO_Box__c"];
    }

    if (editData[0].hasOwnProperty("PO_Box_Address__Street__s")) {
      this.strStreetPOBox = editData[0]["PO_Box_Address__Street__s"];
    }

    if (editData[0].hasOwnProperty("PO_Box_Address__City__s")) {
      this.strCityPOBox = editData[0]["PO_Box_Address__City__s"];
    }

    if (editData[0].hasOwnProperty("PO_Box_Address__StateCode__s")) {
      this.strStatePOBox = editData[0]["PO_Box_Address__StateCode__s"];
    }

    if (editData[0].hasOwnProperty("PO_Box_Address__PostalCode__s")) {
      this.strPostalCodePOBox = editData[0]["PO_Box_Address__PostalCode__s"];
    }

    if (editData[0].hasOwnProperty("PO_Box_Address__CountryCode__s")) {
      this.strCountryPOBox = editData[0]["PO_Box_Address__CountryCode__s"];
    }

    if (this.isPOBox) {
      this.validateAddress(
        this.strStreetPOBox,
        this.strCityPOBox,
        this.strStatePOBox,
        this.strPostalCodePOBox
      );
    }

    if (this.isCommunity) {
      this.relatedAccountPicklist.map((item) => {
        if (!item.checked) {
          editData[0].AccountContactRelations.records.forEach((element) => {
            if (!element.IsDirect) {
              if (item.value == element.AccountId) {
                item.checked = true;
                if (typeof element.Roles != "undefined") {
                  this.accountRole[element.AccountId] = element.Roles;
                  let roles = element.Roles.replace(/;/g, ",");
                  const words = roles.split(",");
                  item.role = words;
                }
              }
            } else {
              if (item.value == element.AccountId) {
                item.checked = true;
                if (typeof element.Roles != "undefined") {
                  this.accountRole[element.AccountId] = element.Roles;
                  let roles = element.Roles.replace(/;/g, ",");
                  const words = roles.split(",");
                  item.role = words;
                }
              }
            }
          });
        } else if (item.checked) {
          editData[0].AccountContactRelations.records.forEach((element) => {
            if (element.IsDirect) {
              if (item.value == element.AccountId) {
                if (typeof element.Roles != "undefined") {
                  this.accountRole[element.AccountId] = element.Roles;
                  let roles = element.Roles.replace(/;/g, ",");
                  const words = roles.split(",");
                  item.role = words;
                }
              }
            }
          });
        }
      });
      if (editData[0].AccountContactRelations.records.length > 0) {
        this.fieldsArray[3].fields[2].value = editData[0]
          .AccountContactRelations.records[0].Roles
          ? editData[0].AccountContactRelations.records[0].Roles.split(";")
          : [];
      }
    } else {
      this.rolePicklist = [];
      let relatedAccount = editData[0].AccountContactRelations.records.find(
        (item) => item.IsDirect == true
      );
      if (relatedAccount.Roles) {
        this.rolePicklist.push(...relatedAccount.Roles.split(";"));
      }

      /*Set AccountName for Guided Contact Edit wizard instead of AccountId*/
      let parentAccountField = this.fieldsArray[3].fields.find(
        (item) => item.name === "AccountId"
      );
      parentAccountField.value = this.accountName;
    }
    this.editContactId = editData[0].Id;
    this.showDraftButton =
      editData[0]?.vlocity_cmt__Status__c &&
      editData[0].vlocity_cmt__Status__c === "Draft";

    this.currentStep = !this.showDraftButton
      ? "1"
      : String(editData[0].Step__c);
    this.fieldsArray.forEach((item, index) => {
      item.isCurrentStep = index + 1 === Number(this.currentStep);
      item.isValidFields = index < editData[0].Step__c || index === 2;
    });
    //Added for Custom MultiPiklist//
    this.fieldsArray.forEach((item) => {
      item.fields.forEach((element) => {
        if (
          element.multipicklist &&
          element.value &&
          element.isTypeInput &&
          !element.custom
        ) {
          let multiselect = element.value.split(";");
          element.count = multiselect.length;
          element.options.forEach((itm) => {
            if (multiselect.includes(itm.value) && !itm.disabled)
              itm.checked = !itm.checked;
          });
        }
      });
    });
    //Added for Custom MultiPiklist
  }

  searchReportsToContact(event) {
    try {
      this.isEnableList = true;
      this.searchKeyPrimary = event.target.value;
      let subContactCombolist = [];
      if (this.searchKeyPrimary != null) {
        this.loadingText = true;
        for (let i = 0; i < this.relatedContacts.length; i++) {
          if (
            this.isCommunity &&
            this.relatedContacts[i].Name.replace(/\s/g, "")
              .toLowerCase()
              .includes(this.searchKeyPrimary.replace(/\s/g, "").toLowerCase())
          ) {
            subContactCombolist.push(this.relatedContacts[i]);
          } else if (
            !this.isCommunity &&
            this.relatedContacts[i].Contact.Name.replace(/\s/g, "")
              .toLowerCase()
              .includes(this.searchKeyPrimary.replace(/\s/g, "").toLowerCase())
          ) {
            subContactCombolist.push(this.relatedContacts[i].Contact);
          }
        }
      }
      this.loadingText = false;
      this.relatedContactsClass =
        subContactCombolist.length > 0
          ? "slds-combobox slds-dropdown-trigger slds-dropdown-trigger_click slds-is-open"
          : "slds-combobox slds-dropdown-trigger slds-dropdown-trigger_click";
      if (this.searchKeyPrimary.length > 0 && subContactCombolist.length == 0) {
        this.messageFlag = true;
      } else {
        this.messageFlag = false;
      }

      this.relatedContactList = [...subContactCombolist];
    } catch (e) {
      console.log("e: ", e);
    }
  }

  selectReportToContact(event) {
    this.selectRelatedContactId = event.currentTarget.dataset.id;
    this.selectedReportsToContact = event.currentTarget.dataset.name;
    let label = event.currentTarget.dataset.label;
    this.relatedContactsClass =
      "slds-combobox slds-dropdown-trigger slds-dropdown-trigger_click";
    this.clearReportsToContactIconFlag = true;
    this.inputRelatedContactReadOnly = true;

    this.fieldsArray[1].fields.forEach((item) => {
      if (item.label == label) {
        item.value = this.selectRelatedContactId;
      }
    });
  }

  resetRelatedContactsData(event) {
    this.selectedReportsToContact = "";
    this.selectPrimaryRecordId = "";
    this.inputRelatedContactReadOnly = false;
    this.clearReportsToContactIconFlag = false;
    let label = event.currentTarget.dataset.label;
    this.fieldsArray[1].fields.forEach((item) => {
      if (item.label == label) {
        item.value = "";
      }
    });
  }

  closeList() {
    this.isEnableList = !this.isOver;
  }

  clearData() {
    this.isOver = true;
  }

  runData() {
    this.isOver = false;
  }

  buildAddress(street, city, state, code, country) {
    let address = [];
    if (street != undefined) {
      address.push(street);
    }
    if (city != undefined) {
      address.push(city);
    }
    if (state != undefined) {
      address.push(state);
    }
    if (code != undefined) {
      address.push(code);
    }
    if (country != undefined) {
      address.push(country);
    }

    return address;
  }

  validateAddress(street, city, state, code) {
    this.isDisableButton = !(
      street.length > 0 &&
      city.length > 0 &&
      state.length > 0 &&
      code.length > 0
    );
    return this.isDisableButton;
  }

  handleFocusField(event) {
    this.codeKey = event.code;
  }

  closeQuickActionComponent() {
    const closeQA = new CustomEvent("close");
    // Dispatches the event.
    this.dispatchEvent(closeQA);
  }
}