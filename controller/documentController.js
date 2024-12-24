const { getSignedUrl: getCloudfrontSignedUrl } = require('@aws-sdk/cloudfront-signer');
const { S3Client, PutObjectCommand, GetObjectCommand } = require('@aws-sdk/client-s3');
const { getSignedUrl: gets3SignedUrl } = require('@aws-sdk/s3-request-presigner');
require('dotenv').config();
const { v4: uuidv4 } = require('uuid');
const s3Client = new S3Client({
    region: process.env.S3_REGION,
    signatureVersion: 'v4'
});

const getPresignedUrlWrite = async function (req, res) {
    const functionName = 'getPresignedUrlWrite Api';
    try {
        let queryParams = req.query;
        let fileSize = queryParams.fileSize;
        let type = queryParams.type;
        let maxFileSize = 10000000; // 10 Mb
        if (!fileSize || fileSize > maxFileSize) {
            console.log(`[INFO]  [${functionName}] Exceeded file size limit`);
            return res.status(400).json({message:"Exceeded file size limit"});
        }
        if(!['resume','jobDescription'].includes(type)){
            console.log(`[INFO]  [${functionName}] Type is different`);
            return res.status(400).json({message:"we only accept resume or JD"});
        }
        let fileId = uuidv4();
        let filePath = `${type}/${fileId}.pdf`;
        const createParams = {
            Key: filePath,
            Bucket: process.env.S3_BUCKETNAME,
        };
        const command = new PutObjectCommand(createParams);
        let response = await gets3SignedUrl(s3Client, command, { expiresIn: 3600 });
        if (!response) {
            console.log(`[INFO]  [${functionName}] Error in Getting Presigned Url write`);
            return res.status(400).json({message:"Error in Getting Presigned Url write"});
        } else {
            return res.status(200).json({message:"Success" , data : {
                fileId,
                filePath,
                url:response
            }});
        }
    } catch (error) {
        console.log(`[ERROR]  [${functionName}] Api Catch Error`, error);
        return res.status(500).json({message:"Internal Error"});
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
        if(!['resume','jobDescription'].includes(type)){
            console.log(`[INFO]  [${functionName}] Type is different`);
            return res.status(400).json({message:"we only accept resume or JD"});
        }
        const url = `${cloudFrontDomain}/${type}/${fileId}.pdf`;
        const getParams = {
            Key: privateKeyFileName,
            Bucket: process.env.S3_BUCKETNAME,
        };
        const command = new GetObjectCommand(getParams);
        let privateKeyResponse = await s3Client.send(command);
        const privateKey = await privateKeyResponse.Body.transformToString();
        const cloudResponse = getCloudfrontSignedUrl({
            url,
            keyPairId,
            dateLessThan,
            privateKey,
        });
        if (!cloudResponse) {
            console.log(`[INFO]  [${functionName}] Error in Getting Presigned Url Read`);
            return res.status(400).json({message:"Error in Getting Presigned Url Read"});
        } else {
            return res.status(200).json({message:"Success" , data : cloudResponse});
        }
    } catch (error) {
        console.log(`[ERROR]  [${functionName}] Api Catch Error`, error);
        return res.status(500).json({message:"Internal Error" });
    }
};

module.exports = {
    getPresignedUrlWrite,
    getPresignedUrlRead
};