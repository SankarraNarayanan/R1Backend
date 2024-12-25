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
 * Last Modified: December 25th 2024, 12:51:37 pm                              *
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
require('dotenv').config();
const fs = require('fs');
const { error } = require('console');

const openai = new OpenAI({
    apiKey: process.env.API_KEY
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
async function writeToFile(userEvaluations) {
    return new Promise((resolve, reject) => {
        const fileName = `userResponse_${Date.now()}.json`;

        fs.writeFile(fileName, JSON.stringify(userEvaluations), 'utf8', (err) => {
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

async function uploadUserEvaluationsAndQuestions(userEvaluations) {
    try {
        // Write to file first
        const fileName = await writeToFile(userEvaluations);

        // Now upload the file to OpenAI
        const fileId = await uploadToOpenAI(fileName);

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

// Main function to execute the workflow
async function main() {
    // Define questions and answers
    const questions = {
        "questions": [
            {
                "id": "q1",
                "question": "You are tasked with implementing a secure communication system between the front-end and back-end of your application using Node.js and React. What is the best approach to achieve this?",
                "choices": {
                    "a": "Use HTTPS and JSON Web Tokens for secure data transfer",
                    "b": "Encrypt data using a custom algorithm at the front-end",
                    "c": "Only use GET requests for sensitive data transfer",
                    "d": "None of the above"
                },
                "answer": "a"
            },
            {
                "id": "q2",
                "question": "When optimizing an SQL query in a Node.js application that handles large volumes of data, which of the following techniques should be prioritized?",
                "choices": {
                    "a": "Use cover indexes to reduce I/O operations",
                    "b": "Increase the number of records fetched in each query",
                    "c": "Avoid indexing and let the database engine optimize the search",
                    "d": "Replace SQL with a NoSQL database"
                },
                "answer": "a"
            },
            {
                "id": "q3",
                "question": "If a user experiences slow load times on a web application you developed with React and Node.js, where would you first check for potential bottlenecks?",
                "choices": {
                    "a": "Network latency issues",
                    "b": "Database query performance",
                    "c": "Client-side JavaScript execution",
                    "d": "All of the above"
                },
                "answer": "d"
            },
            {
                "id": "q4",
                "question": "How would you implement an interactive data visualization feature in a React application, considering your experience with MongoDB?",
                "choices": {
                    "a": "Use MongoDB data directly in React components",
                    "b": "Use a server-side rendering technique to prepare data visuals",
                    "c": "Integrate a tool like Kibana UI for displaying data",
                    "d": "Fetch the data from MongoDB and use libraries like D3.js or Recharts in React"
                },
                "answer": "d"
            },
            {
                "id": "q5",
                "question": "What is the primary purpose of using Redux in a React application?",
                "choices": {
                    "a": "To enhance CSS styling capabilities",
                    "b": "To manage state across multiple components",
                    "c": "To interface directly with the API",
                    "d": "To reduce the size of the application bundle"
                },
                "answer": "b"
            },
            {
                "id": "q6",
                "question": "You are redesigning a web application to improve its scalability. What key change would you implement in your Node.js backend?",
                "choices": {
                    "a": "Implement load balancing across multiple server instances",
                    "b": "Consolidate all client-side code into a single JavaScript file",
                    "c": "Reduce server-side logging",
                    "d": "Increase session expiration time"
                },
                "answer": "a"
            },
            {
                "id": "q7",
                "question": "Given your expertise with JavaScript, HTML, and CSS, how would you optimize a web page's load time?",
                "choices": {
                    "a": "Minimize the number of HTTP requests",
                    "b": "Use only inline styles for CSS",
                    "c": "Increase the number of global variables",
                    "d": "Avoid using external JavaScript libraries"
                },
                "answer": "a"
            },
            {
                "id": "q8",
                "question": "When tasked with implementing a proof of concept (PoC) for a new feature in your application using Vue.js, what is your first step?",
                "choices": {
                    "a": "Directly code the feature into the main application",
                    "b": "Sketch the UI elements using Figma",
                    "c": "Define the scope and requirements clearly in a document",
                    "d": "Create detailed back-end specifications"
                },
                "answer": "c"
            },
            {
                "id": "q9",
                "question": "What is the most effective way to utilize AWS services (like S3 and EC2) to enhance your application's performance?",
                "choices": {
                    "a": "Store static files in EC2 for quicker access",
                    "b": "Utilize S3 for data warehousing",
                    "c": "Deploy the application on EC2 instances and use S3 for backup",
                    "d": "Use S3 for storing static assets and serve them via a Content Delivery Network (CDN)"
                },
                "answer": "d"
            },
            {
                "id": "q10",
                "question": "In a collaborative project, how do you ensure code quality and consistency across the development team?",
                "choices": {
                    "a": "Conduct frequent in-person code reviews",
                    "b": "Implement automated linting and formatting tools",
                    "c": "Limit repository access to senior developers only",
                    "d": "Avoid using version control systems to simplify the process"
                },
                "answer": "b"
            }
        ]
    };

    const answers = {
        "q1": "a",
        "q2": "b",
        "q3": "d",
        "q4": "c",
        "q5": "b",
        "q6": "d",
        "q7": "a",
        "q8": "a",
        "q9": "d",
        "q10": "a"
    };

    // Step 1: Evaluate user answers
    const evaluatedResponse = evaluateUserAnswers(questions, answers);
    console.log('Evaluated Response:', JSON.stringify(evaluatedResponse));

    // Step 2: Upload user evaluations and questions
    const file_id = await uploadUserEvaluationsAndQuestions(evaluatedResponse);
    console.log('File ID:', file_id);

    // Step 3: Create evaluation assistant
    const assist_id = await createEvaluationAssistant();
    console.log('Assist ID:', assist_id);

    // Step 4: Generate verdict based on evaluation
    const fileIds = {
        userResponseFileId: file_id,
        jdFileId: "file-H1rKbuckfpD7gWBukaGny6"
    };
    await generateVerdict(fileIds, assist_id);
}

// Run the main function
main().catch(console.error);
