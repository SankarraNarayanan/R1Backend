import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { PutCommand, DynamoDBDocumentClient, GetCommand } from "@aws-sdk/lib-dynamodb";
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


const getQuestions = async function(resumeId){
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
            data: response,
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

module.exports = {putQuestions,getQuestions};