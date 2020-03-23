'use strict';
const axios = require('axios');
const beautify = require('json-beautify');
const reg = /\[CQ:image,file=[0-9A-Z]+\.[a-z]+,url=(.+)\]/i;
const url = 'https://trace.moe/api/search?url=';
async function anime({ meta }, args) {
    if (!reg.test(args)) meta.$send('No images sent');
    let tmp = reg.exec(meta.message), ret;
    try {
        let res = await axios.get(url + tmp[1]);
        res.data.docs = [res.data.docs[0]];
        ret = beautify(res.data, null, 2, 80);
    } catch (e) {
        ret = `Request failed: ${e.status}`;
    }
    return meta.$send(ret);
}
exports.register = ({ app }) => {
    app.command('anime <image>', '查询动漫图片出处', { minInterval: 30, showWarning: true }).action(anime);
};