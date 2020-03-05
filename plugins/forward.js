'use strict';
exports.info = {
    id: 'forward',
    author: 'masnn',
    hidden: true,
    contacts: {
        email: 'masnn0@outlook.com',
        github: 'https://github.com/masnn/'
    },
    description: 'Group message forwarder',
    usage: ''
};
let config, CQ, rocket;
exports.init = item => {
    config = item.config || {};
    CQ = item.CQ;
    rocket = item.rocket;
    if (!rocket) throw new Error('No rocket server for forwarding');
};
exports.msg_group = async (e, context) => {
    for (let i of config) {
        if (i[0] == context.group_id) await rocket.sendToRoomId((context.sender.card || context.sender.nickname) + ': ' + context.message, i[1]);
    }
};
exports.rocket_msg_group = async (e, context) => {
    for (let i of config) {
        if (i[1] == context.group_id) CQ('send_group_msg', {
            group_id: i[0], message: (context.sender.card || context.sender.nickname) + ': ' + context.message
        });
    }
};