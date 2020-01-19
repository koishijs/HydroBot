'use strict';
const
    axios = require('axios'),
    url = 'https://api.fczbl.vip/hitokoto/';

let log = null;
exports.init = item => {
    log = item.log;
}
exports.info = {
    id: 'hitokoto',
    author: 'masnn',
    hidden: false,
    contacts: {
        email: 'masnn0@outlook.com',
        github: 'https://github.com/masnn/'
    },
    description: '一言',
    usage: `
Hitokoto    获取一言
`
}
exports.message = async (e, context) => {
    if (context.raw_message != 'Hitokoto') return;
    log.log('[Hitokoto]From:' + context.user_id);
    let t = await axios.get(url);
    log.log(t.data);
    return t.data;
}
