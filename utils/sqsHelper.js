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
 * File: \utils\sqsHelper.js                                                   *
 * Project: metricsbackend                                                     *
 * Created Date: Monday, December 23rd 2024, 12:38:26 pm                       *
 * Author: Renjith R T <renjith@codestax.ai>                                   *
 * -----                                                                       *
 * Last Modified: December 23rd 2024, 12:38:29 pm                              *
 * Modified By: Renjith R T                                                    *
 * -----                                                                       *
 * Any app that can be written in JavaScript,                                  *
 *     will eventually be written in JavaScript !!                             *
 * -----                                                                       *
 * HISTORY:                                                                    *
 * Date         By  Comments                                                   *
 * --------------------------------------------------------------------------- *
 */

const { SQSClient, SendMessageCommand } = require("@aws-sdk/client-sqs");
const SQS = new SQSClient({
    credentials: defaultProvider,
    region: process.env.SQS_REGION,
  });

class sqsHelper {
    async addMessageToSQS(messageBody){
        try{
            payload = messageBody
            let sqsParams = {
            QueueUrl: process.env.EMAIL_PROCESSOR_QUEUE_URL,
            MessageBody: JSON.stringify(payload),
            };
            const messageCommand = new SendMessageCommand(sqsParams);
            let result = await SQS.send(messageCommand);
            console.log(
            `[INFO] [${functionName}] Message has been Successfully sent \n Queue Url: ${sqsParams["QueueUrl"]} \n MessageDetails:`,
            result
            );
        } catch (error) {
            console.error(`Error while Adding message to sqs`, error)
            return {
                message: 'SQS ERROR',
                status: 500
            }
        }
        
    }
}

module.exports = new sqsHelper()