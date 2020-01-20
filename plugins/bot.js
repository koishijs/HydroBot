'use strict';
const
    axios = require('axios'),
    RE = /^\!([\s\S]+)$/i, // eslint-disable-line no-useless-escape
    { CQAt } = require('cq-websocket');

let log = null;
let config = {};
let lib = {};

async function getReply(message, user_id = 'public') {
    let res = await axios.post('https://api.ownthink.com/bot', {
        spoken: message, userid: 'masnn_' + user_id,
        appid: config.appid, secret: config.secret
    });
    log.log(res.data.data.info, res.data.message);
    if (res.data.message != 'success') return 'Error';
    return res.data.data.info.text;
}

exports.init = item => {
    log = item.log;
    config = item.config;
    if (config.appid) log.log('Using appid: ', config.appid);
    lib = item.lib;
};
exports.info = {
    id: 'bot',
    author: 'masnn',
    hidden: false,
    contacts: {
        email: 'masnn0@outlook.com',
        github: 'https://github.com/masnn/'
    },
    description: '聊天机器人',
    usage: '通过 !(英文感叹号) 和 @我 触发'
};
exports.msg_private = async (e, context) => {
    log.log('Reply to: ', context.raw_message);
    return await getReply(context.raw_message, context.user_id);
};
exports.msg_group = async (e, context) => {
    if (RE.test(context.raw_message)) {
        let tmp = RE.exec(context.raw_message);
        log.log('(!)Reply to: ', tmp[1]);
        return await getReply(tmp[1], context.user_id);
    } else if (lib.utils.isAtMe(context.raw_message)) {
        let raw = lib.utils.isAtMe(context.raw_message);
        log.log('(@)Reply to: ', raw);
        return [new CQAt(context.user_id), await getReply(raw, context.user_id)];
    }
};
