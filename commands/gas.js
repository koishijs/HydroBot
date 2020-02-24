'use strict';
const
    axios = require('axios'),
    url = 'http://apis.baidu.com/showapi_open_bus/oil_price/find?prov=';

exports.exec = async (args, e, context) => {
    if (args == '') args = '安徽';
    console.log('[GasPrice]Now Looking up :' + args + ' From:' + context.user_id);
    let d = await axios.get(url + encodeURIComponent(args), {
        apikey: '4febc94b54b90f8cc8090af772c25a21'
    });
    return [args + ':\n At' + d.ct + '\n',
    '0#:' + d.p0 + '\n',
    '90#:' + d.p90 + '\n',
    '93#:' + d.p93 + '\n',
    '97#:' + d.p97];
};
