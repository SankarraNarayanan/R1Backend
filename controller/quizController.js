/*
 * Trinom Digital Pvt Ltd ("COMPANY") CONFIDENTIAL                             *
 * Copyright (c) 2024 Trinom Digital Pvt Ltd, All rights reserved              *
 *                                                                             *
 * NOTICE:  All information contained herein is, and remains the property      *
 * of COMPANY. The intellectual and technical concepts contained herein are    *
 * proprietary to COMPANY and may be covered by Indian and Foreign Patents,    *
 * patents in process, and are protected by trade secret or copyright law.     *
 * Dissemination of this information or reproduction of this material is       *
 * strictly forbidden unless prior written permission is obtained from         *
 * COMPANY. Access to the source code contained herein is hereby forbidden     *
 * to anyone except current COMPANY employees, managers or contractors who     *
 * have executed Confidentiality and Non-disclosure agreements explicitly      *
 * covering such access.                                                       *
 *                                                                             *
 * The copyright notice above does not evidence any actual or intended         *
 * publication or disclosure of this source code, which includes               *
 * information that is confidential and/or proprietary, and is a trade secret, *
 * of COMPANY. ANY REPRODUCTION, MODIFICATION, DISTRIBUTION, PUBLIC            *
 * PERFORMANCE, OR PUBLIC DISPLAY OF OR THROUGH USE OF THIS SOURCE CODE        *
 * WITHOUT THE EXPRESS WRITTEN CONSENT OF COMPANY IS STRICTLY PROHIBITED,      *
 * AND IN VIOLATION OF APPLICABLE LAWS AND INTERNATIONAL TREATIES. THE         *
 * RECEIPT OR POSSESSION OF THIS SOURCE CODE AND/OR RELATED INFORMATION DOES   *
 * NOT CONVEY OR IMPLY ANY RIGHTS TO REPRODUCE, DISCLOSE OR DISTRIBUTE ITS     *
 * CONTENTS, OR TO MANUFACTURE, USE, OR SELL ANYTHING THAT IT MAY DESCRIBE,    *
 * IN WHOLE OR IN PART.                                                        *
 *                                                                             *
 * File: \controller\quizController.js                                         *
 * Project: r1-backend                                                         *
 * Created Date: Wednesday, December 25th 2024, 8:23:44 pm                     *
 * Author: Sankarra Narayanan G <sankar@codestax.ai>                           *
 * -----                                                                       *
 * Last Modified: December 26th 2024, 11:38:19 am                              *
 * Modified By: Sankarra Narayanan G                                           *
 * -----                                                                       *
 * Any app that can be written in JavaScript,                                  *
 *     will eventually be written in JavaScript !!                             *
 * -----                                                                       *
 * HISTORY:                                                                    *
 * Date         By  Comments                                                   *
 * --------------------------------------------------------------------------- *
 */

const { DynamoDBClient } = require("@aws-sdk/client-dynamodb");
const { PutCommand, DynamoDBDocumentClient, GetCommand } = require("@aws-sdk/lib-dynamodb");
const { verifyLink, updateStatusAfterQnGenerated, updateStartEndTime } = require("../utils/verifyLinkHelper");
const { questionGenerator } = require('../AiController/questionGenerator');
const { fromSSO } = require('@aws-sdk/credential-providers');
const dynamoDBClient = new DynamoDBClient({
    region: process.env.AWS_REGION,
    //credentials: fromSSO({ profile: 'default' }),
});
const docClient = DynamoDBDocumentClient.from(dynamoDBClient);
const { getJDDetails } = require('./jdController')
const { evaluateUserAnswers, uploadToOpenAIFromBuffer, generateVerdict } = require('../AiController/questionEvaluator');

const putQuestions = async function (resumeId, questions) {
    try {
        if (!resumeId) {
            return {
                status: false,
                message: 'resumeId is required'
            };
        }
        if (!Array.isArray(questions)) {
            return {
                status: true,
                message: 'The questions field must be a list.'
            };
        }

        const command = new PutCommand({
            TableName: process.env.TABLENAME,
            Item: {
              PK: resumeId,
              SK: "QUESTIONS",
              questions,
              createdAt: Math.floor(Date.now() / 1000)
            },
        });

        await docClient.send(command);
        return {
            status: true,
            message: 'Question added successfully'
        };
    } catch (error) {
        console.error("Error putting questions:", error);
        return {
            status: false,
            message: 'Error adding question'
        }
    }
};

const generateQuestions = async function (req,res){
    try {
        let { resumeId,jdId } = req.body;
        if(!resumeId || !jdId){
            return res.status(400).json({ error: 'Missing Rquired Params resumeId, jdId ' });
        }
        let command = new GetCommand({
            TableName: process.env.TABLENAME,
            Key: {
              PK: 'JD',
              SK: jdId,
            },
        });

        let jdResponse = await docClient.send(command);
        let jdDetails = jdResponse.Item || {};
        if(!jdDetails.fileId){
            return res.status(400).json({ error: 'JD file id missing.' });
        }
        command = new GetCommand({
            TableName: process.env.TABLENAME,
            Key: {
              PK: jdId,
              SK: resumeId,
            },
        });

        let resumeResponse = await docClient.send(command);
        let resumeDetails = resumeResponse.Item || {};
        if(!resumeDetails.fileId){
            return res.status(400).json({ error: 'Resume file id missing.' });
        }
        let geneartedQuestions = await questionGenerator(resumeDetails.fileId,jdDetails.fileId);
        let parsedQuestions = JSON.parse(geneartedQuestions);
        if(!parsedQuestions.questions){
            return res.status(400).json({ error: 'Error generating Questions' });
        }
        let putQuest = await putQuestions(resumeId,parsedQuestions.questions);
        if(!putQuest.status){
            return res.status(400).json({ error: 'Error Putting Questions in DynamoDb.' });
        }
        let changeStatus = await updateStatusAfterQnGenerated(jdId, resumeId);
        return res.status(200).json({ message: 'Question Generated Succesfully'});
    } catch (error) {
        console.error("Error Generating question:", error);
        return res.status(500).json({ error: 'Error Generating question' });
    }
};

const submitQuestion = async function(req,res){
    try {
        let { linkId,questionId,selectedOptionId } = req.body;
        if(!linkId || !questionId || !selectedOptionId){
            return res.status(400).json({ error: 'Missing Rquired Params linkId, questionId selectedOptionId' });
        }

        let verify = await verifyLink(linkId);
        if(!verify.status){
            return res.status(400).json({ error: 'Your Link is not active' });
        }

        let resumeId = verify.data.resumeId;
        const command = new GetCommand({
            TableName: process.env.TABLENAME,
            Key: {
              PK: resumeId,
              SK: "USER_ANSWERS",
            },
        });

        let answerResponse = await docClient.send(command);
        const item = answerResponse.Item || {}; 
        const updatedAnswers = item.answers || {}; 
        updatedAnswers[questionId] = selectedOptionId;

        const putCommand = new PutCommand({
            TableName: process.env.TABLENAME,
            Item: {
                PK: resumeId,
                SK: "USER_ANSWERS",
                answers: updatedAnswers, 
            },
        });

        await docClient.send(putCommand);
        return res.status(200).json({ messsage: 'Question Submitted Succesfully' });
    } catch (error) {
        console.error("Error Submiting question:", error);
        return res.status(500).json({ error: 'Error Submiting question' });
    }
}

const startTest = async function(req, res){

}

const getQuestionsWithLinkId = async function (req,res){
    console.log(`[INFO][getQuestionsWithLinkId] API Entry Time ${Date.now()}`);
    try {
        let { linkId } = req.params;
        if(!linkId){
            return res.status(400).json({ error: 'Missing linkId' });
        }

        let verify = await verifyLink(linkId);
        console.log('verify', verify);
        if(!verify.status){
            console.log(`[ERROR][getQuestionsWithLinkId] Your Link is not active ${Date.now()}`);
            return res.status(400).json({ error: 'Your Link is not active' });
        } else {
            let questions = await getQuestionsWithResumeId(verify.data.resumeId);
            if(!questions.status){
                console.log(`[ERROR][getQuestionsWithLinkId] Your Error getting Questions ${Date.now()}`);
                return res.status(400).json({ error: 'Error getting Questions' });
            }
            let questionsList = questions.data.questions;
            if(!questionsList){
                return res.status(200).json({ data: [] });
            }
            let questionsWithoutAnswer =  questionsList.map(question=>{
                let {answer, ...questionWithoutAns} = question;
                return questionWithoutAns;
            });
            
            console.log(`[INFO][getQuestionsWithLinkId] Executed Successfully ${Date.now()}`);
            let endTimeDetails= {};
            if ( verify.data.status == 'ACTIVE') {
                endTimeDetails = {
                    startTime: verify.startTime,
                    endTime: verify.endTime
                }
            } else if (verify.data.status == 'INPROGRESS') {
                endTimeDetails = {
                    startTime: verify.data.startTime,
                    endTime: verify.data.endTime
                }
            }
            return res.status(200).json({ 
                date: Date.now(), 
                questions: questionsWithoutAnswer, 
                endTimeDetails: endTimeDetails
            });
        }
    } catch (error) {
        console.log('ERROR in getQuestionsWithLinkId ::',error)
        return res.status(500).json({ error: 'Error getting question', date: Date.now() });
    }
};


const getQuestionsWithResumeId = async function(resumeId){
    try {
        if (!resumeId) {
            return {
                status: false,
                message: 'resumeId is required'
            };
        }

        const command = new GetCommand({
            TableName: process.env.TABLENAME,
            Key: {
                PK: resumeId,
                SK: "QUESTIONS",
            },
        });

        let response = await docClient.send(command);
        return {
            status : true,
            data: response.Item,
            message : 'Question got successfully'
        };
    } catch (error) {
        console.error("Error getting questions:", error);
        return {
            status: false,
            message: 'Error getting question'
        }
    }
}

const getLinkDetails = async function (linkId){
    try {
        if (!linkId) {
            return {
                status: false,
                message: 'linkId is required'
            };
        }

        const command = new GetCommand({
            TableName: process.env.TABLENAME,
            Key: {
                PK: "LINK",
                SK: linkId,
            },
        });

        let response = await docClient.send(command);
        if(!('Item' in response)){
            return {
                status: false,
                message: 'Error in getting link details'
            };
        }
        return {
            status: true,
            data: response.Item,
            message: 'link details got successfully'
        };
    } catch (error) {
        console.error("Error getting link details:", error);
        return {
            status: false,
            message: 'Error getting link details'
        }
    }
}

const getQuestionAnswers = async function (params){
    try {
        
        const command = new GetCommand(params);

        let response = await docClient.send(command);
        if(!('Item' in response)){
            return {
                status: false,
                error: 'No Items found'
            }
        }
        return {
            status: true,
            data: response.Item,
            message: 'Questions/Answers got successfully'
        };
    } catch (error) {
        console.error("Error getting Questions/Answers:", error);
        return {
            status: false,
            message: 'Error getting Questions/Answers'
        }
    }
}

const putEvaluationResult = async function (resumeId, evaluationResult, jdId) {
    const functionName = "putEvaluationResult";
    console.log(`[INFO] [${functionName}] Starting the transaction process...`);

    try {
        const transactItems = [
            {
                Put: {
                    TableName: process.env.TABLENAME,
                    Item: {
                        PK: resumeId,
                        SK: "EVALUATION_SUMMARY",
                        summary: evaluationResult,
                    },
                },
            },
            {
                Update: {
                    TableName: process.env.TABLENAME,
                    Key: { PK: jdId, SK: resumeId },
                    UpdateExpression:
                        "SET summary = :summary, updatedAt = :newUpdatedAt, #status = :newStatus",
                    ExpressionAttributeNames: {
                        "#status": "status",
                    },
                    ExpressionAttributeValues: {
                        ":summary": evaluationResult,
                        ":newUpdatedAt": Date.now(),
                        ":newStatus": "COMPLETED",
                    },
                },
            },
        ];

        const command = new TransactWriteCommand({ TransactItems: transactItems });        
        await docClient.send(command);

        console.log(`[INFO] [${functionName}] Transaction completed successfully.`);
        return {
            status: true,
            message: 'Summary added and link updated successfully',
        };
    } catch (error) {
        console.error(`[ERROR] [${functionName}] Error performing transaction:`, error);
        return {
            status: false,
            message: 'Error processing transaction',
        };
    }
};



async function evaluateAnswers(evaluateAnswersRequest, evaluateAnswersResponse) {
    const apiName = "Evaluate Answers";
    let entryTime = Date.now();
    console.log(`[${apiName}] Entry Time:`, entryTime);
    
    try {
        // Validate input
        const linkId = evaluateAnswersRequest.body?.linkId;
        if (!linkId) {
            console.log(`[${apiName}] Invalid request: Missing linkId`);
            return evaluateAnswersResponse.status(400).send({ status: false, error: "Invalid input: linkId is required" });
        }

        // Fetch link details
        const linkDetails = await getLinkDetails(linkId);
        if (!linkDetails.status) {
            console.log(`[${apiName}] Failed to fetch link details for linkId: ${linkId}`);
            return evaluateAnswersResponse.status(400).send(linkDetails);
        }

        const { jdId, resumeId } = linkDetails.data || {};
        if (!jdId || !resumeId) {
            console.log(`[${apiName}] Incomplete link details for linkId: ${linkId}`);
            return evaluateAnswersResponse.status(400).send({ status: false, error: "Incomplete link details" });
        }

        // Fetch JD details
        const getJDDetailsResponse = await getJDDetails(jdId);
        if (!getJDDetailsResponse.status) {
            console.log(`[${apiName}] Failed to fetch JD details for jdId: ${jdId}`);
            return evaluateAnswersResponse.status(400).send(getJDDetailsResponse);
        }

        const jdFileId = getJDDetailsResponse.data?.fileId;
        if (!jdFileId) {
            console.log(`[${apiName}] JD file ID not found for jdId: ${jdId}`);
            return evaluateAnswersResponse.status(400).send({ status: false, error: "JD file ID not found" });
        }

        // Fetch questions and user answers
        const questionParams = {
            TableName: process.env.TABLENAME,
            Key: { PK: resumeId, SK: "QUESTIONS" },
        };
        const questions = await getQuestionAnswers(questionParams);
        if (!questions.status) {
            console.log(`[${apiName}] Failed to fetch questions for resumeId: ${resumeId}`);
            return evaluateAnswersResponse.status(400).send(questions);
        }

        const answerParams = {
            TableName: process.env.TABLENAME,
            Key: { PK: resumeId, SK: "USER_ANSWERS" },
        };
        const answers = await getQuestionAnswers(answerParams);
        if (!answers.status) {
            console.log(`[${apiName}] Failed to fetch answers for resumeId: ${resumeId}`);
            return evaluateAnswersResponse.status(400).send(answers);
        }

        const resumeFileIdParams = {
            TableName: process.env.TABLENAME,
            Key: { PK: jdId, SK: resumeId },
        };
        const resumeFileIdresponse = await getQuestionAnswers(resumeFileIdParams);
        if (!resumeFileIdresponse.status) {
            console.log(`[${apiName}] Failed to fetch resumeFileId for resumeId: ${resumeId}`);
            return evaluateAnswersResponse.status(400).send(resumeFileIdresponse);
        }
        let resumeFileId = resumeFileIdresponse.data.fileId;
        // Evaluate user responses
        const userSeparatedResponses = evaluateUserAnswers(questions.data.questions, answers.data.answers);

        // Upload user responses to OpenAI
        console.log(`[${apiName}] Starting upload process...`);
        const uploadResponse = await uploadToOpenAIFromBuffer(userSeparatedResponses);
        if (!uploadResponse.status) {
            console.log(`[${apiName}] Failed to upload user responses to OpenAI`);
            return evaluateAnswersResponse.status(400).send(uploadResponse);
        }

        const fileId = uploadResponse.fileId;
        console.log(`[${apiName}] File uploaded successfully. File ID: ${fileId}`);

        // Generate verdict
        const assistantId = process.env.EVALUATOR_ASSISTANT_ID;
        const verdictResponse = await generateVerdict(fileId, jdFileId, assistantId, resumeFileId);
        if (!verdictResponse.status) {
            console.log(`[${apiName}] Failed to generate verdict for fileId: ${fileId}`);
            return evaluateAnswersResponse.status(400).send(verdictResponse);
        }

        const evaluationResult = verdictResponse.evaluationResult;

        // Save evaluation result to the database
        const putSummaryResult = await putEvaluationResult(resumeId, evaluationResult, jdId);
        if (!putSummaryResult.status) {
            console.log(`[${apiName}] Failed to save evaluation result for resumeId: ${resumeId}`);
            return evaluateAnswersResponse.status(400).send(putSummaryResult);
        }

        console.log(`[${apiName}] Successfully evaluated for resumeId: ${resumeId} in ${Date.now() - entryTime} ms.`);
        return evaluateAnswersResponse.status(200).send({
            status: true,
            message: `Successfully evaluated for resumeId: ${resumeId}`,
        });
    } catch (error) {
        console.error(`[${apiName}] Error:`, error);
        return evaluateAnswersResponse.status(500).send({
            status: false,
            error: "Internal Server Error",
        });
    }
}

async function linkStatusCheck(req, res){
    let APIName = 'linkStatusCheck'; let verifyLinkResponse = null;
    try{
        let { linkId } = req.params;
        console.log(`[INFO][${APIName}] API Execcution time StartTime: `, Date.now());
        verifyLinkResponse = await verifyLink(linkId);
        if(!verifyLinkResponse.status){
            console.error(`[ERROR][${APIName}] Link Expired LinkID: ${linkId}`);
            return res.status(200).send({
                message: 'SUCCESS',
                link_status: "INACTIVE"
            });
        }
        let status = verifyLinkResponse?.data?.status;
        return res.status(200).send({
            message: 'SUCCESS',
            link_status: status
        });
    } catch(error) {
        console.error(`[ERROR][${APIName}] outter catch triggered ERROR: ${error}, ${req.params.linkId}`);
        return  res.status(500).send({
            message: 'INTERNAL SERVER ERROR'
        });
    }
}

async function inprogressQuestionsFetch(req, res) {
    let APIName = 'inprogressQuestionsFetch';
    let verifyLinkResponse = null;
    try {
        let { linkId } = req.params;
        console.log(`[INFO][${APIName}] API Execution time StartTime: `, Date.now());
        verifyLinkResponse = await verifyLink(linkId);

        if (!verifyLinkResponse.status) {
            console.error(`[ERROR][${APIName}] Link Expired LinkID: ${linkId}`);
            return res.status(200).send({
                message: 'SUCCESS',
                link_status: "INACTIVE"
            });
        }

        const command = new GetCommand({
            TableName: process.env.TABLENAME,
            Key: {
                PK: verifyLinkResponse.data.resumeId,
                SK: 'USER_ANSWERS',
            },
        });

        let response = await docClient.send(command);
        if (!('Item' in response)) {
            console.error(`[ERROR][${APIName}] Error in getting user answers: ${linkId}`);
            return res.status(500).send({
                message: 'Error in getting user answers',
                date: Date.now()
            });
        }

        const { answers } = response.Item;

        response = await getQuestionsWithResumeId(verifyLinkResponse.data.resumeId);
        const { questions } = response.data;

        return res.status(200).send({
            message: 'SUCCESS',
            answers,
            questions, 
            endTime: verifyLinkResponse.data.expTime
        });
    } catch (error) {
        console.error(`[ERROR][${APIName}] outer catch triggered ERROR: ${error}, ${req.params.linkId}`);
        return res.status(500).send({
            message: 'INTERNAL SERVER ERROR'
        });
    }
}



module.exports = {putQuestions,getQuestions: getQuestionsWithResumeId,getQuestionsWithLinkId,submitQuestion,generateQuestions, evaluateAnswers, linkStatusCheck, inprogressQuestionsFetch};
