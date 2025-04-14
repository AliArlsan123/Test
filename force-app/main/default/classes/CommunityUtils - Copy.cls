/** 
Apex Class Name    : CommunityUtils
Created Date       : 
@description       : This class is used for community operations such as retrieving account lists and managing record type IDs.
**/
public without sharing class CommunityUtils {
    private static final String BILLING_RECORD_TYPE_ID = Schema.SObjectType.Account.getRecordTypeInfosByDeveloperName()
        .get('Billing')
        .getRecordTypeId();
	/**
     * @description Retrives a list of accounts based on the provided record type and portal access.
     * @param accountRecordType The record type of the accounts to filter.
     * @param isPortal A boolean flag indicating if the request is made from a portal user.
     * @return A JSON string representing a list of accounts with ther details like name, recordtype, and account number.
     */
    @AuraEnabled
    public static String getAccountsList(String accountRecordType, Boolean isPortal) {
        /*try {*/
            /*Id contactId = [SELECT ContactId FROM User WHERE Id = :UserInfo.getUserId() LIMIT 1].ContactId; */
            List<Object> options = new List<Object>();

            switch on accountRecordType {
                when 'Billing_Dispute' {
                    /*if (isPortal) {
                        /*for (AccountContactRelation acr : [
                            SELECT AccountId, Account.Name, Account.AccountNumber, Account.RecordType.Name
                            FROM AccountContactRelation
                            WHERE Account.RecordTypeId = :BILLING_RECORD_TYPE_ID AND ContactId = :contactId
                            ORDER BY Account.Name
                            LIMIT 10000
                        ]) {
                            options.add(
                                new Map<String, Object>{
                                    'label' => acr.Account.Name +
                                    ' - ' +
                                    acr.Account.RecordType.Name,
                                    'value' => acr.Account.Id,
                                    'show' => true,
                                    'accountNumber' => acr.Account.AccountNumber != null
                                        ? acr.Account.AccountNumber
                                        : ''
                                }
                            );
                        }
                    } else {*/
				      for (Account account : [
                            SELECT Id, Name, AccountNumber, RecordType.Name
                            FROM Account
                            WHERE RecordTypeId = :BILLING_RECORD_TYPE_ID
                            ORDER BY Name
                            LIMIT 10000
                        ]) {
                            options.add(
                                new Map<String, Object>{
                                    'label' => account.Name +
                                    ' - ' +
                                    account.RecordType?.Name,
                                    'value' => account.Id,
                                    'show' => true,
                                    'accountNumber' => String.isBlank(account.AccountNumber) ? '' : account.AccountNumber
                                }
                            );
                        }
						                }
                when else {
                    for (Account account : [
                        SELECT Id, Name, AccountNumber, RecordType.Name
                        FROM Account
                        ORDER BY Name
                        LIMIT 10000
                    ]) {
                        options.add(
                            new Map<String, Object>{
                                'label' => account.Name +
                                ' - ' +
                                account.RecordType.Name,
                                'value' => account.Id,
                                'show' => true,
                                'accountNumber' => String.isBlank(account.AccountNumber) ? '' : account.AccountNumber
                            }
                        );
                    }
                }
            }

            return JSON.serialize(options);
			    }
    /**
     * @description Retrives the Id of a Specified List view for a given SObject type and ListView name.
     * @param sObjectType The API name of the SObject.            
     * @param listViewName The name of the ListView whose Id is to be retrieved.
     * @return The Id of the ListView as a String.
     */

    @AuraEnabled
    public static String getListViewsId(String sObjectType, String listViewName) {
        try {
            return Test.isRunningTest()
                ? '0000000001'
                : [SELECT Id FROM ListView WHERE SobjectType = :sObjectType AND Name = :listViewName WITH SECURITY_ENFORCED LIMIT 1].Id;
        } catch (Exception ex) {
            System.debug(
                'Cause ::: ' +
                    ex.getCause()?.toString() +
                    ' Line Number ::: ' +
                    ex.getLineNumber()?.toString() +
                    ' Message ::: ' +
                    ex.getMessage()?.toString() +
                    ' Type ::: ' +
                    ex.getTypeName() +
                    ' Stack ::: ' +
                    ex.getStackTraceString()
            );
            throw new AuraHandledException(ex.getMessage());
        }
    }
	/**
     * @description Retrives the invoice history for a given account as a list of key-value pairs.
     *              The method queries the Billing Dispute Invoice records.
     * @param accountId the id of the account for which the invoice history needs to be fetched.
     * @return A JSON string containing the invoice history for the given account.
     */

    @AuraEnabled
    public static String getInvoiceHistory(String accountId) {
        try {
            List<Map<String, Object>> billingInvoicesList = new List<Map<String, Object>>();
            List<Billing_Dispute_Invoice__c> billingInvoices = [
                SELECT Name, Invoice_Date__c, Balance_Forward__c, Total_New_Charges__c, Total_Amount_Due__c
                FROM Billing_Dispute_Invoice__c
                WHERE Account__c = :accountId
                LIMIT 1000
            ];

            for (Billing_Dispute_Invoice__c billingInvoice : billingInvoices) {
                billingInvoicesList.add(
                    new Map<String, Object>{
                        'InvoiceNumber' => billingInvoice.Name,
                        'InvoiceDate' => billingInvoice.Invoice_Date__c,
                        'BalanceForward' => billingInvoice.Balance_Forward__c,
                        'TotalNewCharges' => billingInvoice.Total_New_Charges__c,
                        'TotalAmountDue' => billingInvoice.Total_Amount_Due__c
                    }
                );
            }
            System.debug(LoggingLevel.INFO,'billingInvoicesList: ' + billingInvoicesList);
            return JSON.serialize(billingInvoicesList);
        } catch (Exception ex) {
            System.debug(
                'Cause ::: ' +
                    ex.getCause()?.toString() +
                    ' Line Number ::: ' +
                    ex.getLineNumber()?.toString() +
                    ' Message ::: ' +
                    ex.getMessage()?.toString() +
                    ' Type ::: ' +
                    ex.getTypeName() +
                    ' Stack ::: ' +
                    ex.getStackTraceString()
            );
            throw new AuraHandledException(ex.getMessage());
        }
    }
	/**
     * @description Retrives the current balance for a specific account from the latest billing dispute.
     * @param accountId the id of the account for which the current balance needs to be retrieved.
     * @return The current balance as a string if available; otherwise, null.
     */

    @AuraEnabled
    public static String getAccountCurrentBalance(String accountId) {
        try {
            System.debug(LoggingLevel.INFO,'accountId: ' + accountId);
            List<Billing_Dispute_Invoice__c> billingInvoices = [
                SELECT Current_Balance__c
                FROM Billing_Dispute_Invoice__c
                WHERE Account__c = :accountId
				WITH SECURITY_ENFORCED
                ORDER BY Invoice_Date__c
                LIMIT 1
            ];

            if (!billingInvoices.isEmpty()) {
                return String.valueOf(billingInvoices[0].Current_Balance__c != null ? billingInvoices[0].Current_Balance__c : 0);
            }

            return '0';
        } catch (NoAccessException ex) {
		  system.debug(LoggingLevel.INFO,'Access denied for user' +UserInfo.getUserId()+ ': ' + ex.getMessage());
		  throw new AuraHandledException('Access denied: You do not have permission to view this data.');
		} catch (Exception error) {
		  system.debug(LoggingLevel.INFO,'Error occured: ' + error.getMessage());
            throw new AuraHandledException('An unexpected error occured while retrieving account balance.');
        }
    }
}
		