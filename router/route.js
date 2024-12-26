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
 * File: \router\route.js                                                      *
 * Project: r1-backend                                                         *
 * Created Date: Friday, December 20th 2024, 5:06:42 pm                        *
 * Author: Renjith R T <renjith@codestax.ai>                                   *
 * -----                                                                       *
 * Last Modified: December 25th 2024, 10:55:10 pm                              *
 * Modified By: Muthuram                                                       *
 * -----                                                                       *
 * Any app that can be written in JavaScript,                                  *
 *     will eventually be written in JavaScript !!                             *
 * -----                                                                       *
 * HISTORY:                                                                    *
 * Date         By  Comments                                                   *
 * --------------------------------------------------------------------------- *
 */

const cors = require('cors');
let documentController = require('../controller/documentController');
let linkController = require('../controller/linkController')
let jdController = require('../controller/jdController');
let quizController = require('../controller/quizController')

const multer = require('multer');
const upload = multer({ storage: multer.memoryStorage() });


module.exports = function (app) {
    app.route('/uploadFile').post(upload.single('file'),documentController.uploadFile, cors());
    app.route('/readPresignedUrl').get(documentController.getPresignedUrlRead, cors());
    app.route('/sendLink').post(linkController.sendLink, cors());
    app.route('/getListOfJD').get(jdController.getListOfJD, cors());
    app.route('/getAllResumesForJD').get(jdController.getAllResumesForJD, cors());

    // quizControllers
    app.route('/getQuestions/:linkId').get(quizController.getQuestionsWithLinkId, cors());
    app.route('/linkStatusCheck/:linkId').get(quizController.linkStatusCheck, cors());
    app.route('/getInProgressQuestions/:linkId').get(quizController.inprogressQuestionsFetch, cors());
    // app.route('/startTest').post(quizController.startTest, cors());
    app.route('/submitQuestion').post(quizController.submitQuestion, cors());
    app.route('/generateQuestions').post(quizController.generateQuestions, cors());
    app.route('/evaluateAnswers').post(quizController.evaluateAnswers, cors());
}