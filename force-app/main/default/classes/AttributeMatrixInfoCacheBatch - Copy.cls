/**
 * @description       : Class used to process and cache attribute matrix information.
 * @author            : Elizabeth Sherman 
 * @last modified on  : 20/02/2025
 * @last modified by  : Naveen
**/
global class AttributeMatrixInfoCacheBatch implements Database.Batchable<sObject>, Database.Stateful {
    
    String matrixRowQuery;
    List<String> errorMessageList = new List<String>();
    String cachePartition;
    Decimal stepSequence;
    String pricingPlanCode;
    vlocity_cmt__PricingPlan__c pricingPlan;
    Map<String, Object> stepParameters;
    Set<String> rangeFields;
    Set<String> rangeAttrs;
    Map<String, Object> rangeAttrMapping = new Map<String, Object>();
    Map<String, Object> rangeFieldMapping = new Map<String, Object>();
    Map<String, Object> productCodeMapping = new Map<String, Object>();
    Map<String, Object> cacheMap = new Map<String, Object>();
    Set<String> productCodeSet = new Set<String>();
    Id matrixVersionId;
    String matrixName;
    Boolean decisionMatrix = false;
    Boolean includeAttrInfoInRangeKeys = false;
    Boolean overlappingRanges = false; 
    Set<String> attrRowInfoKeySet = new Set<String>();
    
    /**
     * @description Constructor to initialize batch class with input parameters.
     * @param input A Map<String, Object> containing necessary parameters.
     */
    global AttributeMatrixInfoCacheBatch(Map<String, Object> input) {
        initializeCachePartition();
        initializePricingPlan(input);
        initializeStepParameters(input);
        initializeMatrixInfo();
    }

    /**
     * @description Initializes cache partition
     */
    private void initializeCachePartition() {
        if (!Test.isRunningTest()) {
            cachePartition = PricingPlanHelper.getAttrMatrixInfoCachePartition();
            if (String.isBlank(cachePartition)) {
                throwException('AttrMatrixInfoCachePartition configuration setup value is not specified.');
            }
        }
    }

    /**
     * @description It initializes pricing plan details.
	 * @param input A Map<String>, Object> Contains PricingPlanCode and StepSequenceNumbers.
     */
    private void initializePricingPlan(Map<String, Object> input) {
        pricingPlanCode = (String)input.get('PricingPlanCode');
        String sequenceNums = (String)input.get('PricingPlanStepSequenceNumbers');

        if (String.isNotBlank(pricingPlanCode) && String.isNotBlank(sequenceNums)) {
            List<Decimal> seqNumList = extractSequenceNumbers(sequenceNums);
            List<vlocity_cmt__PricingPlan__c> defaultPricingPlanList = fetchPricingPlan(pricingPlanCode, seqNumList);
            pricingPlan = defaultPricingPlanList.isEmpty() ? new vlocity_cmt__PricingPlan__c() : defaultPricingPlanList[0];
        }
    }

    /**
     * @description It extracts sequence numbers from the input string.
	 * @param sequenceNums the comma seperated string contains sequenceNumbers.
	 * @return list of Decimal values parsed from inpur string.
     */
    private List<Decimal> extractSequenceNumbers(String sequenceNums) {
        List<Decimal> seqNumList = new List<Decimal>();
        for (String num : sequenceNums.split(',')) {
            if (String.isNotBlank(num)) {
                seqNumList.add(Decimal.valueOf(num.trim()));
            }
        }
        return seqNumList;
    }

     /**
     * @description It fetches the pricing plan based on the given pricing plan code and sequence numbers.
	 * @param pricingPlanCode The unique code that identifies the pricing plan.
	 * @param seqNumList A list of decimal values represents the sequence numbers for filter.
	 * @return A list of vlocity_cmt__PricingPlan__c records matches the given criteria.
     */
    private List<vlocity_cmt__PricingPlan__c> fetchPricingPlan(String pricingPlanCode, List<Decimal> seqNumList) {
        return [SELECT Id, Name, vlocity_cmt__Code__c, 
                    (SELECT Id, Name, vlocity_cmt__Sequence__c, vlocity_cmt__ImplementationName__c, vlocity_cmt__MethodName__c, 
                            vlocity_cmt__IsActive__c, vlocity_cmt__Parameters__c 
                     FROM vlocity_cmt__PricingPlanSteps__r WHERE vlocity_cmt__Sequence__c = :seqNumList) 
                FROM vlocity_cmt__PricingPlan__c WHERE vlocity_cmt__Code__c = :pricingPlanCode];
    }

    /**
     * @description Initializes step parameters from pricing plan.
	 * @param input A Map containing configuration details, including the 'DecisionMatrix'.
     */
    private void initializeStepParameters(Map<String, Object> input) {
        if (pricingPlan != null && pricingPlan.vlocity_cmt__PricingPlanSteps__r != null && !pricingPlan.vlocity_cmt__PricingPlanSteps__r.isEmpty()) {
            String parametersJson = pricingPlan.vlocity_cmt__PricingPlanSteps__r[0].vlocity_cmt__Parameters__c;
            if (String.isNotBlank(parametersJson)) {
                stepParameters = (Map<String, Object>) JSON.deserializeUntyped(parametersJson);
            }
        }
        decisionMatrix = input.containsKey('DecisionMatrix') ? Boolean.valueOf((String) stepParameters.get('DecisionMatrix')) : false;
    }

    /**
     * @description Initializes matrix-related information
     */
    private void initializeMatrixInfo() {
        if (stepParameters != null) {
            Map<String, Object> matrixInfoOutput = new Map<String, Object>();
            PricingPlanHelper.getMatrixInfo(stepParameters, matrixInfoOutput);
            
            rangeFields = (Set<String>) matrixInfoOutput.get('RangeFields');
            rangeAttrs = (Set<String>) matrixInfoOutput.get('RangeAttributes');
            matrixRowQuery = (String) matrixInfoOutput.get('MatrixRowQuery');
            matrixVersionId = (Id) matrixInfoOutput.get('MatrixVersionId');
            matrixName = (String) matrixInfoOutput.get('MatrixName');

            cacheMap.put('MatrixName', matrixName);
            cacheMap.put('MatrixVersionId', matrixVersionId);
            cacheMap.put('MatrixVersionNumber', matrixInfoOutput.get('MatrixVersionNumber'));
            cacheMap.put('MatrixPriority', matrixInfoOutput.get('MatrixPriority'));
            cacheMap.put('RangeFields', rangeFields);
            cacheMap.put('RangeAttributes', rangeAttrs);
        }
    }

    /**
     * @description Throws a custom exception.
	 * @param message error message to be set in the exception.
     */
    private void throwException(String message) {
        noDataFoundException nodata = new noDataFoundException();
        nodata.setMessage(message);
        throw nodata;
    }

    /**
     * @description Retrieves a QueryLocator for batch processing.
	 * @param bc The batchable context.
	 * @return A Database.QueryLocator used to fetch records for batch.
     */
    global Database.QueryLocator start(Database.BatchableContext bc) {
        return Database.getQueryLocator(matrixRowQuery);
    }
	
    /**
     * @description It executes the batch logic for processing attribute matrix rows.
	 * @param bc The batchable context.
	 * @param scope list of SObject records to be processed in current batch execution.
     */
    global void execute(Database.BatchableContext bc, List<sObject> scope) {
        try {
            for (SObject sObj : scope) {
                PricingPlanHelper.decisionMatrix = decisionMatrix;
                PricingPlanHelper.processMatrixRow(sObj, rangeAttrs, rangeAttrMapping, rangeFields, rangeFieldMapping, 
                                                   productCodeMapping, productCodeSet, includeAttrInfoInRangeKeys, overlappingRanges, attrRowInfoKeySet);
            }
        } catch (Exception e) {
            errorMessageList.add('Exception caught: ' + e.getMessage());
            System.debug(LoggingLevel.ERROR, e.getStackTraceString());
        }
    }

    /**
     * @description It finalizes the batch process and stores in the matrix cache.
	 * @param bc The batchable context.
     */
    global void finish(Database.BatchableContext bc) {
        try {
            cacheMap.put('ProductCodeSet', productCodeSet);
            cacheMap.put('AttrRowInfoKeySet', attrRowInfoKeySet);
            cacheMap.put('CacheTime', DateTime.now());

            List<vlocity_cmt__CachedApiResponse__c> insertList = new List<vlocity_cmt__CachedApiResponse__c>();

            for (String prodCode : productCodeSet) {
                vlocity_cmt__CachedApiResponse__c apiResp = new vlocity_cmt__CachedApiResponse__c();
                apiResp.vlocity_cmt__Code__c = matrixName;
                apiResp.vlocity_cmt__Type__c = 'CompiledCalculationMatrix';
                apiResp.vlocity_cmt__CacheKey__c = PricingPlanHelper.generateCacheKey(String.valueOf(matrixVersionId) + prodCode);
                apiResp.vlocity_cmt__ApiResponse__c = JSON.serialize(productCodeMapping.get(prodCode));
                apiResp.vlocity_cmt__OverflowSequence__c = 1;
                insertList.add(apiResp);
            }
            if (!insertList.isEmpty()) {
			  try {
                insert insertList;
            } catch (DmlException dmlEx) {
			     System.debug('DML Exception occurred during insert in finish method: ' +dmlEx.getMessage());
			}
		 }	
        } catch (Exception ex) {
            System.debug('Exception in finish method: ' + ex.getMessage());
        }
    }
    private void deleteExistingCacheEntries(Map<String, String> cachekeys){
        if(!cacheKeys.isEmpty()){
                delete [SELECT Id FROM vlocity_cmt__CachedApiResponse__c WHERE vlocity_cmt__CacheKey__c = :cacheKeys.values()];
            }
    }
}