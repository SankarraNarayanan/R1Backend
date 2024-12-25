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
 * File: \controller\jdController.js                                           *
 * Project: r1-backend                                                         *
 * Created Date: Friday, December 20th 2024, 5:10:27 pm                        *
 * Author: Abirami <abirami@codestax.ai>                                       *
 * -----                                                                       *
 * Last Modified: December 25th 2024, 3:40:18 pm                               *
 * Modified By: Sankarra Narayanan G                                           *
 * -----                                                                       *
 * Any app that can be written in JavaScript,                                  *
 *     will eventually be written in JavaScript !!                             *
 * -----                                                                       *
 * HISTORY:                                                                    *
 * Date         By  Comments                                                   *
 * --------------------------------------------------------------------------- *
 */
require("dotenv").config();
const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { QueryCommand, GetCommand } = require('@aws-sdk/lib-dynamodb');
const { fromSSO } = require('@aws-sdk/credential-providers');

const dynamoDBClient = new DynamoDBClient({
    region: process.env.AWS_REGION,
    //credentials: fromSSO({ profile: 'default' }),
});
async function getListOfJD(listOfJDRequest, listOfJDResponse) {
    let entryAPITime = new Date();
    let apiName = 'Get List of JDs';
    console.log(`[${apiName}] API entry time : `, entryAPITime);
    try {
        let params = {
            TableName: process.env.TABLENAME,
            KeyConditionExpression: 'PK = :pk',
            ExpressionAttributeValues: {
                ':pk': 'JD'
            },
        };
        let command = new QueryCommand(params);
        let getListOfJDResponse = await dynamoDBClient.send(command);
        if (getListOfJDResponse?.Items?.length === 0) {
            console.log(`[${apiName}][INFO] No JDs are available.`);
            return listOfJDResponse.status(200).send({
                message: 'No JDs are available.',
                data: []
            });
        } else if (getListOfJDResponse?.Items?.length > 0) {
            console.log(`[${apiName}][INFO] Getting List of JDs is successful`);
            return listOfJDResponse.status(200).send({
                message: 'List of JDs have been fetched Successfully.',
                data: getListOfJDResponse.Items
            });
        }
    } catch (error) {
        let catchErrorData = {
            httpStatusCode: 500,
            errorCode: 7008,
            message: 'Error in fetching list of JDs',
            consoleError: error,
        };
        console.log('error', error);
        return listOfJDResponse.status(500).send({
            message: 'Error in fetching list of JDs.',
            error: catchErrorData
        });
    }
};

async function getAllResumesForJD(listOfResumeRequest, listOfResumeResponse) {
    let entryAPITime = new Date();
    let apiName = 'Get List of Resumes for JD';
    console.log(`[${apiName}] API entry time : `, entryAPITime);
    let JDId = listOfResumeRequest.body.JDId;
    try {
        let params = {
            TableName: process.env.TABLENAME,
            KeyConditionExpression: 'PK = :pk',
            ExpressionAttributeValues: {
                ':pk': JDId
            },
        };
        let command = new QueryCommand(params);
        let getListofResumesResponse = await dynamoDBClient.send(command);
        if (getListofResumesResponse?.Items?.length === 0) {
            console.log(`[${apiName}][INFO] No Resumes are available.`);
            return listOfResumeResponse.status(200).send({
                message: 'No Resumes are available.',
                data: []
            });
        } else if (getListofResumesResponse?.Items?.length > 0) {
            console.log(`[${apiName}][INFO] Getting List of Resumes is successful`);
            return listOfResumeResponse.status(200).send({
                message: 'List of Resumes have been fetched Successfully.',
                data: getListofResumesResponse.Items
            });
        }
    } catch (error) {
        let catchErrorData = {
            httpStatusCode: 500,
            errorCode: 7008,
            message: 'Error in fetching list of Resumes',
            consoleError: error,
        };
        return listOfResumeResponse.status(500).send({
            message: 'Error in fetching list of Resumes.',
            error: catchErrorData
        });
    }
};

async function getJDDetails(jdId) {
    try {
        if (!jdId) {
            return {
                status: false,
                message: 'jdId is required'
            };
        }

        const command = new GetCommand({
            TableName: process.env.TABLENAME,
            Key: {
                PK: 'JD',
                SK: jdId,
            },
        });

        let response = await dynamoDBClient.send(command);
        return {
            status: true,
            data: response.Item,
            message: 'JD fetched successfully'
        };
    } catch (error) {
        console.error("Error getting jd:", error);
        return {
            status: false,
            message: 'Error getting jd'
        }
    }
}

module.exports = {
    getJDDetails, getListOfJD, getAllResumesForJD
}