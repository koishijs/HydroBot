'use strict';
const axios = require('axios');
const beautify = require('json-beautify');
const reg = /^anime>.*\[CQ:image,file=[0-9A-Z]+\.[a-z]+,url=(.+)\]/i;
const url = 'https://trace.moe/api/search?url=';
let log = null;
exports.init = item => {
    log = item.log;
}
exports.info = {
    id: 'anime',
    author: 'masnn',
    hidden: false,
    contacts: {
        email: 'masnn0@outlook.com',
        github: 'https://github.com/masnn/'
    },
    description: '',
    usage: ''
}
exports.message = async (e, context) => {
    if (!reg.test(context.message)) return;
    let tmp = reg.exec(context.message), ret;
    log.log('[Anime] looking up :' + tmp[1] + ' From:' + context.user_id);
    try {
        let res = await axios.get(url + tmp[1]);
        res.data.docs = [res.data.docs[0]]
        ret = [beautify(res.data, null, 2, 80), '\nPowered By trace.moe']
    } catch (e) {
        ret = ['Request failed: ', e.status];
    }
    return ret;
}
