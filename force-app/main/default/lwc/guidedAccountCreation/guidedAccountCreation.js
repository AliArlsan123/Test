import { LightningElement, track, wire, api } from 'lwc';
import { CurrentPageReference, NavigationMixin } from 'lightning/navigation';
import { CloseActionScreenEvent } from 'lightning/actions';
import { loadStyle } from 'lightning/platformResourceLoader';
import { ShowToastEvent } from 'lightning/platformShowToastEvent';
import ACCOUNT_OBJECT from '@salesforce/schema/Account';
import { getObjectInfo } from 'lightning/uiObjectInfoApi';
import STYLES from '@salesforce/resourceUrl/SelfServiceCenterPortal_ReloadStyles';
import getRecordTypes from '@salesforce/apex/GuidedAccountCreationController.getRecordTypes';
import getFieldsFromFieldSets from '@salesforce/apex/GuidedAccountCreationController.getFieldsFromFieldSets';
import getFieldsetValues from '@salesforce/apex/GuidedAccountCreationController.getFieldsetValues'; //added Dmitry Bibikov to edit Account
import getRecordTypeInfo from '@salesforce/apex/GuidedAccountCreationController.getRecordTypeInfo'; //added Dmitry Bibikov to edit Account
import getparentAccountInfo from '@salesforce/apex/GuidedAccountCreationController.getParentAccountInfoById'; //added Dmitry Bibikov to edit Account
import createAccount from '@salesforce/apex/GuidedAccountCreationController.createAccount';
import getRelatedContracts from '@salesforce/apex/GuidedAccountCreationController.getRelatedContracts';
import { getRecord, getRecordNotifyChange } from "lightning/uiRecordApi"; //Added UP 006112
import getParentBillCycleValue from "@salesforce/apex/GuidedAccountCreationController.getParentBillCycleValue"; //Added UP 006112
import { RefreshEvent } from "lightning/refresh"; //Added UP 006112
import USER_ID from "@salesforce/user/Id"; //Added UP 006112
import USER_ROLE_ID from "@salesforce/schema/User.UserRole.Id"; //Added UP 006112
import { handleToastEvent } from "c/lwcUtils"; //Added UP 006112

export default class GuidedAccountCreation extends NavigationMixin(LightningElement) {
  //@api recordId;
  _recordId;
  @api isOpenFromListViewButton = false;
  objectApiName = 'Account';

  //added Dmitry Bibikov to edit Account
  @track isOpenCustomAlert = false;
  @api isEdit;
  @track windowLabel;
  @track accountData = [];
  @track fieldsetNames;
  @track accountName;
  @track isBillingAccount;
  @track isDisableButton = true;
  @track showPlaceHolder;
  //added Dmitry Bibikov to edit Account

  @track showAlert = false;
  @track addressToAlert;
  @track addressToReturn;

  //added by Ryan Reddish
  @track billCreate = false;

  isOpenDirectAccountWizard = false; //Added UP 006112
  isCurrentUserHasARole = true; //Added UP 006112
  //Added UP 006112

  @api set recordId(value) {
    this._recordId = value;

    if (!this.isCurrentUserHasARole) {
      handleToastEvent(
        this,
        "In order to run the guided Wizard you must have a Role assigned to you. Please, contact an Administrator for role assignment",
        "error"
      );
      this.dispatchEvent(new CloseActionScreenEvent())
      this.closeQuickAction();
    } else {
      if (this.recordId && this.isOpenDirectAccountWizard && this.currentRecordTypeName) {
        this.getParentBillCycleValue();
      }
    }
  }

  get recordId() {
    return this._recordId;
  }

  @wire(CurrentPageReference)
  getPageReferenceParameters(currentPageReference) {
    if (this.isOpenFromListViewButton) {
      this.isOpenSelectAccountRecordTypeModal = true;
      this.isOpenModalWindow = false;
      this.accountData = [];
    }
    this.isOpenDirectAccountWizard =
      currentPageReference.attributes.apiName ===
      "Account.Create_Direct_Invoice_Account";
    if (
      currentPageReference.state.c__recordId
    ) {
      this.recordId = currentPageReference.state.c__recordId;
    }
  }

  @wire(getRecord, { recordId: USER_ID, fields: [USER_ROLE_ID] })
  userDetails({ error, data }) {
    if (error) {
     // handleToastEvent(this, error, "error");
    } else if (data) {
      this.isCurrentUserHasARole = data.fields.UserRole.value !== null;

      if (!this.isCurrentUserHasARole) {
        handleToastEvent(
          this,
          "In order to run the guided Wizard you must have a Role assigned to you. Please, contact an Administrator for role assignment",
          "error"
        );
        this.dispatchEvent(new CloseActionScreenEvent())
        this.closeQuickAction();
      }
    }
  }

  //Added UP 006112

  iconColor = 'var(--lwc-brandDark)';

  fieldSetConsumer = [
    { stepName: 'Account Information', fieldSetName: 'ConsAcctInfo' },
    //{ stepName: 'Billing Address Information', fieldSetName: 'ConsBillAddress' },  //added Dmitry Bibikov to edit Account
    { stepName: 'Shipping Address Information', fieldSetName: 'ConsShipAddress' },
    { stepName: 'Contact Information', fieldSetName: 'ConsContactPref' }
  ];

  fieldSetBusiness = [
    { stepName: 'Account Information', fieldSetName: 'BusAcctInfo' },
    //{ stepName: 'Billing Address Information', fieldSetName: 'BusBillAddress' },  //added Dmitry Bibikov to edit Account
    { stepName: 'Shipping Address Information', fieldSetName: 'BusShipAddress' },
    { stepName: 'Contact Information', fieldSetName: 'BusContactPref' }
  ];

  fieldSetBilling = [
    { stepName: 'Account Information', fieldSetName: 'BillAcctInfo' },
    { stepName: 'Billing Profile', fieldSetName: 'BillProfile' },
    { stepName: 'Billing Address Information', fieldSetName: 'BillBillAddress' },
    { stepName: 'Contact Information', fieldSetName: 'BillContactInfo' }
  ];

  recordTypeData = {
    Consumer: this.fieldSetConsumer,
    Billing: this.fieldSetBilling,
    Business: this.fieldSetBusiness
  };

  @track billingRecordTypeId;
  @track currentRecordTypeId;
  @track currentRecordTypeName;
  @track currentFieldSetsMap = []; //Added UP 006112
  @track accountRecordTypes = '';
  @track currentStep = '1';

  @track isOpenSelectAccountRecordTypeModal;
  @track isOpenModalWindow;
  @track isNextButtonDisabled = true;

  @track showLoading = false;
  accountRecordTypesError = '';
  dataFieldSetsError = '';

  @track fieldsArray = [
    { value: '1', isCurrentStep: true, isValidFields: false, stepName: '', fields: '' },
    { value: '2', isCurrentStep: false, isValidFields: false, stepName: '', fields: '' },
    { value: '3', isCurrentStep: false, isValidFields: false, stepName: '', fields: '' },
    { value: '4', isCurrentStep: false, isValidFields: false, stepName: '', fields: '' }
  ];

  //added Dmitry Bibikov to edit Account
  @track fieldsArrayNotBilling = [
    { value: '1', isCurrentStep: true, isValidFields: false, stepName: '', fields: '' },
    { value: '2', isCurrentStep: false, isValidFields: false, stepName: '', fields: '' },
    { value: '3', isCurrentStep: false, isValidFields: false, stepName: '', fields: '' }
  ];

  @track stepsArray = [
    { value: '1', stepName: '', active: true },
    { value: '2', stepName: '', active: false },
    { value: '3', stepName: '', active: false },
    { value: '4', stepName: '', active: false }
  ];

  @track stepsArrayNotBilling = [
    { value: '1', stepName: '', active: true },
    { value: '2', stepName: '', active: false },
    { value: '3', stepName: '', active: false }
  ];
  //added Dmitry Bibikov to edit Account

  isAccountTaxExemption = false;
  isOpenTaxExemption = false;
  createdAccountId;
  createdAccountParentId;

  @track taxExemptionPicklistValues;
  currentIsTaxExemptionValue = '';

  isOpenCustomContactCreationAlert = false;

  isPOBox = false;
  POBoxAddress = '';

  parentBillCycleValue = ""; //Added UP 006112

  @wire(getObjectInfo, { objectApiName: ACCOUNT_OBJECT })
  objectInfo;

  /*@wire(getPicklistValues, { recordTypeId: "$objectInfo.data.defaultRecordTypeId", fieldApiName: IS_TAX_EXEMPTION_FIELD })
  taxExemptionPicklist({ error, data }) {
      if (data) {
          let values = [...data.values];
          let newValues = values.filter(item => item.value != 'None');
          newValues.unshift({ label: '--None--', value: '' });
          this.taxExemptionPicklistValues = newValues;
      } else {
          console.log('error tax exemption picklist: ', error);
      }
  };*/

  @wire(getRecordTypes)
  getRecordTypes({ error, data }) {
    if (data) {
      let recordTypes = JSON.parse(data);
      if (recordTypes.length != 0) {
        this.accountRecordTypes = recordTypes;
        if (!this.isOpenFromListViewButton) {
          this.billingRecordTypeId = recordTypes.find((item) => item.Name == 'Billing').Id;
          //added Dmitry Bibikov to edit Account
          if (!this.isEdit) {
            this.currentRecordTypeName = 'Billing';
            this.currentRecordTypeId = this.billingRecordTypeId;
            this.billCreate = true;
            this.getParentBillCycleValue(); //Added UP 006112
            //this.getFieldsFromFieldSets();
          } else {
            getRecordTypeInfo({ recordId: this.recordId })
              .then((result) => {
                const data = JSON.parse(result);
                if (data[0]['RecordTypeId']) {
                  this.currentRecordTypeName = data[0].RecordType.Name;
                  this.currentRecordTypeId = data[0].RecordType.Id;
                  if (
                    this.currentRecordTypeName == 'Business' ||
                    this.currentRecordTypeName == 'Billing' ||
                    this.currentRecordTypeName == 'Consumer'
                  ) {
                    if (this.currentRecordTypeName == 'Billing') {
                      this.billCreate = true;
                    }
                    this.getFieldsFromFieldSets();
                  } else {
                    this.showPlaceHolder = true;
                    this.showLoading = false;
                  }
                } else {
                  this.showPlaceHolder = true;
                  this.showLoading = false;
                }
              })
              .catch((error) => {
                console.log(error);
              });
          }
          //added Dmitry Bibikov to edit Account
        }
      } else {
        this.accountRecordTypesError = 'Record types not found.';
      }
    } else if (error) {
      console.log('Get Account Record Types Error: ', error.body.message);
    }
  }

  connectedCallback() {
    if (this.isOpenFromListViewButton) {
      this.isOpenSelectAccountRecordTypeModal = true;
      this.isOpenModalWindow = false;
    } else {
      this.isOpenSelectAccountRecordTypeModal = false;
      this.isOpenModalWindow = true;
    }

    this.windowLabel = !this.isEdit ? 'New Account' : 'Edit Account';
  }
  //Added UP 006112
  getParentBillCycleValue() {
    getParentBillCycleValue({ recordId: this.recordId })
      .then((result) => {
        this.parentBillCycleValue = result;
        this.getFieldsFromFieldSets();
      })
      .catch((error) => {
        handleToastEvent(this, error, "error");
      });
  }
  //Added UP 006112

  renderedCallback() {
    Promise.all([loadStyle(this, STYLES + '/styles/NewAccountWizardQA.css')]);
  }

  getFieldsFromFieldSets() {
    this.showLoading = !this.showLoading;
    let fieldSets = [];
    this.currentFieldSetsMap = this.recordTypeData[this.currentRecordTypeName];
    //added Dmitry Bibikov to edit Account
    if (this.currentRecordTypeName === 'Business' || this.currentRecordTypeName === 'Consumer') {
      this.fieldsArray = this.fieldsArrayNotBilling;
      this.stepsArray = this.stepsArrayNotBilling;
      this.isBillingAccount = false;
    } else {
      this.isBillingAccount = true;
    }
    //added Dmitry Bibikov to edit Account
    this.currentFieldSetsMap.forEach((item) => {
      fieldSets.push(item.fieldSetName);
    });

    this.fieldSetsNames = fieldSets; //added Dmitry Bibikov to edit Account

    getFieldsFromFieldSets({
      fieldSetsNames: fieldSets,
      createBill: this.billCreate
    })
      .then((result) => {
        let dataFieldsFromFieldSets = JSON.parse(result);

        if (Object.keys(dataFieldsFromFieldSets).length != 0) {
          this.composeDataFields(dataFieldsFromFieldSets);
        } else {
          this.showLoading = !this.showLoading;
          this.dataFieldSetsError = 'No fields found in field sets.';
        }
      })
      .catch((error) => {
        this.showLoading = !this.showLoading;
        this.dataFieldSetsError = 'No fields found in field sets.';
        console.log('Get Fields From Field Sets: ', error.body.message);
      });
  }

  composeDataFields(dataFields) {
    try {
      this.showLoading = !this.showLoading;

      this.currentFieldSetsMap.forEach((fieldSetValue, index) => {
        this.fieldsArray[index].fields = dataFields[fieldSetValue.fieldSetName];
        this.fieldsArray[index].stepName = fieldSetValue.stepName;
        this.stepsArray[index].stepName = fieldSetValue.stepName;
      });

      this.fieldsArray.forEach((stepData) => {
        let numOfAddressFields = 0;
        let fullAddressLabel;
        let obj = { isNotVisible: false, isAddress: true, isPOBoxAddress: false };
        let poBoxFieldObj = { isNotVisible: false, isAddress: true, isPOBoxAddress: true };

        stepData.fields.forEach((curr) => {
          //Added  Dmitry Bibikov to Set Active as Default to Account Status Field
          if (curr.name === 'vlocity_cmt__Status__c') {
            curr.value = 'Active';
          }
          //Added UP 006112
          if (
            this.isOpenDirectAccountWizard &&
            curr.name === "Direct_Invoice__c"
          ) {
            curr.value = "Yes";
          }

          if (
            this.isOpenDirectAccountWizard &&
            curr.name === "vlocity_cmt__BillCycle__c" &&
            this.parentBillCycleValue
          ) {
            curr.value = this.parentBillCycleValue;
          }
          //Added UP 006112
          //Added  Dmitry Bibikov to Set Active as Default to Account Status Field
          if (curr.name.includes('PO_Box_Address__')) {
            const poBoxFieldName = curr.name.replace('PO_Box_Address__', '');
            switch (poBoxFieldName) {
              case 'Street__s':
                poBoxFieldObj.streetLabel = curr.label;
                break;
              case 'StateCode__s':
                poBoxFieldObj.provinceLabel = curr.label;
                break;
              case 'PostalCode__s':
                poBoxFieldObj.postalCodeLabel = curr.label;
                break;
              case 'CountryCode__s':
                poBoxFieldObj.countryLabel = curr.label;
                break;
              case 'City__s':
                poBoxFieldObj.cityLabel = curr.label;
                break;
            }
          }

          if (curr.name.includes('Shipping') || curr.name.includes('Billing')) {
            fullAddressLabel = curr.name.includes('Shipping') ? 'ShippingAddress' : 'BillingAddress';
            let test = curr.name.includes('Shipping')
              ? curr.name.replace('Shipping', '')
              : curr.name.replace('Billing', '');

            switch (test) {
              case 'Street':
                obj.streetLabel = curr.label;
                break;
              case 'State':
                obj.provinceLabel = curr.label;
                break;
              case 'PostalCode':
                obj.postalCodeLabel = curr.label;
                break;
              case 'Country':
                obj.countryLabel = curr.label;
                break;
              case 'City':
                obj.cityLabel = curr.label;
                break;
            }

            if (test == 'Street' || test == 'State' || test == 'PostalCode' || test == 'Country' || test == 'City') {
              numOfAddressFields += 1;
            }
          }
        });

        if (numOfAddressFields == 5) {
          let addressLabel = fullAddressLabel.replace('Address', '');
          let indexToInsertAddress;

          stepData.fields.forEach((field, index) => {
            let name = field.name.replace(addressLabel, '');
            if (name == 'Street' || name == 'State' || name == 'PostalCode' || name == 'Country' || name == 'City') {
              //added Dmitry Bibikov to edit Account
              // if (stepData.stepName === "Billing Address Information") {
              //     field.required = true;
              // }
              //added Dmitry Bibikov to edit Account
              field.isNotVisible = true;
              indexToInsertAddress = indexToInsertAddress ? index : indexToInsertAddress;
            } else if (field.name == 'RecordTypeId') {
              field.isNotVisible = false;
              field.inputDisabled = true;
              field.value = this.currentRecordTypeId;
              //added Dmitry Bibikov to edit Account
            } else if (field.name == 'ParentId' && !this.isOpenFromListViewButton && !this.isEdit) {
              field.isNotVisible = false;
              field.inputDisabled = true;
              field.value = this.recordId;
              if (this.recordId && this.currentRecordTypeName === 'Billing') {
                getparentAccountInfo({ recordId: this.recordId }).then((result) => {
                  const parentData = JSON.parse(result);
                  if (
                    (parentData.recordTypeName === 'Business' &&
                      parentData.industry &&
                      (parentData.industry === 'Education' ||
                        parentData.industry === 'Government' ||
                        parentData.industry === 'Healthcare')) ||
                    (parentData.recordTypeName === 'Consumer' && parentData.employee)
                  ) {
                    let obj = this.fieldsArray[this.currentStep - 1].fields;
                    obj.forEach((item) => {
                      if (item.name == 'Non_pay_disconnect_exempt__c') {
                        item.value = 'Yes';
                      }
                    });
                    this.fieldsArray[this.currentStep - 1].fields = obj;
                  } else {
                    let obj = this.fieldsArray[this.currentStep - 1].fields;
                    obj.forEach((item) => {
                      if (item.name == 'Non_pay_disconnect_exempt__c') {
                        item.value = '';
                      }
                    });
                    this.fieldsArray[this.currentStep - 1].fields = obj;
                  }
                });
              }
            } else if (field.type === 'BOOLEAN') {
              field.isCheckbox = true;
            } else if (field.name.includes('PO_Box_Address__')) {
              field.isNotVisible = true;
            } else {
              field.isNotVisible = false;
            }
          });

          //insert to right place
          stepData.fields.splice(1, 0, obj, poBoxFieldObj);
        } else {
          stepData.fields.forEach((field) => {
            field.isNotVisible = false;
            if (field.name == 'RecordTypeId') {
              field.inputDisabled = true;
              field.value = this.currentRecordTypeId;
            } else if (field.name == 'ParentId' && !this.isOpenFromListViewButton && !this.isEdit) {
              field.inputDisabled = true;
              field.value = this.recordId;
              if (this.recordId && this.currentRecordTypeName === 'Billing') {
                getparentAccountInfo({ recordId: this.recordId }).then((result) => {
                  const parentData = JSON.parse(result);
                  if (
                    (parentData.recordTypeName === 'Business' &&
                      parentData.industry &&
                      (parentData.industry === 'Education' ||
                        parentData.industry === 'Government' ||
                        parentData.industry === 'Healthcare')) ||
                    (parentData.recordTypeName === 'Consumer' && parentData.employee)
                  ) {
                    let obj = this.fieldsArray[this.currentStep - 1].fields;
                    obj.forEach((item) => {
                      if (item.name == 'Non_pay_disconnect_exempt__c') {
                        item.value = 'Yes';
                      }
                    });
                    this.fieldsArray[this.currentStep - 1].fields = obj;
                  } else {
                    let obj = this.fieldsArray[this.currentStep - 1].fields;
                    obj.forEach((item) => {
                      if (item.name == 'Non_pay_disconnect_exempt__c') {
                        item.value = '';
                      }
                    });
                    this.fieldsArray[this.currentStep - 1].fields = obj;
                  }
                });
              }
            } else if (field.type === 'PHONE') {
              field.isInput = true;
              field.isTaxExemption = false;
              field.type = 'TEL';
            } else if (field.name === 'Is_Exempt_To_Tax__c') {
              //field.required = true; //Remove requred Field By Dmitry
            } else if (field.name === 'Industry__c') {
              //field.required = true; //Remove requred Field By Dmitry
              //Added US 4607
            } else if (field.type === 'BOOLEAN') {
              field.isCheckbox = true;
            } else if (field.name.includes('PO_Box_Address__')) {
              field.isNotVisible = true;
              //Added UP 006112
            } else if (field.name === "Market_Segment__c") {
              //field.required = true; //Remove requred Field By Dmitry
              //Added UP 006112
            } else {
              field.isNotVisible = false;
            }
          });
        }
      });

      //set if step has required fields
      this.fieldsArray.forEach((item) => {
        item.isValidFields = item.fields.filter(({ required }) => required).every(({ value }) => Array.isArray(value) ? value : value.length);
      });
      //added Dmitry Bibikov to edit Account
      if (this.isEdit) {
        this.showLoading = true;
        getFieldsetValues({ fieldSetsNames: this.fieldSetsNames, recordId: this.recordId })
          .then((result) => {
            this.accountData = JSON.parse(result);
            this.accountName = this.accountData[0]['Name'];
            this.currentIsTaxExemptionValue = this.accountData[0].hasOwnProperty('Is_Exempt_To_Tax__c')
              ? this.accountData[0]['Is_Exempt_To_Tax__c']
              : '';
            this.isPOBox = this.accountData[0].hasOwnProperty('Is_PO_Box__c')
              ? this.accountData[0]['Is_PO_Box__c']
              : false;

            this.fieldsArray.forEach((item) => {
              item.isValidFields = true;
              item.fields.forEach((itm) => {
                itm.value = this.accountData[0][itm.name] != 'undefined' ? this.accountData[0][itm.name] : '';

                if(itm.name === 'Is_Employee__c') {
                  const employeeIdField = item.fields.find((field) => field.name === 'Employee_ID__c');
                  if (employeeIdField) {
                    employeeIdField.required = this.accountData[0][itm.name] === 'Current' || this.accountData[0][itm.name] === 'Retiree';
                  }
                }
                // if (this.isPOBox && itm.name === 'PO_Box_Address__c') {
                //   this.validateAddress(itm.value, '', '', '');
                // }
              });
              const addressIndex = 1;
              if (this.isBillingAccount) {
                if (item.stepName === 'Billing Address Information') {
                  if (
                    this.isPOBox &&
                    this.accountData[0]['PO_Box_Address__Street__s'] !== undefined &&
                    this.accountData[0]['PO_Box_Address__City__s'] !== undefined &&
                    this.accountData[0]['PO_Box_Address__StateCode__s'] !== undefined &&
                    this.accountData[0]['PO_Box_Address__PostalCode__s'] !== undefined
                  ) {
                    item.fields[Number(addressIndex) + 1].city = this.accountData[0]['PO_Box_Address__City__s'];
                    item.fields[Number(addressIndex) + 1].country =
                      this.accountData[0]['PO_Box_Address__CountryCode__s'];
                    item.fields[Number(addressIndex) + 1].street = this.accountData[0]['PO_Box_Address__Street__s'];
                    item.fields[Number(addressIndex) + 1].state = this.accountData[0]['PO_Box_Address__StateCode__s'];
                    item.fields[Number(addressIndex) + 1].postalCode =
                      this.accountData[0]['PO_Box_Address__PostalCode__s'];

                    this.validateAddress(
                      this.accountData[0]['PO_Box_Address__Street__s'],
                      this.accountData[0]['PO_Box_Address__City__s'],
                      this.accountData[0]['PO_Box_Address__StateCode__s'],
                      this.accountData[0]['PO_Box_Address__PostalCode__s']
                    );
                  }
                  if (
                    !this.isPOBox &&
                    this.accountData[0]['BillingStreet'] != undefined &&
                    this.accountData[0]['BillingCity'] != undefined &&
                    this.accountData[0]['BillingPostalCode'] != undefined &&
                    this.accountData[0]['BillingState'] != undefined
                  ) {
                    item.fields[Number(addressIndex)].city = this.accountData[0]['BillingCity'];
                    item.fields[Number(addressIndex)].country = this.accountData[0]['BillingCountry'];
                    item.fields[Number(addressIndex)].street = this.accountData[0]['BillingStreet'];
                    item.fields[Number(addressIndex)].state = this.accountData[0]['BillingState'];
                    item.fields[Number(addressIndex)].postalCode = this.accountData[0]['BillingPostalCode'];

                    this.validateAddress(
                      this.accountData[0]['BillingStreet'],
                      this.accountData[0]['BillingCity'],
                      this.accountData[0]['BillingState'],
                      this.accountData[0]['BillingPostalCode']
                    );
                  }
                }
              } else {
                if (item.stepName === 'Shipping Address Information') {
                  item.fields[Number(addressIndex)].city = this.accountData[0]['ShippingCity'];
                  item.fields[Number(addressIndex)].country = this.accountData[0]['ShippingCountry'];
                  item.fields[Number(addressIndex)].street = this.accountData[0]['ShippingStreet'];
                  item.fields[Number(addressIndex)].state = this.accountData[0]['ShippingState'];
                  item.fields[Number(addressIndex)].postalCode = this.accountData[0]['ShippingPostalCode'];
                  if (
                    this.accountData[0]['ShippingStreet'] != undefined &&
                    this.accountData[0]['ShippingCity'] != undefined &&
                    this.accountData[0]['ShippingPostalCode'] != undefined &&
                    this.accountData[0]['ShippingState'] != undefined
                  ) {
                    this.validateAddress(
                      this.accountData[0]['ShippingStreet'],
                      this.accountData[0]['ShippingCity'],
                      this.accountData[0]['ShippingState'],
                      this.accountData[0]['ShippingPostalCode']
                    );
                  }
                }
              }
            });

            if (this.isPOBox) {
              const addressStep = this.isBillingAccount ? 2 : 1,
                apartmentField = this.fieldsArray[Number(addressStep)].fields.find(
                  (item) => item.hasOwnProperty('name') && item.name.includes('Street_2__c')
                );
              apartmentField.isNotVisible = this.isPOBox;
            }
            this.showLoading = false;
          })
          .catch((error) => {
            console.log('Get Value From Field Sets: ', error);
            this.showLoading = false;
          });
      }
    } catch (error) {
      console.log(error);
    }
    //added Dmitry Bibikov to edit Account
  }

  //Added UP 006112
  closeQuickActionComponent() {
    const closeQA = new CustomEvent("close");
    // Dispatches the event.
    this.dispatchEvent(closeQA);
  }
  //Added UP 006112

  handleClose() {
    if (this.isOpenFromListViewButton) {
      this.dispatchEvent(new CustomEvent('closetab'));
    } else {
      this.dispatchEvent(new CloseActionScreenEvent());
      //added Dmitry Bibikov to edit Account
      if (this.isEdit) {
        this.closeQuickAction();
      } else {
        window.location.reload(); //Added UP 006112
      }
      //added Dmitry Bibikov to edit Account
    }
  }


  //added Dmitry Bibikov to call Alert
  handleCloseModal() {
    this.isOpenCustomAlert = !this.isOpenCustomAlert;
  }

  handleCloseModalAlert(event) {
    this.isOpenCustomAlert = !this.isOpenCustomAlert;
    if (event.target.label === 'Yes') {
      if (this.isOpenFromListViewButton) {
        this.dispatchEvent(new CustomEvent('closetab'));
      } else {
        this.dispatchEvent(new CloseActionScreenEvent());
        if (this.isEdit) {
          this.closeQuickAction();
        } else {
          this.dispatchEvent(new CloseActionScreenEvent()); //Added UP 006112
          window.location.reload(); //Added UP 006112
        }
      }
    }
  }
  //added Dmitry Bibikov to call Alert

  handleNextOpenModal() {
    this.isOpenSelectAccountRecordTypeModal = !this.isOpenSelectAccountRecordTypeModal;
    this.isOpenModalWindow = true;
    this.getFieldsFromFieldSets();
  }

  handleCheckRecordType(event) {
    let selectedRecordTypeName = event.currentTarget.dataset.name;
    this.currentRecordTypeId = event.currentTarget.dataset.id;
    this.currentRecordTypeName = selectedRecordTypeName;
    this.accountRecordTypes.forEach((item) => {
      item.isChecked = item.Name == selectedRecordTypeName;
    });
    this.isNextButtonDisabled = false;
  }

  get isNotValidFields() {
    //added Dmitry Bibikov to edit Account
    if (this.isEdit && this.accountName && this.currentStep === '1') {
      // return false;
      return this.fieldsArray[Number(this.currentStep) - 1].fields.length
          && !this.fieldsArray[Number(this.currentStep) - 1].fields
              .filter(({ required }) => required)
              .every(({ value }) => value && Array.isArray(value) ? value : value && value?.length);
    } else {
      if (this.isBillingAccount && this.currentStep === '3') {
        return this.isDisableButton;
      } else if (!this.isBillingAccount && this.currentStep === '2') {
        return this.isDisableButton;
      } else {
        return this.fieldsArray[Number(this.currentStep) - 1].fields.length
            && !this.fieldsArray[Number(this.currentStep) - 1].fields
              .filter(({ required }) => required)
              .every(({ value }) => Array.isArray(value) ? value : value.length);
      }
    }
    //added Dmitry Bibikov to edit Account
  }

  get isFirstStep() {
    return this.currentStep == '1';
  }

  get isLastStep() {
    return this.fieldsArray && this.currentStep == this.fieldsArray.length.toString();
  }

  handleChangeField(event) {
    this.updateActiveIndicatorSteps(Number(this.currentStep));
    let currentPageStep = Number(this.currentStep);
    this.fieldsArray[currentPageStep - 1].fields.forEach((item) => {
      if (item.name == event.target.dataset.name) {
        item.value =
          item.type === 'BOOLEAN'
            ? event.target.checked
            : Array.isArray(event.target.value)
              ? event.target.value
              : event.target.value.toString().trim();
        //added Dmitry Bibikov to edit Account
        if(item.name === 'Is_Employee__c') {
          const employeeIdField = this.fieldsArray[currentPageStep - 1].fields.find((field) => field.name === 'Employee_ID__c');
          if (employeeIdField) {
            employeeIdField.required = event.target.value === 'Current' || event.target.value === 'Retiree';
          }
        }
        if (item.name === 'Name') {
          this.accountName = item.value;
        }
        if (item.name === 'ParentId') {
          if (this.currentRecordTypeName === 'Billing') {
            if (item.value) {
              getparentAccountInfo({ recordId: item.value }).then((result) => {
                const parentData = JSON.parse(result);
                if (
                  (parentData.recordTypeName === 'Business' &&
                    parentData.industry &&
                    (parentData.industry === 'Education' ||
                      parentData.industry === 'Government' ||
                      parentData.industry === 'Healthcare')) ||
                  (parentData.recordTypeName === 'Consumer' && parentData.employee)
                ) {
                  let obj = this.fieldsArray[this.currentStep - 1].fields;
                  obj.forEach((item) => {
                    if (item.name == 'Non_pay_disconnect_exempt__c') {
                      item.value = 'Yes';
                    }
                  });
                  this.fieldsArray[this.currentStep - 1].fields = obj;
                } else {
                  let obj = this.fieldsArray[this.currentStep - 1].fields;
                  obj.forEach((item) => {
                    if (item.name == 'Non_pay_disconnect_exempt__c') {
                      item.value = '';
                    }
                  });
                  this.fieldsArray[this.currentStep - 1].fields = obj;
                }
              });
            }
          }
        }
        //added Dmitry Bibikov to edit Account
        if (item.name === 'Is_PO_Box__c') {
          this.handleChangeAddressType();
        }
        // if (item.name === 'PO_Box_Address__c') {
        //   this.validateAddress(item.value, '', '', '');
        // }
      }
    });
    this.currentStep = currentPageStep.toString();
    setTimeout(() => {
      this.checkValidRequiredFields();
    }, 0);
  }

  handleChangeAddressType() {
    this.isPOBox = !this.isPOBox;
    this.fieldsArray[Number(this.currentStep) - 1].fields.forEach((item) => {
      if (item.isAddress) {
        item.street = item.city = item.country = item.state = item.postalCode = '';
      }
      if (item.hasOwnProperty('name') && item.name.includes('Street_2__c')) {
        item.isNotVisible = this.isPOBox;
      }
    });
    // const apartmentField = this.fieldsArray[Number(this.currentStep) - 1].fields.find(
    //   (item) => item.hasOwnProperty('name') && item.name.includes('Street_2__c')
    // );
    // apartmentField.isNotVisible = this.isPOBox;

    this.validateAddress('', '', '', '');
  }

  checkValidRequiredFields() {
    try {
      const allValid = [
        ...this.template.querySelectorAll('lightning-input-field'),
        ...this.template.querySelectorAll('lightning-input'),
        ...this.template.querySelectorAll('lightning-combobox')
      ].reduce((validSoFar, inputCmp) => {
        //Modified by Ryan Reddish
        let reportValidity = null;
        if (!this.isBillingAccount && !this.isEdit) {
          // reportValidity = inputCmp.fieldName === 'Is_Exempt_To_Tax__c' ? inputCmp.value.length : inputCmp.reportValidity();
        }

        // if (inputCmp.fieldName === 'Is_AMW_Customer__c') {
        //     inputCmp.required = false;
        //     console.log(inputCmp.fieldName, inputCmp.required);
        // }

        let isInputValid = true;
        if (
          inputCmp.required == true &&
          inputCmp.value == null &&
          inputCmp.fieldName != 'Finance_Charge_Exempt__c' &&
          inputCmp.fieldName != 'Is_AMW_Customer__c' &&
          inputCmp.fieldName != 'vlocity_cmt__DirectoryListed__c'
        ) {
          isInputValid = false;
        } else if (
          inputCmp.required == true &&
          inputCmp.value == '' &&
          inputCmp.fieldName != 'Finance_Charge_Exempt__c' &&
          inputCmp.fieldName != 'Is_AMW_Customer__c' &&
          inputCmp.fieldName != 'vlocity_cmt__DirectoryListed__c'
        ) {
          isInputValid = false;
        }

        if (inputCmp.fieldName === 'Employee_ID__c' && !inputCmp.required) {
          inputCmp.reportValidity();
          isInputValid = false;
        }

        // if ((inputCmp.type === 'phone' && !this.isBillingAccount) || this.isEdit) {
        //   console.log('PHONE VALIDITY CHECK');
        //   inputCmp.reportValidity();
        //   isInputValid = inputCmp.checkValidity();
        // }

        if (inputCmp.type === 'tel') {
          inputCmp.reportValidity();
          isInputValid = inputCmp.checkValidity();
        }

        if (this.isBillingAccount && !this.isEdit) {
          return validSoFar && isInputValid;
        } else {
          //return validSoFar && reportValidity && isInputValid;
          return validSoFar && isInputValid;
        }
        //Modified by Ryan Reddish
      }, true);
      this.fieldsArray[Number(this.currentStep) - 1].isValidFields = allValid;
    } catch (e) {
      handleToastEvent(this, e, 'error')
    }
  }

  handleAddressInputChange(event) {
    this.updateActiveIndicatorSteps(Number(this.currentStep));
    const isPOBoxField = event.target.dataset.box;

    let cityLabel = event.target.cityLabel,
      countryLabel = event.target.countryLabel,
      stateLabel = event.target.provinceLabel,
      postalCodeLabel = event.target.postalCodeLabel,
      streetLabel = event.target.streetLabel;
    this.addressToReturn = this.buildAddress(
      event.target.street,
      event.target.city,
      event.target.province,
      event.target.postalCode,
      event.target.country
    );
    let addressObj = {
      [streetLabel]: event.target.street,
      [cityLabel]: event.target.city,
      [postalCodeLabel]: event.target.postalCode,
      [stateLabel]: event.target.province,
      [countryLabel]: event.target.country
    };

    if (
      event.target.street != undefined &&
      event.target.city != undefined &&
      event.target.postalCode != undefined &&
      event.target.province != undefined
    ) {
      this.validateAddress(event.target.street, event.target.city, event.target.province, event.target.postalCode);
    }

    this.fieldsArray[Number(this.currentStep - 1)].fields.forEach((field) => {
      // if (field.isAddress) {
      //   let obj = {
      //     street: event.target.street,
      //     city: event.target.city,
      //     postalCode: event.target.postalCode,
      //     state: event.target.province,
      //     country: event.target.country
      //   };
      //   Object.assign(field, obj);
      // } else if (Object.keys(addressObj).includes(field.label)) {
      //   field.value = addressObj[field.label];
      // }
      //Added UP 006112
      let obj = {
        street: event.target.street,
        city: event.target.city,
        postalCode: event.target.postalCode,
        state: event.target.province,
        country: event.target.country,
      };
      if (
        isPOBoxField === "POBox" &&
        field.isPOBoxAddress &&
        field.name !== "Is_PO_Box__c"
      ) {
        Object.assign(field, obj);
      } else if (
        isPOBoxField === "NotPOBox" &&
        !field.isPOBoxAddress &&
        field.name !== "Is_PO_Box__c"
      ) {
        Object.assign(field, obj);
      }
      if (addressObj.hasOwnProperty(field.label)) {
        field.value = addressObj[field.label];
      }
      //Added UP 006112
    });
  }

  getRelatedContracts(...accountValues) {
    return getRelatedContracts({ accountId: accountValues[0], accountName: accountValues[1] });
  }

  // handleNextStep() {
  //   let currentPageStep = Number(this.currentStep);
  //   if (currentPageStep < this.fieldsArray.length) {
  //     this.moveToNextStep(currentPageStep);
  //   }
  // }

  // moveToNextStep(currentPageStep) {
  //   currentPageStep += 1;
  //   this.fieldsArray.forEach((item) => (item.isCurrentStep = item.value == currentPageStep ? true : false));
  //   this.currentStep = currentPageStep.toString();
  //   this.updateActiveIndicatorSteps(currentPageStep);
  // }

  //Added UP 006112 //
  handleNextStep() {
    let currentPageStep = Number(this.currentStep);
    if (currentPageStep < this.fieldsArray.length) {
      if (
        this.fieldsArray[Number(this.currentStep - 1)].fields.find(
          (item) => item.name === "Name"
        ) &&
        this.isEdit
      ) {
        this.showLoading = !this.showLoading;

        this.getRelatedContracts(this.recordId, this.accountName)
          .then((result) => {
            if (result.length) {
              let message =
                "A contract(s) update may be required with this account activity: " +
                "\r\n",
                messageData = [];

              result.forEach((item) => {
                messageData.push({ url: item.url, label: item.label });
                message = message + "{" + result.indexOf(item) + "}";
                if (result.indexOf(item) < result.length - 1) {
                  message = message + "\r\n";
                }
              });

              const event = new ShowToastEvent({
                title: "Contract update.",
                variant: "warning",
                message: message,
                messageData: messageData,
                mode: "sticky",
              });
              this.dispatchEvent(event);
            }

            this.moveToNextStep(currentPageStep);
          })
          .catch((error) => {
            this.handleToastEvent(error, "error", "");
          })
          .finally(() => {
            this.showLoading = !this.showLoading;
          });
      } else {
        this.moveToNextStep(currentPageStep);
      }
    }
  }

  moveToNextStep(currentPageStep) {
    currentPageStep += 1;
    this.fieldsArray.forEach(
      (item) =>
        (item.isCurrentStep = item.value == currentPageStep ? true : false)
    );
    this.currentStep = currentPageStep.toString();
    this.updateActiveIndicatorSteps(currentPageStep);
  }
  //Added UP 006112

  buildAddress(street, city, state, code, country) {
    let address = [];
    if (street && `${street.length}` > 0) {
      address.push(street);
    }
    if (city && `${city.length}` > 0) {
      address.push(city);
    }
    if (state && `${state.length}` > 0) {
      address.push(state);
    }
    if (code && `${code.length}` > 0) {
      address.push(code);
    }
    if (country && `${country.length}` > 0) {
      address.push(country);
    }

    return address;
  }

  handleBackStep() {
    let currentPageStep = Number(this.currentStep);
    if (currentPageStep > 0) {
      currentPageStep -= 1;
      this.fieldsArray.forEach((item) => (item.isCurrentStep = item.value == currentPageStep ? true : false));
    }
    this.currentStep = currentPageStep.toString();
  }

  handleSubmit() {
    this.isOpenCustomContactCreationAlert = true;
  }

  handleCloseContactAlert(event) {
    this.isOpenCustomContactCreationAlert = !this.isOpenCustomContactCreationAlert;
    const isCreateContact = event.currentTarget.dataset.creation;
    this.showLoading = !this.showLoading;
    let data = this.composeNewAccountPayload();
    createAccount({ jsonAccount: JSON.stringify(data) })
      .then((result) => {
        const accountResult = JSON.parse(result);
        this.createdAccountId = accountResult.id;
        this.createdAccountParentId = accountResult.parentAccountId;

        if (this.isEdit) {
          getRecordNotifyChange([{ recordId: this.recordId }]);
        }

        let message = this.isEdit ? 'Account has been updated successful' : 'Account has been created successfully'; //added Dmitry Bibikov to edit Account
        this.handleToastEvent(message, 'success', '');

        if (accountResult.relatedContracts.length > 0) {
          let message = 'A contract(s) update may be required with this account activity: ' + '\r\n',
            messageData = [];

          accountResult.relatedContracts.forEach((item) => {
            messageData.push({ url: item.url, label: item.label });
            message = message + '{' + accountResult.relatedContracts.indexOf(item) + '}';
            if (accountResult.relatedContracts.indexOf(item) < accountResult.relatedContracts.length - 1) {
              message = message + '\r\n';
            }
          });

          const event = new ShowToastEvent({
            title: 'Contract update.',
            variant: 'warning',
            message: message,
            messageData: messageData,
            mode: 'sticky'
          });
          this.dispatchEvent(event);
        }

        const isChangedTaxExemptionChoice = this.isEdit
          ? this.currentIsTaxExemptionValue === 'No' && accountResult.isOpenTax === 'Yes'
          : true;

        if (accountResult.isOpenTax === 'Yes' && isCreateContact === 'Yes' && isChangedTaxExemptionChoice) {
          this.isOpenModalWindow = false;
          this.isAccountTaxExemption = true;
          this.isOpenTaxExemption = true;
        } else if (accountResult.isOpenTax === 'Yes' && isCreateContact === 'No' && isChangedTaxExemptionChoice) {
          this.isOpenModalWindow = false;
          this.handleRedirectToTaxExemptionModal(this.createdAccountId, this.createdAccountParentId, '');
        } else if (
          (accountResult.isOpenTax === 'No' || accountResult.isOpenTax === null) &&
          isCreateContact === 'Yes' &&
          isChangedTaxExemptionChoice
        ) {
          this.isOpenModalWindow = false;
          this.isAccountTaxExemption = true;
        } else if (this.isEdit && isChangedTaxExemptionChoice && isCreateContact === 'Yes') {
          this.isOpenModalWindow = false;
          this.isAccountTaxExemption = true;
          this.isOpenTaxExemption = true;
        } else if (this.isEdit && !isChangedTaxExemptionChoice && isCreateContact === 'Yes') {
          this.isOpenModalWindow = false;
          this.isAccountTaxExemption = true;
        } else {
          this.updateAccountTab(accountResult.name);
          this.handleRedirectToAccountPageLayout(accountResult.id);
          //this.closeQuickActionComponent();
        }
      })
      .catch((error) => {
        let title = 'Create new account failed. Please check next error message.';
        this.handleToastEvent(title, 'error', error.body.message);
        //this.closeQuickActionComponent();
      })
      .finally(() => {
        this.showLoading = !this.showLoading;
      });
  }

  composeNewAccountPayload() {
    let result = {};
    this.fieldsArray.forEach((stepData) => {
      stepData.fields.forEach((field) => {
        //if (field.value) {  //added Dmitry Bibikov to edit Account
        result[field.name] = field.value;
        if (this.isEdit) {
          result.Id = this.recordId;
        }
        //} //added Dmitry Bibikov to edit Account
      });
    });
    return result;
  }

  handleRedirectToAccountPageLayout(accountId) {
    this[NavigationMixin.Navigate](
      {
        type: 'standard__recordPage',
        attributes: {
          recordId: accountId,
          actionName: 'view'
        }
      },
      true
    );
  }

  updateAccountTab(accountName) {
    this.dispatchEvent(new CustomEvent('updatetab', { detail: { accountName } }));
  }

  handleRedirectToTaxExemptionModal(accountId, parentAccountId, contactId) {
    this[NavigationMixin.Navigate](
      {
        type: 'standard__component',
        attributes: {
          componentName: 'c__newTaxExemptionModalComponent'
        },
        state: {
          c__accountId: accountId,
          c__parentAccountId: parentAccountId,
          c__contactId: contactId
        }
      },
      true
    );
  }

  handleToastEvent(title, variant, message) {
    const evt = new ShowToastEvent({
      title: title,
      variant: variant,
      message: message
    });
    this.dispatchEvent(evt);
  }

  showCurrentPage(event) {
    let currentPageStep = event.target.value;
    let stepNumber = Number(currentPageStep);
    this.fieldsArray.forEach((item, index) => {
      if (index + 1 === stepNumber) {
        item.isCurrentStep = true;
      } else {
        item.isCurrentStep = false;
      }
    });
    this.currentStep = stepNumber.toString();
  }

  handleCloseAlert(event) {
    this.showAlert = false;
    if (event.detail != 'close') {
      try {
        const address = this.template.querySelector('lightning-input-address');
        if (address) {
          address.focus();
        } else {
          console.log('undef');
        }
      } catch (e) {
        console.log(e);
      }
    }
  }

  updateActiveIndicatorSteps(currentPageStep) {
    this.stepsArray.forEach((item) => (item.active = Number(item.value) <= currentPageStep));
  }

  //added Dmitry Bibikov to edit Account
  closeQuickAction() {
    const edit = true;
    const selectedEvent = new CustomEvent('close', {
      detail: edit
    });
    this.dispatchEvent(selectedEvent);
  }

  validateAddress(street, city, state, code) {
    // if (street.length > 0 && city.length > 0 && state.length > 0 && code.length > 0) {
    //     this.isDisableButton = false;
    //     return this.isDisableButton;
    // } else {
    //     this.isDisableButton = true;
    //     return this.isDisableButton;
    // }
    //
    // if (this.isPOBox) {
    //   this.isDisableButton = !street.length;
    // } else {
    //   this.isDisableButton = !(street.length > 0 && city.length > 0 && state.length > 0 && code.length > 0);
    // }
    this.isDisableButton = !(street.length > 0 && city.length > 0 && state.length > 0 && code.length > 0);
    return this.isDisableButton;
  }

  // closeQuickActionComponent() {
  //   const closeQA = new CustomEvent('close');
  //   // Dispatches the event.
  //   this.dispatchEvent(closeQA);
  // }

  //added Dmitry Bibikov to edit Account
}