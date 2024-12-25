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
 * File: \controller\documentController.js                                     *
 * Project: r1-backend                                                         *
 * Created Date: Wednesday, December 25th 2024, 12:26:19 pm                    *
 * Author: Sankarra Narayanan G <sankar@codestax.ai>                           *
 * -----                                                                       *
 * Last Modified: December 25th 2024, 8:10:45 pm                               *
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
const { PutCommand, DynamoDBDocumentClient } = require("@aws-sdk/lib-dynamodb");
const OpenAI = require("openai");
// import OpenAI from 'openai';
const { getSignedUrl } = require('@aws-sdk/cloudfront-signer');
const { S3Client, PutObjectCommand, GetObjectCommand } = require('@aws-sdk/client-s3');
require('dotenv').config();

const { v4: uuidv4 } = require('uuid');
const s3Client = new S3Client({
    region: process.env.S3_REGION,
    signatureVersion: 'v4'
});
const dynamoDBClient = new DynamoDBClient({
    region: process.env.AWS_REGION,
});
const docClient = DynamoDBDocumentClient.from(dynamoDBClient);
const openAiClient = new OpenAI({
    apiKey: process.env.API_KEY,
});

const uploadFileToOpenAi = async function (file) {
    try {
        let newFile = new File([file.buffer], file.originalname, {
            type: file.mimetype,
        });
        const upload = await openAiClient.files.create({
            file: newFile,
            purpose: "assistants",
        });
        const vectorStore = await openAiClient.beta.vectorStores.create({
            file_ids: [upload.id]
        })
        return {
            status: true,
            vectorId: vectorStore.id,
            fileId: upload.id
        }
    }
    catch (error) {
        console.log("Error in uploadFileToOpenAi::", error)
        return {
            status: false,
            error: error
        }
    }
};

const createRecordInDynamoDB = async function (type, requestBody, fileDetails) {
    let fileUUID = fileDetails.fileUUId;
    try {

        let params;
        if (type == "jobDescription") {
            params = {
                TableName: process.env.TABLENAME,
                Item: {
                    PK: 'JD', 
                    SK: fileUUID, 
                    filePath: fileDetails.filePath,
                    vectorId: fileDetails.vectorId,
                    fileId: fileDetails.fileId,
                    jdId:fileUUID,
                    vacancies: requestBody.vacancies,
                    createdBy: requestBody.adminId, 
                    createdAt: Math.floor(Date.now() / 1000),
                },
            }
        }
        else {
            params = {
                TableName: process.env.TABLENAME,
                Item: {
                    PK: requestBody.jdId, 
                    SK: fileUUID, 
                    filePath: fileDetails.filePath,
                    vectorId: fileDetails.vectorId,
                    resumeId: fileUUID,
                    fileId: fileDetails.fileId,
                    emailId : requestBody.jdId,
                    status : "UPLOADED"
                },
            }
        }
        let command = new PutCommand(params);
        await docClient.send(command);
        return{
            status:true
        }
    } catch (error) {
        console.log("Error in createRecordInDynamoDB::", error);
        return {
            status: false,
            error
        }
    }
}

const uploadFile = async function (req, res) {
    const functionName = "uploadFileToS3";
    try {
        const file = req.file;
        const type = req.body.type;
        let requestBody = req.body;
        const maxFileSize = 10 * 1024 * 1024;
        if (!file) {
            return res.status(400).json({ error: 'File is required.' });
        }
        if (file.size > maxFileSize) {
            console.log(`[INFO]  [${functionName}] Exceeded file size limit`);
            return res.status(400).json({ message: "Exceeded file size limit" });
        }

        if (!["resume", "jobDescription"].includes(type)) {
            console.log(`[INFO]  [${functionName}] Invalid type`);
            return res.status(400).json({ message: "We only accept resume or jobDescription" });
        }

        if (type == "jobDescription") {
            if (!requestBody.vacancies || !requestBody.adminId) {
                return res.status(400).json({ error: 'adminId and vacancies are required' });
            }
        }
        else {
            if (!requestBody.jdId || !requestBody.emailId) {
                return res.status(400).json({ error: 'Job Description Id and emailId is required' });
            }
        }

        let fileUUId = uuidv4();
        const filePath = `${type}/${fileUUId}.pdf`;

        const createParams = {
            Bucket: process.env.S3_BUCKETNAME,
            Key: filePath,
            Body: file.buffer,
            ContentType: file.mimetype,
        };

        await s3Client.send(new PutObjectCommand(createParams));

        let vectorUpload = await uploadFileToOpenAi(file);
        if (!vectorUpload.status) {
            return res.status(400).json({ message: "Error uploading file to vector Store" });
        }

        let fileDetails ={
            fileUUId,
            filePath,
            ...vectorUpload
        }

        let dynamoResponse = await createRecordInDynamoDB(type,requestBody,fileDetails);

        if(!dynamoResponse.status){
            return res.status(400).json({ message: "Error uploading file to vector Store" });
        }

        return res.status(200).json({
            message: "File successfully uploaded",
            data: {
                uuid: fileUUId,
                type,
                filePath,
                fileId: vectorUpload.fileId,
                vectorId: vectorUpload.vectorId
            },
        });
    } catch (error) {
        console.error(`[ERROR]  [${functionName}] Api Catch Error`, error);
        return res.status(500).json({ message: "Internal Server Error" });
    }
};

const getPresignedUrlRead = async function (req, res) {
    const functionName = 'getPresignedUrlRead Api';
    const cloudFrontDomain = process.env.CLOUDFRONT_DOMAIN_TO_ACCESS_S3_OBJECT;
    const privateKeyFileName = process.env.CLOUDFRONT_PRIVATE_KEY_FILE_NAME;
    const keyPairId = process.env.CLOUDFRONT_KEY_PAIR_ID;
    const dateLessThan = new Date(new Date().getTime() + 1000 * 60 * 60);
    try {
        let queryParams = req.query;
        let fileId = queryParams.fileId;
        let type = queryParams.type;
        if (!['resume', 'jobDescription'].includes(type)) {
            console.log(`[INFO]  [${functionName}] Type is different`);
            return res.status(400).json({ message: "we only accept resume or JD" });
        }
        const url = `${cloudFrontDomain}/${type}/${fileId}.pdf`;
        const getParams = {
            Key: privateKeyFileName,
            Bucket: process.env.S3_BUCKETNAME,
        };
        const command = new GetObjectCommand(getParams);
        let privateKeyResponse = await s3Client.send(command);
        const privateKey = await privateKeyResponse.Body.transformToString();
        const cloudResponse = getSignedUrl({
            url,
            keyPairId,
            dateLessThan,
            privateKey,
        });
        if (!cloudResponse) {
            console.log(`[INFO]  [${functionName}] Error in Getting Presigned Url Read`);
            return res.status(400).json({ message: "Error in Getting Presigned Url Read" });
        } else {
            return res.status(200).json({ message: "Success", data: cloudResponse });
        }
    } catch (error) {
        console.log(`[ERROR]  [${functionName}] Api Catch Error`, error);
        return res.status(500).json({ message: "Internal Error" });
    }
};

module.exports = {
    uploadFile,
    getPresignedUrlRead
};