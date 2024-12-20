const { getSignedUrl: getCloudfrontSignedUrl } = require('@aws-sdk/cloudfront-signer');
const { S3Client, PutObjectCommand, GetObjectCommand } = require('@aws-sdk/client-s3');
const { getSignedUrl: gets3SignedUrl } = require('@aws-sdk/s3-request-presigner');
require('dotenv').config();
const s3Client = new S3Client({
    region: process.env.S3_REGION,
    signatureVersion: 'v4'
});

const getPresignedUrlWrite = async function (req, res) {
    const functionName = 'getPresignedUrlWrite Api';
    try {
        let queryParams = req.query;
        let fileName = queryParams.fileName;
        let fileSize = queryParams.fileSize;
        let maxFileSize = 10000000; // 10 Mb
        if (!fileSize || fileSize > maxFileSize) {
            console.log(`[INFO]  [${functionName}] Exceeded file size limit`);
            return res.status(400).json({message:"Exceeded file size limit"});
        }
        const createParams = {
            Key: fileName,
            Bucket: process.env.S3_BUCKETNAME,
        };
        const command = new PutObjectCommand(createParams);
        let response = await gets3SignedUrl(s3Client, command, { expiresIn: 3600 });
        if (!response) {
            console.log(`[INFO]  [${functionName}] Error in Getting Presigned Url write`);
            return res.status(400).json({message:"Error in Getting Presigned Url write"});
        } else {
            return res.status(200).json({message:"Success" , data : response});
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
        let queryParams = req.params;
        let fileName = queryParams.fileName;
        const url = `${cloudFrontDomain}/${fileName}`;
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