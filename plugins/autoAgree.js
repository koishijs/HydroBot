'use strict';
let CQ = null;
let config = {};
exports.init = item => {
    CQ = item.CQ;
    config = item.config;
};
exports.info = {
    id: 'autoAgree',
    hidden: true,
    author: 'masnn',
    contacts: {
        email: 'masnn0@outlook.com',
        github: 'https://github.com/masnn/'
    },
    description: '自动同意加好友/加群请求'
};
exports.request_friend = context => {
    if (config.friend) CQ('set_friend_add_request', { flag: context.flag });
};
exports.request_group = context => {
    if (config.group) CQ('set_group_add_request', { flag: context.flag, type: context.sub_type });
};
