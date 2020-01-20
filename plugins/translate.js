'use strict';
const
    translate = require('baidu-translate-api'),
    REG = /^(翻译|translate)>([\s\S]*)/s;

let log = null;
exports.init = item => {
    log = item.log;
};
exports.info = {
    id: 'translate',
    author: 'masnn',
    hidden: false,
    contacts: {
        email: 'masnn0@outlook.com',
        github: 'https://github.com/masnn/'
    },
    description: '翻译',
    usage: 'translate>内容   翻译给定内容至中文'
};
exports.message = async (e, context) => {
    if (!REG.test(context.raw_message)) return;
    let tmp = REG.exec(context.raw_message);
    let t = await translate(tmp[2], { to: 'zh' })
        .catch(log.error);
    return t.trans_result.dst;
};
