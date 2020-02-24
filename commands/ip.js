'use strict';
const axios = require('axios');
exports.exec = async (args, e, context) => {
    console.log('[IPWhere]Now Looking up :' + args + ' From:' + context.user_id);
    let url = 'http://freeapi.ipip.net/' + args;
    let d = await axios.get(url);
    console.log(d.data);
    return [d.data.join(' ')];
}
