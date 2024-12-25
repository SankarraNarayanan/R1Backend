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
 * File: \evaluateResponse.js                                                  *
 * Project: r1-backend                                                         *
 * Created Date: Monday, December 23rd 2024, 3:30:29 pm                        *
 * Author: Sankarra Narayanan G <sankar@codestax.ai>                           *
 * -----                                                                       *
 * Last Modified: December 25th 2024, 8:42:36 pm                               *
 * Modified By: Sankarra Narayanan G                                           *
 * -----                                                                       *
 * Any app that can be written in JavaScript,                                  *
 *     will eventually be written in JavaScript !!                             *
 * -----                                                                       *
 * HISTORY:                                                                    *
 * Date         By  Comments                                                   *
 * --------------------------------------------------------------------------- *
 */

const OpenAI = require('openai');
const fs = require('fs');
const openai = new OpenAI({
    apiKey: process.env.API_KEY
});

// Function to evaluate user answers
function evaluateUserAnswers(questionData, userAnswers) {
    const correctAnswers = [];
    const wrongAnswers = [];
    // Loop through the questions to compare user answers
    questionData.forEach((question) => {
        const userAnswer = userAnswers[question.id];

        if (userAnswer === question.answer) {
            correctAnswers.push({
                id: question.id,
                question: question.question,
                userAnswer,
                correctAnswer: question.answer,
            });
        } else {
            wrongAnswers.push({
                id: question.id,
                question: question.question,
                userAnswer,
                correctAnswer: question.answer,
            });
        }
    });

    return { correctAnswers, wrongAnswers };
}

// Function to create evaluation assistant
async function createEvaluationAssistant() {
    try {
        const evaluationAssistant = await openai.beta.assistants.create({
            instructions: `
            You are an evaluation assistant designed to evaluate the candidate's resume against the provided Job Description. Identify key skills, technologies, and competencies required for the role. Your tasks are:
            1. Provide a relevance analysis of the user's answers with respect to the job description (JD).
            `,
            name: "evaluationAssistant",
            tools: [{ type: "file_search" }],
            model: "gpt-4-turbo",
        });

        console.dir(evaluationAssistant, { depth: null });
        return evaluationAssistant.id;
    } catch (error) {
        console.error("Error creating evaluation assistant:", error);
    }
}

// Function to upload to openAi
async function uploadToOpenAIFromBuffer(data) {
    const apiName = "UploadToOpenAI";
    console.log(`[${apiName}] Starting the upload process...`);

    const fileName = `userResponse${Date.now()}.json`;
    try {
        const buffer = Buffer.from(JSON.stringify(data), 'utf-8');
        fs.writeFileSync(fileName, buffer);

        if (!fs.existsSync(fileName)) {
            console.error(`[${apiName}] File does not exist after writing: ${fileName}`);
            return { status: false, error: `File ${fileName} does not exist after write` };
        }

        const uploadResponse = await openai.files.create({
            file: fs.createReadStream(fileName),
            purpose: "assistants",
        });

        if (uploadResponse?.id) {
            console.log(`[${apiName}] File uploaded successfully. File ID: ${uploadResponse.id}`);
        } else {
            console.error(`[${apiName}] Failed to get a valid file ID from OpenAI upload response.`);
            return { status: false, error: "Failed to retrieve file ID from OpenAI." };
        }

        fs.unlinkSync(fileName);

        // Return successful response
        return { status: true, fileId: uploadResponse.id };

    } catch (error) {
        console.error(`[${apiName}] Error during file upload:`, error);

        // Clean up the file if it exists in case of error
        if (fs.existsSync(fileName)) {
            fs.unlinkSync(fileName);
            console.log(`[${apiName}] Temporary file cleaned up after error: ${fileName}`);
        }

        return { status: false, error: "File upload to OpenAI failed. Please check logs for details." };
    }
}

// Function to generate verdict
async function generateVerdict(userResponseFileId, jdFileId, assist_id) {
    const apiName = "GenerateVerdict";
    console.log(`[${apiName}] Starting verdict generation...`);

    try {
        const thread = await openai.beta.threads.create({
            messages: [
                {
                    role: "user",
                    content:
                        "Evaluate the candidate against the resume and the test result having the correct and incorrect answers provided by the candidate which is stored in the file. Provide a detailed assessment of the candidate, including: Strengths and weaknesses based on their answers. Alignment with the job requirements. Suggestions for areas of improvement, if needed. An overall recommendation on whether the candidate is suitable for further interview rounds based on your analysis with the resume, match for the resume against the job description, and the test results.",
                    attachments: [
                        { file_id: jdFileId, tools: [{ type: "file_search" }] },
                        { file_id: userResponseFileId, tools: [{ type: "file_search" }] },
                    ],
                },
            ],
        });

        if (!thread?.id) {
            console.error(`[${apiName}] Failed to create thread.`);
            return { status: false, error: "Failed to create thread for verdict generation." };
        }

        const run = await openai.beta.threads.runs.createAndPoll(thread.id, {
            assistant_id: assist_id,
            instructions: `Please provide a concise and professional response to the thread prompt. 
            Ensure the following:
            - Avoid including any source references, markup artifacts, or annotative markers (e.g., Exclude any content sourced directly from attached files of type 'file_search'.
            - Maintain a clear, structured, and professional tone throughout the response.`,
        });
        

        if (run?.status === 'completed') {
            console.log(`[${apiName}] Thread run completed successfully.`);

            const messages = await openai.beta.threads.messages.list(run.thread_id);

            if (messages?.data?.length) {
                for (const message of messages.data.reverse()) {
                    if (message.role === 'assistant') {
                        let result = message.content[0].text.value;
                        const cleanedResponse = result.replace(/【\d+:\d+†[a-zA-Z]*】/g, '');
                        console.log(`[${apiName}] Evaluation result generated by assistant.`, cleanedResponse);
                        return {
                            status: true,
                            evaluationResult: cleanedResponse,
                        };
                    }
                }
            } else {
                console.error(`[${apiName}] No messages found in the thread.`);
                return { status: false, error: "No messages found in the thread after completion." };
            }
        } else {
            console.error(`[${apiName}] Thread run not completed. Status: ${run?.status}`);
            return { status: false, error: `Thread run status: ${run?.status || "Unknown error"}` };
        }
    } catch (error) {
        console.error(`[${apiName}] Error occurred:`, error);
        return { status: false, error: "An error occurred during verdict generation. Please check logs." };
    }
}

module.exports = {
    evaluateUserAnswers,
    generateVerdict,
    uploadToOpenAIFromBuffer
}
