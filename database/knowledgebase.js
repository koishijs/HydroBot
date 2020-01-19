module.exports = {
    'knowledgebase': [
        {
            'msg':'关于',
            'res':'About：Robot Turing v1.0.0\nPowered by cq-http-api,Code by masnn',
            'mode':'strict'
        },
        {
            'msg': '真的[?？]',
            'res': '真的！'
        },
        {
            'msg':'假的[!！]',
            'res':'谁说是假的！'
        },
        {
            'reg':/^[?？]/i,
            'res':'?'
        },
        {
            'reg':/^\.+/i,
            'res':'......'
        },
        {
            'reg': /^嘤+/i,
            'res': '嘤嘤嘤'
        }
    ]
};