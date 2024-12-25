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
 * Last Modified: December 25th 2024, 12:46:02 pm                              *
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
    apiKey: process.env.API_key
});

// Function to evaluate user answers
function evaluateUserAnswers(questionData, userAnswers) {
    const correctAnswers = [];
    const wrongAnswers = [];

    // Loop through the questions to compare user answers
    questionData.questions.forEach((question) => {
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

// Function to upload user evaluations and questions
async function writeToFile(fileName, fileData) {
    return new Promise((resolve, reject) => {

        fs.writeFile(fileName, JSON.stringify(fileData), 'utf8', (err) => {
            if (err) {
                reject('Error writing to file:', err);
            } else {
                console.log('Data successfully written to file');
                resolve(fileName);
            }
        });
    });
}

async function uploadToOpenAI(fileName) {
    try {
        const userEvaluationsUpload = await openai.files.create({
            file: fs.createReadStream(fileName),
            purpose: "assistants",
        });
        console.log("User evaluations uploaded:", userEvaluationsUpload);
        return userEvaluationsUpload.id;
    } catch (error) {
        console.error("Error uploading data:", error);
    }
}

async function deleteFile(fileName) {
    return new Promise((resolve, reject) => {
        fs.unlink(fileName, (err) => {
            if (err) {
                reject(`Error deleting file: ${err.message}`);
            } else {
                console.log(`File ${fileName} successfully deleted.`);
                resolve(`File ${fileName} deleted.`);
            }
        });
    });
}

async function writeFileToOpenAi(file, fileData) {
    try {
        // Write to file first
        const fileName = await writeToFile(file, fileData);

        // Now upload the file to OpenAI
        const fileId = await uploadToOpenAI(fileName);
        if(fileId){
            deleteFile(fileName);
        }
        return fileId;
    } catch (error) {
        console.error("Error in the process:", error);
    }
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

// Function to generate verdict
async function generateVerdict(files, assist_id) {
    const { userResponseFileId, jdFileId } = files;

    const thread = await openai.beta.threads.create({
        messages: [
            {
                role: "user",
                content:
                    "Evaluate the candidate against the resume and the test result having the correct and incorrect answers provided by the candidate which is stored in the file. and Provide a detailed assessment of the candidate, including: Strengths and weaknesses based on their answers. Alignment with the job requirements. Suggestions for areas of improvement, if needed. An overall recommendation on whether the candidate is suitable for further interview rounds based on your analysis with the resume, match for the resume against the job description and the test results.",
                attachments: [
                    { file_id: jdFileId, tools: [{ type: "file_search" }] },
                    { file_id: userResponseFileId, tools: [{ type: "file_search" }] }
                ],
            },
        ],
    });

    const run = await openai.beta.threads.runs.createAndPoll(
        thread.id,
        {
            assistant_id: assist_id,
            instructions: "Evaluate the candidate against the resume and the test result having the correct and incorrect answers provided by the candidate which is stored in the file. and Provide a detailed assessment of the candidate, including: Strengths and weaknesses based on their answers. Alignment with the job requirements. Suggestions for areas of improvement, if needed. An overall recommendation on whether the candidate is suitable for further interview rounds based on your analysis with the resume, match for the resume against the job description and the test results.",
        }
    );

    if (run.status === 'completed') {
        const messages = await openai.beta.threads.messages.list(
            run.thread_id
        );
        for (const message of messages.data.reverse()) {
            console.log(`${message.role} > ${message.content[0].text.value}`);
        }
    } else {
        console.log(run.status);
    }
    console.log(run);
}

// async function main() {
//     const jsonObject = {
//         key1: "value1",
//         key2: "value2",
//     };
//     await writeFileToOpenAi(`userResponse${Date.now()}.json`, jsonObject);
// }

// Run the main function
// main().catch(console.error);

module.exports = {
    deleteFile,
    evaluateUserAnswers,
    generateVerdict,
    uploadToOpenAI,
    writeToFile,
    writeFileToOpenAi
}
