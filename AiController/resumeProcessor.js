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
 * File: \AiController\resumeProcessor.js                                      *
 * Project: r1-backend                                                         *
 * Created Date: Tuesday, December 24th 2024, 7:27:20 pm                       *
 * Author: Sankarra Narayanan G <sankar@codestax.ai>                           *
 * -----                                                                       *
 * Last Modified: December 24th 2024, 7:33:05 pm                               *
 * Modified By: Sankarra Narayanan G                                           *
 * -----                                                                       *
 * Any app that can be written in JavaScript,                                  *
 *     will eventually be written in JavaScript !!                             *
 * -----                                                                       *
 * HISTORY:                                                                    *
 * Date         By  Comments                                                   *
 * --------------------------------------------------------------------------- *
 */
require('dotenv').config();
const OpenAI = require('openai');
require('dotenv').config();
const fs = require('fs');
const { extractJsonFromText } = require('./questionGenerator');
const openai = new OpenAI({
    apiKey: process.env.API_KEY
});

async function resumeProcessor(resumeVectorId) {
    let assistantId = process.env.RESUME_EXTRACTOR_ASSISTANT_ID;
    try {
        const thread = await openai.beta.threads.create({
            messages: [
                {
                    role: "user",
                    content:
                        "Read the resume and provide the candidate details in the json format only. The JSON output must strictly follow this format: {'name': '<Full Name>', 'email': '<Email Address>', 'skills': ['<Skill 1>', '<Skill 2>', '<Skill 3>', '...'], 'phonenumber': '<Phone Number>'}",

                    attachments: [{ file_id: resumeVectorId, tools: [{ type: "file_search" }] }],
                },
            ],
        });

        let run = await openai.beta.threads.runs.createAndPoll(
            thread.id,
            {
                assistant_id: assistantId,
                instructions: "Read the resume and provide the candidate details in the json format only"
            }
        );

        if (run.status === 'completed') {
            const messages = await openai.beta.threads.messages.list(
                run.thread_id
            );
            for (const message of messages.data.reverse()) {
                console.log(`${message.role} > ${message.content[0].text.value}`);
                let extractedMessage = extractJsonFromText(message.content[0].text.value);
                return extractedMessage;
            }
        } else {
            console.log(run.status);
        }
        console.log(run);
    } catch (error) {
        console.log('error in extracting content from resume', error);
        return { status: false, error: error }
    }
}

module.exports = {
    resumeProcessor
};