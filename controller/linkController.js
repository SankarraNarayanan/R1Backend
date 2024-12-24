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
 * File: \controllers\linkController.js                                        *
 * Project: metricsbackend                                                     *
 * Created Date: Friday, December 20th 2024, 4:23:25 pm                        *
 * Author: Renjith R T <renjith@codestax.ai>                                   *
 * -----                                                                       *
 * Last Modified: December 23rd 2024, 7:48:26 pm                               *
 * Modified By: Renjith R T                                                    *
 * -----                                                                       *
 * Any app that can be written in JavaScript,                                  *
 *     will eventually be written in JavaScript !!                             *
 * -----                                                                       *
 * HISTORY:                                                                    *
 * Date         By  Comments                                                   *
 * --------------------------------------------------------------------------- *
 */



const uuid = require("short-uuid");
require("dotenv").config();
const {
  DynamoDBClient,
  TransactWriteItemsCommand,
} = require("@aws-sdk/client-dynamodb");
const { marshall } = require("@aws-sdk/util-dynamodb");
const responseController = require("../utils/responseHelper");
const { addMessageToSQS } = require("../utils/sqsHelper");
const e = require("cors");

const dynamoDBClient = new DynamoDBClient({
  region: process.env.AWS_REGION,
});

function pushToSQS(email, link) {
  let messageBody = {
    email: email,
    link: link,
  };
  addMessageToSQS(messageBody);
}

const sendLink = async function (req, res) {
  console.log(res);
  const functionName = "Link Generation Api";
  const body = JSON.parse(req.body);
  console.log("body: ", body);

  const userDetails = body.userDetails;
  const jdId = body.jdId;
  let userLinkList = [];

  try {
    const transactItems = [];

    userDetails.forEach((e) => {
      let linkUUID = uuid.generate();
      let currentTime = Math.floor(Date.now() / 1000);
      let expiryTime = currentTime + 5 * 24 * 60 * 60;

      // Update Item
      transactItems.push({
        Update: {
          TableName: process.env.TABLENAME,
          Key: marshall({ PK: jdId, SK: e.resumeId }),
          UpdateExpression:
            "SET linkId = :newLinkId, updatedAt = :newUpdatedAt, #status = :newStatus",
          ExpressionAttributeNames: {
            "#status": "status",
          },
          ExpressionAttributeValues: marshall({
            ":newLinkId": linkUUID,
            ":newUpdatedAt": currentTime,
            ":newStatus": "LINK_GENERATED",
          }),
        },
      });

      // Insert Item
      transactItems.push({
        Put: {
          TableName: process.env.TABLENAME,
          Item: marshall({
            PK: "LINK",
            SK: linkUUID,
            resumeId: e.resumeId,
            jdId: jdId,
            expTime: expiryTime,
            startTime: 0,
            endTime: 0,
            updatedAt: currentTime,
            status: "ACTIVE",
            websocketId: "",
          }),
        },
      });
      userLinkList.push({
        email: e.emailId,
        link: `https://${process.env.CANDIDATE_PANEL_CLOUDFRONT_URL}?linkID=${linkUUID}`,
      });
    });

    const command = new TransactWriteItemsCommand({
      TransactItems: transactItems,
    });

    const response = await dynamoDBClient.send(command);
    console.log("Transaction succeeded:", response);
    for (let emailLink of userLinkList) {
      pushToSQS(emailLink.email, emailLink.link);
    }
    // pushToSQS(userLinkList);
    return responseController.defineResponse(200, {
      message: "Links generated successfully",
    });
  } catch (error) {
    console.error("Transaction failed:", error);
    return responseController.defineResponse(500, {
      message: "Internal Error",
    });
  }
};

module.exports = {
  sendLink,
};
