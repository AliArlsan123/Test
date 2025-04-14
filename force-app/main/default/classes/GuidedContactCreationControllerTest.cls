/*
* @description Test class for GuidedContactCreationController.cls
*/
@IsTest
public with sharing class GuidedContactCreationControllerTest {
    @TestSetup
    static void createTestData() {
    User u = TestDataFactory.createTestUser();
    System.runAs(u) {
        Account testAccount = new Account(Name = 'Test Account');
        insert testAccount;

        Contact testContact = new Contact(
            LastName = 'Test',
            FirstName = 'User',
            Email = 'test@abc.com',
            MailingStreet = '123 Test St',
            MailingCity = 'Test City',
            MailingState = 'CA',
            MailingPostalCode = '12345',
            MailingCountry = 'USA',
            AccountId = testAccount.Id
        );
        insert testContact;
		
        List<AccountContactRelation> existingACRs = [
            SELECT Id FROM AccountContactRelation
            WHERE ContactId = :testContact.Id AND AccountId = :testAccount.Id
        ];

        if (existingACRs.isEmpty()) {
            AccountContactRelation acr = new AccountContactRelation(
                AccountId = testAccount.Id, 
                ContactId = testContact.Id, 
                Roles = 'Primary'
            );
            insert acr;
        }
    }
}

    @IsTest
    static void getRelatedContactsTest(){
        User u = TestDataFactory.getUser();
        System.runAs(u) {
            Account testAccount = [SELECT Id FROM Account LIMIT 1];
            Test.startTest();
                String json = GuidedContactCreationController.getRelatedContacts(testAccount.Id);
                System.assert(!String.isBlank(json));
            Test.stopTest();
        }
    }

    @IsTest
    static void getRelatedContactsNoResultsTest(){
        User u = TestDataFactory.getUser();
        System.runAs(u) {
            Account newAccount = new Account(Name = 'Test Account');
            insert newAccount;
            Test.startTest();
                String json = GuidedContactCreationController.getRelatedContacts(newAccount.Id);
                System.assertEquals('There are no related Contacts', json);
            Test.stopTest();
        }
    }

    @IsTest
    static void createContactTest(){
        User u = TestDataFactory.getUser();
        System.runAs(u) {
            Contact testContact = [SELECT Id, LastName, AccountId FROM Contact LIMIT 1];
            String jsonContactTest = JSON.serialize(testContact);
            
            List<Map <String, String>> mapRoleAcc = new List<Map<String, String>>();
            List<AccountContactRelation> testACRs = [SELECT AccountId, Roles FROM AccountContactRelation WHERE ContactId =: testContact.Id];
            
            for(AccountContactRelation item : testACRs) {
                Map <String, String> accMap = new Map <String, String>();
                accMap.put('accIds', item.AccountId);
                accMap.put('role', item.Roles);
                mapRoleAcc.add(accMap);
            }
            String jsonAccountContactRelationshipTest = JSON.serialize(mapRoleAcc);
            
            Test.startTest();
                String json = GuidedContactCreationController.createContact(jsonContactTest, jsonAccountContactRelationshipTest);
                System.assert(!String.isBlank(json));
            Test.stopTest();
        }
    }

    @IsTest
    static void createContactTestInvalidJson() {
    User u = TestDataFactory.getUser();
    System.runAs(u) {
        Test.startTest();
        Boolean exceptionThrown = false;
        try {
            String json = GuidedContactCreationController.createContact('{invalidJson}', '{}');
            System.assertNotEquals(null, 'json','Response should not be null');
            System.debug('Response JSON:' + json);
        } catch (Exception e) {
            exceptionThrown = true; 
        }
        System.assert(exceptionThrown, 'Exception was expected but not thrown');
        Test.stopTest();
    }
 }



    @IsTest
    static void isCommunityExistTest(){
        User u = TestDataFactory.adminUser();
        System.runAs(u) {
            Test.startTest();
                Boolean result = GuidedContactCreationController.isCommunityExist();
                System.assertEquals(true, result);
            Test.stopTest();
        }
    }
}