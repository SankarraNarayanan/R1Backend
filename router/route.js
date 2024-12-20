const cors = require('cors');
let documentController = require('../controller/documentController');

module.exports = function (app) {
    app.route('/writePresignedUrl').get(documentController.getPresignedUrlWrite, cors());
    app.route('/readPresignedUrl').get(documentController.getPresignedUrlRead, cors());
}