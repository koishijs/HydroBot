'use strict';
let axios = require('../modules/axios');
let reg = /^油价>(.*)/i;
let url = 'http://apis.baidu.com/showapi_open_bus/oil_price/find?prov=';
let log = null;
exports.info = {
    id: 'gasPrice',
    author: 'masnn',
    hidden: false,
    contacts: {
        email: 'masnn0@outlook.com',
        github: 'https://github.com/masnn/'
    },
    description: '提供油价查询',
    usage: `
公众开放如下内容：
油价>地区（默认安徽）   查询油价
`
}
exports.init = item => {
    log = item.log;
}
exports.message = (e, context) => {
    if (!reg.test(context.raw_message)) return;
    let tmp = reg.exec(context.raw_message);
    if (tmp[1] == '') tmp[1] = '安徽';
    log.log('[GasPrice]Now Looking up :' + tmp[1] + ' From:' + context.user_id);
    let d = axios.get(url + encodeURIComponent(tmp[1]), {
        apikey: '4febc94b54b90f8cc8090af772c25a21'
    });
    return ['您好！' + tmp[1] + '的油价情况如下:\n\t发布时间:' + d.ct + '\n',
    '0#:' + d.p0 + '\n',
    '90#:' + d.p90 + '\n',
    '93#:' + d.p93 + '\n',
    '97#:' + d.p97];
}
