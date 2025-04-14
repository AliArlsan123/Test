({
  doInit: function (component, event, helper) {
    const recordId = component.get("v.recordId"),
      sObjectName = component.get("v.sObjectName");

    if (sObjectName === "Account") {
      component.set("v.accountId", recordId);
      component.set("v.showSelectAccount", false);
    }

    let workspaceAPI = component.find("workspace");
    workspaceAPI.isConsoleNavigation().then(function (response) {
      if (response) {
        workspaceAPI.getFocusedTabInfo().then(function (response) {
          let focusedTabId = response.tabId;
          workspaceAPI
            .setTabLabel({
              tabId: focusedTabId,
              label: "New Contact",
            })
            .then(function (response) {
              workspaceAPI.setTabIcon({
                icon: "standard:contact",
              });
            });
        });
      }
    });

    const getAccountsList = component.get("c.getAccountsList");
    getAccountsList.setCallback(this, function (response) {
      const state = response.getState();
      const result = response.getReturnValue();
      if (state === "SUCCESS") {
        component.set("v.accountsOptions", JSON.parse(result));
      }
    });
    $A.enqueueAction(getAccountsList);
  },

  handleChangeShowAccountDropDown: function (component, event, helper) {
    component.set("v.showAccountDropDown", true);
  },

  handleClickChangeAccount: function (component, event) {
    const id = event.currentTarget.dataset.key;
    const name = event.currentTarget.dataset.name;
    component.set("v.accountId", id);
    component.set("v.accountName", name);
    component.set("v.disableButton", true);
    component.find("accountName").set("v.value", name);
    component.set("v.showAccountDropDown", false);
    let accountList = component.get("v.accountsOptions");
    accountList.forEach((item) => {
      item.show = true;
    });
    component.set("v.disableButton", false);
  },

  handleChangeAccountName: function (component, event) {
    // This will contain the string of the "value" attribute of the selected option
    const name = event.getSource().get("v.value");
    let accountList = component.get("v.accountsOptions");

    component.set("v.disableButton", true);
    component.set("v.accountId", null);
    accountList.forEach((item) => {
      item.show = item.label
        .replace(/\s/g, "")
        .toLowerCase()
        .includes(name.replace(/\s/g, "").toLowerCase());
    });
    component.set("v.accountsOptions", accountList);
  },

  navigateToRecordPage: function (component, event, helper) {
    const workspaceAPI = component.find("workspace");
    workspaceAPI
      .getFocusedTabInfo()
      .then(function (response) {
        const focusedTabId = response.tabId;
        workspaceAPI.setTabLabel({
          tabId: focusedTabId,
          label: event.getParam("contactName"),
        });
        workspaceAPI.setTabIcon({
          tabId: focusedTabId,
          icon: "standard:contact",
        });
      })
      .catch(function (error) {
        //console.log(error);
      });
  },
  closeTab: function (component) {
    const isRecordIdDefined = $A.util.isEmpty(component.get("v.sObjectName"));
    const workspaceAPI = component.find("workspace");

    if (!isRecordIdDefined) {
      $A.get("e.force:closeQuickAction").fire();
    } else {
      workspaceAPI.isConsoleNavigation().then(function (response) {
        if (response) {
          workspaceAPI
            .getFocusedTabInfo()
            .then(function (response) {
              const focusedTabId = response.tabId;
              workspaceAPI.closeTab({ tabId: focusedTabId });
            })
            .catch(function (error) {
              //console.log(error);
            });
        } else {
          $A.get("e.force:refreshView").fire();
          window.history.back();
        }
      });
    }
  },

  next: function (component, event, helper) {
    component.set("v.showSelectAccount", false);
  },

  closeQA: function (component, event, helper) {
    const workspaceAPI = component.find("workspace");
    workspaceAPI.isConsoleNavigation().then(function (response) {
      if (!response) {
        $A.get("e.force:closeQuickAction").fire();
        $A.get("e.force:refreshView").fire();
      }
    });
  },

  destroyComponent: function (component, event, helper) {
    $A.get("e.force:refreshView").fire();
  },
});