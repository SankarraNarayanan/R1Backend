const Responses = {
    defineResponse(statusCode = 502, data = {}) {
        const responseData = { ...data, 'timeStamp': new Date().toISOString(), 'success': statusCode < 400, };
        return {
            headers: {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*',
            },
            statusCode,
            body: JSON.stringify(responseData)
        };
    }
};
module.exports = Responses;