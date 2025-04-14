/** 
Apex Class Name    : GuidedContactCreationController
Created Date       : 
@description       : This class is used as controller to create Contact records 
@author            : Danny Perez
Modification Log:
Ver   Date         Author                               Modification
1.0   11/1/2024    Danny Perez                          Initial Version
**/
public without sharing class GuidedContactCreationController {
    private static final Schema.DescribeFieldResult ADDRESS_COUNTRY_FIELD_RESULT = Contact.PO_Box_Address__CountryCode__s.getDescribe();
    private static final Schema.DescribeFieldResult ADDRESS_STATE_FIELD_RESULT = Contact.PO_Box_Address__StateCode__s.getDescribe();


     /** 
    @Method Name    : getRelatedContacts
    @author         : Danny Perez
    @param          accountId Id of account in salesforce
    @description    : method is used retrieve list of contacts to the account id
    @return         : returns list of related contacts to the account id
    **/
    @AuraEnabled(cacheable=true)
    public static String getRelatedContacts(Id accountId) {
        try {        
            String query = 'SELECT ContactId, Contact.Name, AccountId FROM AccountContactRelation WHERE AccountId = :accountId LIMIT 1000';

            List<AccountContactRelation> relatedContacts  =  Database.query(query, AccessLevel.USER_MODE);

            if (!relatedContacts.isEmpty()) {
                return JSON.serialize(relatedContacts);
            } else {
                return 'There are no related Contacts';
            }
        } catch (Exception e) {
            throw new AuraHandledException(e.getMessage());
        }
    }

     /** 
    @Method Name    : createContact
    @author         : Danny Perez
    @param          jsonContact json of contact information
    @param          jsonAccountContactRelationship json of relationship of contact to account in json
    @description    : method is used to create a contact through json inputs and to map to account
    @return         : returns json of the new contacts
    **/
    @AuraEnabled
    public static String createContact(String jsonContact, String jsonAccountContactRelationship) {
        try {
            Contact contact = createContact(jsonContact);
            
            String relationId = createAccountContactRelation(contact, jsonAccountContactRelationship);
            Map<String, String> result = new Map<String, String>{
                'contactId' => contact.Id,
                'relationId' => relationId,
                'contactName' => contact.FirstName +
                ' ' +
                contact.LastName
            };
            //            result.put('contactId', contact.Id);
            //            result.put('relationId', relationId);

            return JSON.serialize(result);
        } catch (Exception e) {
            System.debug('error: ' + e.getMessage());
            throw new AuraHandledException(e.getMessage());
        }
    }
    
        /** 
    @Method Name    : createContact
    @author         : Danny Perez
    @param          jsonContact json of contact information
    @description    : method is used to create a contact through json inputs
    @return         : returns json of the new contact
    **/
    public static Contact createContact(String jsonContact) {
       
        Contact contact = (Contact) JSON.deserializeStrict(jsonContact, Contact.class);
        Map<String, String> picklistMap = getPicklistMaps();

        if (contact.get('PO_Box_Address__CountryCode__s') != null && picklistMap.containsKey(contact.PO_Box_Address__CountryCode__s)){
                contact.PO_Box_Address__CountryCode__s = picklistMap.get(contact.PO_Box_Address__CountryCode__s);
        }

        if (contact.get('PO_Box_Address__StateCode__s') != null && picklistMap.containsKey(contact.PO_Box_Address__StateCode__s.toLowerCase())){
            contact.PO_Box_Address__StateCode__s = picklistMap.get(contact.PO_Box_Address__StateCode__s.toLowerCase());
        }

        if (contact.get('Is_PO_Box__c') != null) {
            if (contact.get('Is_PO_Box__c') == true) {
                contact.MailingStreet = contact.MailingCity = contact.MailingState = contact.MailingPostalCode = contact.MailingCountry = contact.Mailing_Street_2__c = null;
            } else {
                contact.PO_Box_Address__Street__s = contact.PO_Box_Address__City__s = contact.PO_Box_Address__StateCode__s = contact.PO_Box_Address__PostalCode__s = contact.PO_Box_Address__CountryCode__s = null;
            }
        }

        if (Schema.sObjectType.Contact.isCreateable() && Schema.sObjectType.Contact.fields.MailingStreet.isUpdateable()) {
            try {
                upsert contact;
            } catch (DmlException e) {
                System.debug('DML Error: ' + e.getMessage());
                throw new AuraHandledException('Failed to upsert Contact: ' + e.getMessage());
            }
        }
        return contact;
    }
        
    /** 
    @Method Name    : getPicklistMaps
    @author         : Danny Perez
    @description    : method is used to create a map of state and city picklist
    @return         : returns map string of label and value from picklist state and city
    **/
    public static Map<String, String> getPicklistMaps(){
        List<Schema.PicklistEntry> pleCountry = ADDRESS_COUNTRY_FIELD_RESULT.getPicklistValues();
        List<Schema.PicklistEntry> pleState = ADDRESS_STATE_FIELD_RESULT.getPicklistValues();
        
        Map<String, String> picklistValues = new Map<String, String>();
    
        for (Schema.PicklistEntry pickListVal : pleCountry) {
            picklistValues.put(pickListVal.getLabel(), pickListVal.getValue());
        }

        for (Schema.PicklistEntry pickListVal : pleState) {
            picklistValues.put(pickListVal.getLabel().toLowerCase(), pickListVal.getValue());
        }
        return picklistValues;
    }
    /** 
    @Method Name    : createAccountContactRelation
    @author         : Danny Perez
    @param          contact contact in salesforce
    @param          jsonAccountContactRelationship json of relationship of contact to account in json
    @description    : method is used to create a contact and account relationship
    @return         : returns ids of accountcontact
    **/
    private static String createAccountContactRelation(Contact contact, String jsonAccountContactRelationship) {
        try {
            String accountContactRelationId = '';
            System.debug('jsonAccountContactRelationship: ' + jsonAccountContactRelationship);
            System.debug(contact.Id);
        if(!String.isBlank(jsonAccountContactRelationship)){

            List<Object> body = (List<Object>) JSON.deserializeUntyped(jsonAccountContactRelationship);
            List<AccountContactRelation> acrList = new List<AccountContactRelation>();
            Map <String, String> mapRoleAcc = new Map<String, String> ();

            for(Object item : body) {
                Map<String, Object> newMap = (Map<String, Object>)item;
                mapRoleAcc.put(String.valueOf(((Id) newMap.get('accIds')).to15()), String.valueOf(newMap.get('role')));
            }

            String contactId = contact.Id;
            String contactAccountId = contact.AccountId;  
            
            String query = 'SELECT Roles FROM AccountContactRelation WHERE ContactId = :contactId  AND AccountId = :contactAccountId LIMIT 1';
         
            List<AccountContactRelation> accountContactRelations =  Database.query(query, AccessLevel.USER_MODE);
           
            if (accountContactRelations.isEmpty()) {
                AccountContactRelation newAccConRelationship = new AccountContactRelation(ContactId = contact.Id, AccountId = contact.AccountId, Roles = mapRoleAcc.get(contact.AccountId.to15()));
                acrList.add(newAccConRelationship);
            } else {
                accountContactRelations[0].Roles = mapRoleAcc.get(contact.AccountId.to15());
                acrList.add(accountContactRelations[0]);
            }
            if(Schema.sObjectType.AccountContactRelation.isCreateable() && Schema.sObjectType.AccountContactRelation.fields.Roles.isUpdateable()){
                 try {
                        upsert acrList;
                        accountContactRelationId = (String) acrList[0].Id;
                    } catch (DmlException e) {
                        System.debug('Error: ' + e.getMessage());
                        throw new AuraHandledException('Failed to upsert AccountContactRelation: ' + e.getMessage());
                    }
                }
            }

        return accountContactRelationId;
        } catch (Exception e) {
            System.debug('error: ' + e.getMessage());
            throw new AuraHandledException(e.getMessage());
        }
    }


    // /** 
    // @Method Name    : getAllContacts
    // @author         : Danny Perez
    // @param          accountId account ID in salesforce
    // @description    : method is used to get all contacts to account id
    // @return         : return list of contacts
    // **/
    // @AuraEnabled(cacheable=true)
    // public static String getAllContacts(Id accountId) {
    //     try {
    //         String query = 'SELECT Id, Name FROM Contact WHERE AccountId = :accountId LIMIT 1000';

    //         List<Contact> allContacts =  Database.query(query, AccessLevel.USER_MODE);

    //         return JSON.serialize(allContacts);
    //     } catch (Exception e) {
    //         throw new AuraHandledException(e.getMessage());
    //     }
    // }

    
     /** 
    @Method Name    : isCommunityExist
    @author         : Danny Perez
    @description    : method is used to see if community exist
    @return         : return boolean if communities exist
    **/
    @AuraEnabled
    public static Boolean isCommunityExist() {
        try {
            String query = 'SELECT Id, SiteType From Site WHERE SiteType LIKE \'%Community%\'';
            List<Object> sitesList = Database.query(query, AccessLevel.USER_MODE);

            if (!sitesList.isEmpty()) {
                String subQuery = 'SELECT Id, Status From Network WHERE Status = \'Live\'';
                List<Object> experienceSitesList = Database.query(subQuery, AccessLevel.USER_MODE);

                return !experienceSitesList.isEmpty();
            } else {
                return !sitesList.isEmpty();
            }
        } catch (Exception e) {
            System.debug('e: ' + e.getMessage());
            if (e.getTypeName() == 'QueryException' && e.getMessage().contains('sObject type \'Network\' is not supported')) {
                return false;
            } else {
                throw new AuraHandledException(e.getMessage());
            }
        }
    }

    //  /** 
    // @Method Name    : getAccountsList
    // @author         : Danny Perez
    // @description    : get list of accounts
    // @return         : return json of accounts
    // **/
    // @AuraEnabled
    // public static String getAccountsList(){
    //     List<Object> options = new List<Object>();
    //     List<Account> accounts = [SELECT Id, Name, RecordTypeId FROM Account ORDER BY Name];
    //     Set<Id> recordTypeIds = new Set<Id>();
    //     for(Account account: accounts){
    //         recordTypeIds.add(account.RecordTypeId);
    //     }
    //     List<RecordType> recordsType = [SELECT Id, Name FROM RecordType WHERE Id IN :recordTypeIds];
    //     for (Account account: accounts){
    //         for(RecordType recordType : recordsType){
    //             if(account.RecordTypeId == recordType.Id){
    //                 options.add(new Map<String, Object>{
    //                         'label' => account.Name + ' - ' + recordType.Name,
    //                         'value' => account.Id.to15(),
    //                         'show' => true
    //                 });
    //             }
    //         }
    //     }
    //     return JSON.serialize(options);
    // }
}