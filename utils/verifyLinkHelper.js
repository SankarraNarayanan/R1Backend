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
 * File: \utils\verifyLinkHelper.js                                            *
 * Project: r1-backend                                                         *
 * Created Date: Tuesday, December 24th 2024, 11:28:36 am                      *
 * Author: Renjith R T <renjith@codestax.ai>                                   *
 * -----                                                                       *
 * Last Modified: December 24th 2024, 1:55:53 pm                               *
 * Modified By: Renjith R T                                                    *
 * -----                                                                       *
 * Any app that can be written in JavaScript,                                  *
 *     will eventually be written in JavaScript !!                             *
 * -----                                                                       *
 * HISTORY:                                                                    *
 * Date         By  Comments                                                   *
 * --------------------------------------------------------------------------- *
 */

require('dotenv').config();
const { DynamoDBClient, GetItemCommand, UpdateItemCommand } = require("@aws-sdk/client-dynamodb");
const { unmarshall } = require("@aws-sdk/util-dynamodb");
const { fromSSO } = require('@aws-sdk/credential-providers');

const dynamoDBClient = new DynamoDBClient({
    region: process.env.AWS_REGION,
    //credentials: fromSSO({ profile: 'default' }),
  });

async function updateStartEndTime(linkId){
    const functionName = "UpdateStartEndTime";
    const params = {
        TableName: process.env.TABLENAME,
        Key: {
            PK: { S: "LINK" }, 
            SK: { S: linkId }, 
        },
        UpdateExpression: 'SET startTime = :newStartTime, endTime = :newEndTime, updatedAt = :newUpdatedAt',
        ExpressionAttributeValues: {
            ':newUpdatedAt': { N: Math.floor(Date.now() / 1000).toString() },
            ':newStartTime': { N: Math.floor(Date.now() / 1000).toString()},
            ':newEndTime': { N: Math.floor((Date.now() + 20 * 60 * 1000) / 1000).toString()}
        },
        ReturnValues: 'UPDATED_NEW', 
    };

    try {
        const command = new UpdateItemCommand(params);
        const response = await dynamoDBClient.send(command);
        console.log('Update succeeded:', response);
    } catch (error) {
        console.error('Error updating item:', error);
    }
}

async function markLinkInActive(linkId){
    const functionName = "Mark Link InActive";
    
    const params = {
        TableName: process.env.TABLENAME,
        Key: {
            PK: { S: "LINK" }, 
            SK: { S: linkId }, 
        },
        UpdateExpression: 'SET #status = :newStatus, updatedAt = :newUpdatedAt',
        ExpressionAttributeNames: {
            "#status": "status",
          },
        ExpressionAttributeValues: {
            ':newUpdatedAt': { N: Math.floor(Date.now() / 1000).toString() },
            ':newStatus': { S: 'INACTIVE' }, 
        },
        ReturnValues: 'UPDATED_NEW', 
    };

    try {
        const command = new UpdateItemCommand(params);
        const response = await dynamoDBClient.send(command);
        console.log('Update succeeded:', response);
    } catch (error) {
        console.error('Error updating item:', error);
    }
}

async function verifyLink(linkId){
    let functionName='verify Link';
    const params = {
        TableName: process.env.TABLENAME,
        Key: {
            'PK': { S: "LINK" },
            'SK': { S: linkId }
        }
    };
    console.log('DynamoParams', params);
    try {
        const command = new GetItemCommand(params);
        console.log('DynamoCommand',command);
        const data = await dynamoDBClient.send(command);
        console.log('DynamoData',data);
        if (data.Item) {
            const returnData = unmarshall(data.Item);
            console.log('returnData: ', returnData);
            if(returnData.status == "ACTIVE"){
                let currentTime = Math.floor(Date.now() / 1000);
                if(returnData.endTime != 0 && returnData.endTime >= currentTime){
                    return {
                        status: true,
                        data: returnData
                    };
                }
                if(returnData.expTime >= currentTime){
                    if(returnData.endTime == 0){
                        return {
                            status: true,
                            data: returnData
                        };
                    }else if(returnData.endTime >= currentTime){
                        return {
                            status: true,
                            data: returnData
                        };
                    }else{
                        markLinkInActive(linkId);
                        return {
                            status: false,
                        };
                    }
                }
                else{
                    return {
                        status: false,
                    };
                }
            }else{
                return {
                    status: false,
                };
            }
        } else {
            console.log('Error in getting Link details');
            return {
                status: false,
            };
        }
    } catch (error) {
        console.error('Error fetching record from DynamoDB:', error);
        return {
            status: false,
            error: error
        };
    }
}

module.exports = {verifyLink}