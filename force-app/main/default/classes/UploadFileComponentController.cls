/** 
Apex Class Name    : UploadFileComponentController
Created Date       : 
@description       : This is class used as controller to manage file uploads and files in salesforce
@author            : Danny Perez
Modification Log:
Ver   Date         Author                               Modification
1.0   11/1/2024    Danny Perez                          Initial Version
**/
public without sharing class UploadFileComponentController {
    
    /** 
    Apex Class Name    : FileDataWrapper
    Created Date       : 
    @description       : This is class used as managed filedata, wrapper before saving data to salesforce
    @author            : Danny Perez
    Modification Log:
    Ver   Date         Author                               Modification
    1.0   11/1/2024    Danny Perez                          Initial Version
    **/
    public class FileDataWrapper {
        public String fileName;
        public String base64;
        public String recordId;
    }
    
     /**
    @Method Name    : createContentVersion
    @author         : Danny Perez
    @description    : create content version from files
    @param          base64 list of base64 
    @param          filename list of file names
    @return         : returns list of ContentVersion
    **/
    private static List<ContentVersion> createContentVersion(List<String> base64, List<String> filename) {
        List<ContentVersion> cvList = new List<ContentVersion>();
        
        for(Integer i=0; i < filename.size(); i++) {
            ContentVersion cv = new ContentVersion();
            cv.VersionData = EncodingUtil.base64Decode(base64[i]);
            cv.Title = filename[i];
            cv.PathOnClient = filename[i];
            cvList.add(cv);
        }
        
        try {

            Database.DMLOptions dmlOptions = new Database.DMLOptions(); 
           
            Database.SaveResult[] result = Database.insert(cvList, dmlOptions);
            if(!result[0].isSuccess()){
                for(Database.Error error : result[0].getErrors()) {
                    throw new HandledException(error.getMessage() + ' - ' + error.getFields());
                }
            }
            
            return cvList;
        } catch(Exception e) {
            System.debug('Error--'+e.getMessage());
            return null;
        }
    }

      /**
    @Method Name    : createContentDocumentLink
    @author         : Danny Perez
    @description    : create content doucment links
    @param          contentVersionIdList list of content version 
    @param          recordIdList list of record ids names
    @return         : returns list of ContentDocumentLink
    **/
    private static List<ContentDocumentLink> createContentDocumentLink(List<ContentVersion> contentVersionIdList, List<String> recordIdList) {
        Map<ID, ContentVersion> cvMap = new Map<ID, ContentVersion>([SELECT ContentDocumentId FROM ContentVersion WHERE Id =: contentVersionIdList]);
        List<ContentDocumentLink> cdList = new List<ContentDocumentLink>();
        for(Integer i=0; i < contentVersionIdList.size(); i++) {
          

            ContentDocumentLink cdl = new ContentDocumentLink();
            ContentVersion contVerse = cvMap.get(contentVersionIdList[i].Id);
			cdl.ContentDocumentId =  contVerse.ContentDocumentId;     
            cdl.LinkedEntityId = recordIdList[i];
            cdl.ShareType = 'V';
            cdl.Visibility = 'AllUsers';
            cdList.add(cdl);
        }
        try {
            
            Database.DMLOptions dmlOptions = new Database.DMLOptions(); 
           
            Database.SaveResult[] result = Database.insert(cdList, dmlOptions);
            if(!result[0].isSuccess()){
                for(Database.Error error : result[0].getErrors()) {
                    throw new HandledException(error.getMessage() + ' - ' + error.getFields());
                }
            }
            
            return cdList;
        } catch(Exception e) {
            System.debug('Error--'+e.getMessage());
            return null;
        }
    }
    

      /**
    @Method Name    : getFileInfo
    @author         : Danny Perez
    @description    : get file info
    @param          recordId list of file names
    @return         : returns string json of contentdocumentlink
    **/
    @AuraEnabled
    public static String getFileInfo(String recordId){
        String response;
        String query = 'SELECT Id,ContentDocument.Title,ContentDocument.Id FROM ContentDocumentLink WHERE LinkedEntityId =:recordId LIMIT 1';
	
        List<ContentDocumentLink> conDocLinkList = Database.query(query, AccessLevel.USER_MODE); 
        if(conDocLinkList != null && conDocLinkList.size() > 0){
            response = JSON.serialize(conDocLinkList[0]);
        }
        return response;
    }
    
     /**
    @Method Name    : handleDelete
    @author         : Danny Perez
    @description    : delete files
    @param           recordId list of file names
    @return         : returns id of deleted file
    **/
    @AuraEnabled
    public static String handleDelete(String recordId){
        String sObjName = Id.valueOf(recordId).getSObjectType().getDescribe().getName();
        SObject sObj = (SObject) Type.forName(sObjName).newInstance();
        sObj.put('Id', recordId);
        sObj.put('Button_Action_URL__c', null);
		try {
         if (Schema.sObjectType.Website_Product_Discount_Message__c.fields.Button_Action_URL__c.isUpdateable()){
            update sObj;
        } else {
		     throw new AuraHandledException('Field is not editable.');
	    }
	}  catch(Exception e) {
	     System.debug('Exception: ' +e.getMessage());
		 throw new AuraHandledException('Error occurred while processing :' + e.getMessage());
	}	 
        
        return sObj.Id;
   }
    
    /**
    @Method Name    : uploadFile
    @author         : Danny Perez
    @description    : upload files
    @param           filesMapJSON json of files
    @return         : returns status of file 
    **/
    @AuraEnabled
    public static String uploadFile(String filesMapJSON) {
        List<FileDataWrapper> filesList = (List<FileDataWrapper>) JSON.deserialize(filesMapJSON, List<FileDataWrapper>.class);
        
        List<ContentVersion> cvList = new List<ContentVersion>();
        List<ContentDocumentLink> cdlList = new List<ContentDocumentLink>();
        
        List<String> base64List = new List<String>();
        List<String> fileNameList = new List<String>();
        List<String> fileRecordIdList = new List<String>();

        for(FileDataWrapper file : filesList){
           fileNameList.add(file.fileName);
           base64List.add(file.base64);
           fileRecordIdList.add(file.recordId);        
        }
        
        
        cvList = createContentVersion(base64List, fileNameList);
        cdlList = createContentDocumentLink(cvList, fileRecordIdList);
       
        
        String sObjName = Id.valueOf(filesList[0].recordId).getSObjectType().getDescribe().getName();
        if(sObjName == 'Website_Product_Discount_Message__c'){
            ContentDistribution conDist = new ContentDistribution();
            conDist.ContentVersionId = cvList[0].Id;
            conDist.Name = filesList[0].fileName;
           
            try {
                Database.DMLOptions dmlOptions = new Database.DMLOptions();             
                Database.SaveResult result = Database.insert(conDist, dmlOptions);
                if(!result.isSuccess()){
                    List<Database.Error> error = result.getErrors();
                    throw new HandledException(error[0].getMessage() + ' - ' + error[0].getFields());
                }
                
            } catch(Exception e) {
                System.debug('Error--'+e.getMessage());
                return null;
            }

            String conDistId = conDist.Id;
            String query = 'SELECT Id,DistributionPublicUrl FROM ContentDistribution WHERE Id =: conDistId LIMIT 1';
            List <ContentDistribution> contentDistList = Database.query(query, AccessLevel.USER_MODE);
            
            SObject sObj = (SObject) Type.forName(sObjName).newInstance();
            sObj.put('Id', filesList[0].recordId);
            sObj.put('Button_Action_URL__c', contentDistList[0].DistributionPublicUrl);
            if (Schema.sObjectType.Website_Product_Discount_Message__c.fields.Button_Action_URL__c.isUpdateable()){
                update sObj ;
            }
        }
        
        if (cvList.size() > 0 || cdlList.size() > 0) { return 'success'; }
        return 'saved';
    }
}