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
 * File: \AiController\questionGenerator.js                                    *
 * Project: r1-backend                                                         *
 * Created Date: Tuesday, December 24th 2024, 4:22:01 pm                       *
 * Author: Sankarra Narayanan G <sankar@codestax.ai>                           *
 * -----                                                                       *
 * Last Modified: December 24th 2024, 7:35:23 pm                               *
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

const openai = new OpenAI({
    apiKey: process.env.API_KEY
});

function extractJsonFromText(text) {
    // Regular expression to identify and remove the code block markers
    const regex = /```json([\s\S]*?)```/g;
    
    // Check if there is any match with code block markers and remove them
    const match = text.match(regex);
    
    if (match) {
        // Extract the JSON content from the match
        const jsonContent = match[0].replace(/```json|```/g, "").trim();
        return jsonContent;
    }
    
    return text.trim(); // Return the original text if no code block markers are found
}

async function questionGenerator(resumeVectorId, jdVecotorId) {
    let assistantId = process.env.QUESTION_GENERATOR_ASSISTANT_ID;
    try {
        console.log('Generating Questions ....');
        const thread = await openai.beta.threads.create({
            messages: [
                {
                    role: "user",
                    content:
                        "Evaluate the candidate's resume against the provided Job Description. Identify key skills, technologies, and competencies required for the role. Generate 10 technical and scenario-based multiple-choice questions that align with the JD. These questions should: Test the candidate's technical expertise and problem-solving abilities. Include realistic scenarios to gauge the candidate’s ability to handle role-specific challenges. Cover both breadth and depth of knowledge relevant to the role. Ensure the questions, options and answers are presented in the following JSON format: { 'questions': [ { 'id': 'q1', 'question': 'Insert question here.', 'choices': { 'a': 'Option A', 'b': 'Option B', 'c': 'Option C', 'd': 'Option D' }, 'answer': 'a' }, { 'id': 'q2', 'question': 'Insert question here.', 'choices': { 'a': 'Option A', 'b': 'Option B', 'c': 'Option C', 'd': 'Option D' }, 'answer': 'c' } // Add remaining questions here ] } ",
                    attachments: [
                        { file_id: resumeVectorId, tools: [{ type: "file_search" }] },
                        { file_id: jdVecotorId, tools: [{ type: "file_search" }] }],
                },
            ],
        });
        let run = await openai.beta.threads.runs.createAndPoll(
            thread.id,
            {
                assistant_id: assistantId,
                instructions: "Generate questions and send it in the json format only"
            }
        );
        console.log('Questions Generated successfully');
        if (run.status === 'completed') {
            const messages = await openai.beta.threads.messages.list(
                run.thread_id
            );
            for (const message of messages.data) {
                console.log(`${ message.role } > ${ message.content[0].text.value }`);
                let aiMessage =  message.content[0].text.value;
                let extractedMessage = extractJsonFromText(aiMessage);
                console.log('extractedMessage', extractedMessage);
                return extractedMessage;
            }
        } else {
            console.log(run.status);
        }
    } catch (error) {
        console.log('error in generating querstions ', error);
        return { status: false, error: error }
    }

}
module.exports = {
    extractJsonFromText,
    questionGenerator
};