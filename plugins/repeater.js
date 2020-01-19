'use strict';
let data_g = {}, data_d = {}, config = {};
exports.init = item => {
    config = item.config;
}
exports.info = {
    id: 'repeater',
    author: 'masnn',
    hidden: false,
    contacts: {
        email: 'masnn0@outlook.com',
        github: 'https://github.com/masnn/'
    },
    description: '自动复读',
    usage: ''
}
exports.msg_group = (e, context) => {
    if (!data_g[context.group_id]) {
        data_g[context.group_id] = {};
        data_g[context.group_id].msg = context.raw_message;
        data_g[context.group_id].t = 1;
    } else {
        if (data_g[context.group_id].msg == context.raw_message)
            data_g[context.group_id].t++;
        else {
            data_g[context.group_id].t = 1;
            data_g[context.group_id].msg = context.raw_message;
        }
        if (data_g[context.group_id].t == config.time)
            return data_g[context.group_id].msg;
    }
}
exports.msg_discuss = (e, context) => {
    if (!data_d[context.discuss_id]) {
        data_d[context.discuss_id] = {};
        data_d[context.discuss_id].msg = context.raw_message;
        data_d[context.discuss_id].t = 1;
    } else {
        if (data_d[context.discuss_id].msg == context.raw_message)
            data_d[context.discuss_id].t++;
        else {
            data_d[context.discuss_id].t = 1;
            data_d[context.discuss_id].msg = context.raw_message;
        }
        if (data_d[context.discuss_id].t == config.time) {
            data_d[context.discuss_id].t = 0;
            return data_d[context.discuss_id].msg;
        }
    }
}
