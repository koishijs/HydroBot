'use strict';
const
    axios = require('axios'),
    reg = /^[Ii][Pp]>([0-9]+\.[0-9]+\.[0-9]+\.[0-9]+)/i;

let log = null;
exports.init = item => {
    log = item.log;
}
exports.info = {
    id: 'ipWhere',
    author: 'masnn',
    hidden: false,
    contacts: {
        email: 'masnn0@outlook.com',
        github: 'https://github.com/masnn/'
    },
    description: '查询ip',
    usage: 'ip>IP地址   查询IP信息'
}
exports.message = async (e, context) => {
    if (!reg.test(context.raw_message)) return;
    let tmp = reg.exec(context.raw_message);
    log.log('[IPWhere]Now Looking up :' + tmp[1] + ' From:' + context.user_id);
    let url = 'http://freeapi.ipip.net/' + tmp[1];
    let d = await axios.get(url);
    console.log(d.data);
    return [d.data.join(' ')];
}
