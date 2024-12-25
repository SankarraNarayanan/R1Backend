const { DynamoDBClient } = require("@aws-sdk/client-dynamodb");
const { PutCommand, DynamoDBDocumentClient, GetCommand } = require("@aws-sdk/lib-dynamodb");
const { verifyLink } = require("../utils/verifyLinkHelper");
const dynamoDBClient = new DynamoDBClient({
    region: process.env.AWS_REGION,
  });

const docClient = DynamoDBDocumentClient.from(dynamoDBClient);

const putQuestions = async function(resumeId,questions){
    try {
        if (!resumeId) {
            return {
                status : false,
                message : 'resumeId is required'
            };
        }
        if (!Array.isArray(questions)) {
            return {
                status : true,
                message : 'The questions field must be a list.'
            };
        }

        const command = new PutCommand({
            TableName: process.env.TABLENAME,
            Item: {
              PK: resumeId,
              SK: "QUESTIONS",
              Data: questions,
            },
        });

        await docClient.send(command);
        return {
            status : true,
            message : 'Question added successfully'
        };
    } catch (error) {
        console.error("Error putting questions:", error);
        return {
            status: false,
            message: 'Error adding question'
        }
    }
};

const getQuestionsWithLinkId = async function (req,res){
    try {
        let { linkId } = req.params;
        if(!linkId){
            return res.status(400).json({ error: 'Missing linkId' });
        }

        let verify = await verifyLink(linkId);
        if(!verify.status){
            return res.status(400).json({ error: 'Your Link is not active' });
        }
        let questions = await getQuestionsWithResumeId(verify.data.resumeId);
        if(!questions.status){
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
        return res.status(200).json({ data: questionsWithoutAnswer });
    } catch (error) {
        console.log('ERROR in getQuestionsWithLinkId ::',error)
        return res.status(500).json({ error: 'Error getting question' });
    }
};


const getQuestionsWithResumeId = async function(resumeId){
    try {
        if (!resumeId) {
            return {
                status : false,
                message : 'resumeId is required'
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

module.exports = {putQuestions,getQuestions: getQuestionsWithResumeId,getQuestionsWithLinkId};