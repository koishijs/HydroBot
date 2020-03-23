'use strict';
const axios = require('axios');
let config = {};

async function getReply(message, userId = 'public') {
    let res = await axios.post('https://api.ownthink.com/bot', {
        spoken: message, userId,
        appid: config.appid, secret: config.secret
    });
    if (res.data.message != 'success') return 'Error';
    return res.data.data.info.text;
}
exports.init = item => {
    config = item.config;
    if (config.appid) item.log.log('Using appid: ', config.appid);
};
exports.message = async meta => {
    if (meta.$parsed.atMe) {
        return `[CQ:at,qq=${meta.userId}]${getReply(meta.$parsed.message, `${meta.groupId || '0'}_${meta.userId}`)}`;
    } else if (meta.rawMessage.startsWith('!')) {
        return await getReply(meta.rawMessage.slice(0, 1), meta.userId);
    }
};
