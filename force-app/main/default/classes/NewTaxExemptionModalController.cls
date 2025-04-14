/**
 * Created by nikolay on 1/31/23.
 */
/**
 * @description Apex controller used on New Tax Exemption and Edit Tax Exemption modal windows.
 * Create and edit Tax Exemption and Tax Exemption Item records
 * Upload files, relate its with Tax Exemption Item records and delete files related with Tax Exemption Item records.
 */
public without sharing class NewTaxExemptionModalController {
    private static final List<String> ACCOUNT_TAX_EXEMPTION_RECORD_TYPES = new List<String>{ 'Business', 'Consumer' };

    /**
     * @description Method to get Account records to Tax Exemption opened from List View that
     * @return Account data in String format.
     */
    @AuraEnabled
    public static String getAllAccount() {
        try {
            List<Map<String, Object>> allAccountsList = new List<Map<String, Object>>();
            List<Account> accList = [
                SELECT Id, Name
                FROM Account
                WHERE RecordType.Name IN :ACCOUNT_TAX_EXEMPTION_RECORD_TYPES
                LIMIT 50000
            ];
            for (Account acc : accList) {
                allAccountsList.add(new Map<String, Object>{ 'id' => acc.Id, 'name' => acc.Name });
            }
            return JSON.serialize(allAccountsList);
        } catch (Exception e) {
            System.debug('e: ' + e);
            throw new AuraHandledException(e.getMessage());
        }
    }
    /** 
    @Method Name getRelatedContacts
    @description Method to get Account related contacts records to Tax Exemption opened from List View that
	@param  accountId
    @return contactMapList-json of the contact id and contact name related to the accountId
    */
    @AuraEnabled
    public static String getRelatedContacts(String accountId) {
        try {
            List<Account> parentAccount = [SELECT Id, ParentId FROM Account WHERE Id = :accountId LIMIT 1];
            List<Map<String, Object>> contactMapList = new List<Map<String, Object>>();
            Set<String> accountIdsSet = new Set<String>{ accountId, parentAccount.get(0).ParentId };
                List<AccountContactRelation> accRelList = [
                    SELECT ContactId, Contact.Name
                    FROM AccountContactRelation
                    WHERE AccountId IN :accountIdsSet
                    LIMIT 10000
                ];
            for (AccountContactRelation contact : accRelList) {
                contactMapList.add(
                    new Map<String, Object>{ 'id' => contact.ContactId, 'name' => contact.Contact.Name }
                );
            }
            return JSON.serialize(contactMapList);
        } catch (Exception e) {
            System.debug('e: ' + e);
            throw new AuraHandledException(e.getMessage());
        }
    }

    /**
     * @description Method to upsert Tax Exemption record with
     * @param jsonTaxExemption that
     * @return Tax Exemption's Id.
     */
    @AuraEnabled
    public static Map<String, Object> upsertTaxExemptionAndTaxExemptionItem(String jsonTaxExemption) {
        try {
            Tax_Exemption__c taxExemption = new Tax_Exemption__c();
            taxExemption = (Tax_Exemption__c) JSON.deserializeStrict(jsonTaxExemption, Tax_Exemption__c.class);

            upsert taxExemption;

            Tax_Exemption__c selectedTaxExemption = [
                SELECT Id, Name
                FROM Tax_Exemption__c
                WHERE Id = :taxExemption.Id
                WITH USER_MODE
                LIMIT 1 
            ];

            return new Map<String, Object>{ 'id' => selectedTaxExemption.Id, 'name' => selectedTaxExemption.Name };
        } catch (Exception e) {
            System.debug('e: ' + e);
            throw new AuraHandledException(e.getMessage());
        }
    }

    /**
     * @description Method to upsert Tax Exemption Item record and upload/delete files with
     * @param taxExemptionId and
     * @param jsonTaxExemptionItem and
     * @param jsonTaxExemptionFiles that
     * @return Tax Exemption Item's Id.
     */
    @AuraEnabled
    public static String upsertTaxExemptionItem(
        String taxExemptionId,
        String jsonTaxExemptionItem,
        String jsonTaxExemptionFiles
    ) {
        Savepoint sp =Database.setSavepoint();
		try {
            Tax_Exemption_Item__c newTaxExemptionItem = (Tax_Exemption_Item__c) JSON.deserializeStrict(
                jsonTaxExemptionItem,
                Tax_Exemption_Item__c.class
            );
            if (newTaxExemptionItem.get('Id') == null) {
                newTaxExemptionItem.Tax_Exemption__c = taxExemptionId;
            }

            upsert newTaxExemptionItem;

            return uploadTaxExemptionItemFile(newTaxExemptionItem.Id, jsonTaxExemptionFiles);

        } catch (Exception e) {
		    Database.rollback(sp);
            System.debug('Error occurred in upsertTaxExemptionItem: ' + e.getMessage());
            throw new AuraHandledException( e.getMessage());
			
    }
}

    /**
     * @description Method to upload/delete files related with Tax Exemption Item record with
     * @param newTaxExemptionItemId and
     * @param jsonTaxExemptionFiles that
     * @return Tax Exemption Item's Id.
     */
    @TestVisible
    private static String uploadTaxExemptionItemFile(String newTaxExemptionItemId, String jsonTaxExemptionFiles) {
        try {
            List<FileDataWrapper> filesList = new List<NewTaxExemptionModalController.FileDataWrapper>();

            if (!String.isBlank(jsonTaxExemptionFiles)) {
                filesList = (List<FileDataWrapper>) JSON.deserialize(
                    jsonTaxExemptionFiles,
                    List<FileDataWrapper>.class
                );

                List<ContentVersion> contentVersionsMap = createContentVersions(newTaxExemptionItemId, filesList);

                createContentDocumentLink(newTaxExemptionItemId, contentVersionsMap);
            }

            return newTaxExemptionItemId;
        } catch (Exception e) {
            System.debug('e: ' + e);
            throw new AuraHandledException(e.getMessage());
        }
    }

    /**
     * @description Method to create ContentVersion records related with Tax Exemption Item record with
     * @param newTaxExemptionItemId and
     * @param filesList that
     * @return list of created ContentVersion records.
     */
    private static List<ContentVersion> createContentVersions(
        String newTaxExemptionItemId,
        List<FileDataWrapper> filesList
    ) {
        try {
            List<ContentVersion> contentVersionList = new List<ContentVersion>();

            Set<String> filesToDelete = new Set<String>();
            Set<String> allFilesToDelete = new Set<String>();
            Set<String> editFilesToDelete = new Set<String>();
            Boolean isAllFilesDelete = false;

            List<ContentDocumentLink> checkContentDocumentsToDelete = [
                SELECT ContentDocumentId
                FROM ContentDocumentLink
                WHERE LinkedEntityId = :newTaxExemptionItemId
            ];
            for (ContentDocumentLink cdl : checkContentDocumentsToDelete) {
                allFilesToDelete.add(cdl.ContentDocumentId);
            }
            
            for (FileDataWrapper file : filesList) {
                if (file.contentDocumentId == null) {
                    ContentVersion cv = new ContentVersion(
                        VersionData = EncodingUtil.base64Decode(file.base64),
                        Title = file.fileName,
                        PathOnClient = file.fileName
                    );
                    contentVersionList.add(cv);
                }
                else{
                    editFilesToDelete.add(file.contentDocumentId);
                }
            }
            
            isAllFilesDelete = editFilesToDelete.isEmpty();
            
            filesToDelete = !editFilesToDelete.isEmpty() ? editFilesToDelete : allFilesToDelete;
            
            if (!filesToDelete.isEmpty()) {
                checkFilesToDelete(filesToDelete, newTaxExemptionItemId, isAllFilesDelete);
            }
            if(!contentVersionList.isEmpty()){
                insert contentVersionList;
            }
            
            return contentVersionList;
        } catch (Exception e) {
            System.debug('e: ' + e);
            throw new AuraHandledException(e.getMessage());
        }
    }

    /**
     * @description Method to delete ContentDocument and ContentDocumentLink records related with Tax Exemption Item record with
     * @param filesToDelete and
     * @param newTaxExemptionItemId and
     * @param isAllFilesDelete and
     */
    @TestVisible
    private static void checkFilesToDelete(
        Set<String> filesToDelete,
        String newTaxExemptionItemId,
        Boolean isAllFilesDelete
    ) {
        try {
            List<ContentDocumentLink> contentDocumentLinksToDelete = new List<ContentDocumentLink>();
            contentDocumentLinksToDelete = [
                SELECT LinkedEntityId, ContentDocumentId
                FROM ContentDocumentLink
                WHERE ContentDocumentId IN :filesToDelete AND LinkedEntityId = :newTaxExemptionItemId
                LIMIT 1000
            ];

            Set<Id> contentDocumentIdsToDelete = new Set<Id>();

            for (ContentDocumentLink cdl : contentDocumentLinksToDelete) {
                contentDocumentIdsToDelete.add(cdl.ContentDocumentId);
            }

            List<ContentDocument> contentDocumentsToDelete = [
                SELECT Title
                FROM ContentDocument
                WHERE Id IN :contentDocumentIdsToDelete
                LIMIT 1000
            ];

            if (!contentDocumentLinksToDelete.isEmpty()) {
                delete contentDocumentLinksToDelete;
            }

            if (!contentDocumentsToDelete.isEmpty()) {
                delete contentDocumentsToDelete;
            }
        } catch (Exception e) {
            System.debug('e: ' + e);
            throw new AuraHandledException(e.getMessage());
        }
    }

    /**
     * @description This method creates contentdocumentlink records to associate ContentDocument objects
     * @param newTaxExemptionItemId The ID of the entity.
     * @param contentVersionsMap A map of ContentVersion objects,where key is the Id of the ContentVersion.
     */
    private static void createContentDocumentLink(
        String newTaxExemptionItemId,
        List<ContentVersion> contentVersionsMap
    ) {
        try {
            List<ContentDocumentLink> contentDocumentLinkList = new List<ContentDocumentLink>();

            Set<Id> contentDocumentIdsSet = new Map<Id, ContentVersion>(contentVersionsMap).keySet();

            for (ContentVersion cv : [
                SELECT Id, ContentDocumentId
                FROM ContentVersion
                WHERE Id IN :contentDocumentIdsSet
				WITH SECURITY_ENFORCED
            ]) {
                ContentDocumentLink cdl = new ContentDocumentLink(
                    ContentDocumentId = cv.ContentDocumentId,
                    LinkedEntityId = newTaxExemptionItemId,
                    ShareType = 'V',
                    Visibility = 'AllUsers'
                );

                contentDocumentLinkList.add(cdl);
            }

            insert contentDocumentLinkList;
        } catch (Exception e) {
            System.debug('Error: ' + e.getMessage());
            throw new AuraHandledException('You do not have the required permissions.');
        }
    }
    /**
     * @description Method to get Tax Exemption record by Tax Exemption's Id to Edit Tax Exemption modal wizard with
     * @param taxExemptionId that
     * @return Tax Exemption data in String format.
     */
    @AuraEnabled
    public static String getTaxExemptionRecord(String taxExemptionId) {
        try {
            Tax_Exemption__c taxExemptionRecord = [
                SELECT Id, Name, Account__c
                FROM Tax_Exemption__c
                WHERE Id = :taxExemptionId
                LIMIT 1
            ];

            List<Map<String, Object>> relatedContacts = getContactRecords(taxExemptionRecord.Account__c);

            Map<String, Object> selectedTaxExemption = new Map<String, Object>{
                'id' => taxExemptionRecord.Id,
                'taxExemptionName' => taxExemptionRecord.Name,
                'accountId' => taxExemptionRecord.Account__c,
                'relatedContacts' => relatedContacts
            };

            return JSON.serialize(selectedTaxExemption);
        } catch (Exception e) {
            System.debug('e: ' + e);
            throw new AuraHandledException(e.getMessage());
        }
    }

    /**
     * @description Method to get Contact records by Account's Id related with Tax Exemption record to Edit Tax Exemption modal wizard with
     * @param accountId that
     * @return Contact data in String format.
     */
    @TestVisible
    private static List<Map<String, Object>> getContactRecords(Id accountId) {
        try {
            List<Map<String, Object>> relatedContacts = new List<Map<String, Object>>();

            Id parentAccountId = [SELECT ParentId FROM Account WHERE Id = :accountId LIMIT 1].ParentId;
            Set<String> accountIdsSet = new Set<String>{ accountId, parentAccountId };
            for (AccountContactRelation contact : [
                SELECT ContactId, Contact.Name
                FROM AccountContactRelation
                WHERE AccountId IN :accountIdsSet
                LIMIT 10000
            ]) {
                relatedContacts.add(
                    new Map<String, Object>{ 'id' => contact.ContactId, 'name' => contact.Contact.Name }
                );
            }

            return relatedContacts;
        } catch (Exception e) {
            System.debug('e: ' + e);
            throw new AuraHandledException(e.getMessage());
        }
    }

    /**
     * @description Method to get Tax Exemption Item records by Tax Exemption's Id to Edit Tax Exemption modal wizard with
     * @param taxExemptionId that
     * @return Tax Exemption Items data in String format.
     */
    @AuraEnabled
    public static String getTaxExemptionItemRecords(String taxExemptionId) {
        try {
            List<Tax_Exemption_Item__c> taxExemptionItemList = [
                SELECT
                    Id,
                    Tax_Exemption_Item_Type__c,
                    Tax_Exemption_Item_Id_Name__c,
                    Tax_Id__c,
                    RecordType.Name,
                    Status__c,
                    Reminder_Delay__c,
                    Contact__c,
                    Contact__r.Name,
                    Is_Item_Expirable__c
                FROM Tax_Exemption_Item__c
                WHERE Tax_Exemption__c = :taxExemptionId
            ];

            List<Map<String, Object>> taxExemptionItemMapList = new List<Map<String, Object>>();

            for (Tax_Exemption_Item__c taxExemptionItem : taxExemptionItemList) {
                Map<String, Object> taxExemptionItemMap = new Map<String, Object>{
                    'id' => taxExemptionItem.Id,
                    'itemType' => taxExemptionItem.Tax_Exemption_Item_Type__c,
                    'itemName' => taxExemptionItem.Tax_Exemption_Item_Id_Name__c,
                    'taxId' => taxExemptionItem.Tax_Id__c,
                    'arrayType' => taxExemptionItem.RecordType.Name == 'Federal Tax Exemption Item'
                        ? 'federal'
                        : 'state',
                    'status' => taxExemptionItem.Status__c,
                    'reminderDelay' => taxExemptionItem.Reminder_Delay__c,
                    'contactId' => taxExemptionItem.Contact__c,
                    'contactName' => taxExemptionItem.Contact__r.Name,
                    'isItemExpirable' => taxExemptionItem.Is_Item_Expirable__c,
                    'isRelateToContact' => taxExemptionItem.Contact__c != null
                };
                taxExemptionItemMapList.add(taxExemptionItemMap);
            }

            Set<Id> selectedTaxExemptionItemIds = new Map<Id, Tax_Exemption_Item__c>(taxExemptionItemList).keySet();

            List<Map<String, Object>> taxExemptionItemFiles = getTaxExemptionItemFiles(selectedTaxExemptionItemIds);

            Map<String, Object> taxExemptionItems = new Map<String, Object>{
                'taxExemptionItem' => taxExemptionItemMapList,
                'files' => taxExemptionItemFiles
            };

            return JSON.serialize(taxExemptionItems);
        } catch (Exception e) {
            System.debug('e: ' + e);
            throw new AuraHandledException(e.getMessage());
        }
    }

    /**
     * @description Method to get files related with Tax Exemption Item records to Edit Tax Exemption modal wizard with
     * @param selectedTaxExemptionItemIds that
     * @return list of queried files.
     */
    @TestVisible
    private static List<Map<String, Object>> getTaxExemptionItemFiles(Set<Id> selectedTaxExemptionItemIds) {
        try {
            Set<Id> contentDocumentIds = new Set<Id>();
            Map<Id, Id> contentDocumentIdsMap = new Map<Id, Id>();
            List<Map<String, Object>> taxExemptionItemFiles = new List<Map<String, Object>>();

            for (ContentDocumentLink cdl : [
                SELECT ContentDocumentId, LinkedEntityId
                FROM ContentDocumentLink
                WHERE LinkedEntityId IN :selectedTaxExemptionItemIds
                LIMIT 1000
            ]) {
                contentDocumentIds.add(cdl.ContentDocumentId);
                contentDocumentIdsMap.put(cdl.ContentDocumentId, cdl.LinkedEntityId);
            }

            for (ContentVersion cv : [
                SELECT Id, Title, ContentDocumentId
                FROM ContentVersion
                WHERE ContentDocumentId IN :contentDocumentIds AND IsLatest = TRUE
                LIMIT 1000
            ]) {
                Map<String, Object> taxExemptionItemFile = new Map<String, Object>{
                    String.valueOf(contentDocumentIdsMap.get(cv.ContentDocumentId)) => cv
                };
                taxExemptionItemFiles.add(taxExemptionItemFile);
            }

            return taxExemptionItemFiles;
        } catch (Exception e) {
            System.debug('e: ' + e);
            throw new AuraHandledException(e.getMessage());
        }
    }

    /**
     * @description Method to delete Tax Exemption Item records by Tax Exemption's Id with
     * @param taxExemptionId and
     * @param jsonTaxExemptionIdList that
     * @return 'Success'.
     */
    @AuraEnabled
    public static String deleteTaxExemptionItemRecords(String taxExemptionId, String jsonTaxExemptionIdList) {
        try {
            List<String> taxExemptionItemIds = (List<String>) JSON.deserializeStrict(
                jsonTaxExemptionIdList,
                List<String>.class
            );

            List<Tax_Exemption_Item__c> taxExemptionItemsToDelete = [
                SELECT Id
                FROM Tax_Exemption_Item__c
                WHERE Tax_Exemption__c = :taxExemptionId AND Id NOT IN :taxExemptionItemIds
                LIMIT 10000
            ];

            Set<Id> taxExemptionItemIdsToDelete = (new Map<Id, Tax_Exemption_Item__c>(taxExemptionItemsToDelete))
                .keySet();

            if (!taxExemptionItemsToDelete.isEmpty()) {
                deleteTaxExemptionItemFiles(taxExemptionItemIdsToDelete);
                delete taxExemptionItemsToDelete;
            }

            return 'Success';
        } catch (Exception e) {
            System.debug('e: ' + e);
            throw new AuraHandledException(e.getMessage());
        }
    }

    /**
     * @description Method to delete Tax Exemption Item files with
     * @param taxExemptionItemIds and
     */
    @TestVisible
    private static void deleteTaxExemptionItemFiles(Set<Id> taxExemptionItemIds) {
        try {
            Set<Id> contentDocumentIdsToDelete = new Set<Id>();

            for (ContentDocumentLink cdl : [
                SELECT Id, LinkedEntityId, ContentDocumentId
                FROM ContentDocumentLink
                WHERE LinkedEntityId IN :taxExemptionItemIds
                LIMIT 10000
            ]) {
                contentDocumentIdsToDelete.add(cdl.ContentDocumentId);
            }

            List<ContentDocument> contentDocumentsToDelete = [
                SELECT Id
                FROM ContentDocument
                WHERE Id IN :contentDocumentIdsToDelete
                LIMIT 10000
            ];

            if (!contentDocumentsToDelete.isEmpty()) {
                delete contentDocumentsToDelete;
            }
        } catch (Exception e) {
            System.debug('e: ' + e);
            throw new AuraHandledException(e.getMessage());
        }
    }

    /**
     * @description Wrapper for creation ContentVersion records.
     */
    public class FileDataWrapper {
        public String fileName;
        public String base64;
        public String recordId;
        public String contentDocumentId;
    }
}