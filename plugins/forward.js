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

const FACE_MAP = [
    ['26', 'jk']
]

exports.msg_group = async (e, context) => {
    for (let i of config) {
        if (i[0] == context.group_id) {
            let message = context.message
                .replace(/\[CQ:face,id=([0-9]+)\]/g, substr => {
                    let tmp = /\[CQ:face,id=([0-9]+)\]/i.exec(substr);
                    for (let i of FACE_MAP)
                        if (i[0] == tmp[1]) {
                            tmp[1] = i[1];
                            break;
                        }
                    return ' :' + tmp[1] + ': '
                })
                .replace(/\[CQ:image,file=(.+?),url=(.+?)\]/g, substr => {
                    let tmp = /\[CQ:image,file=(.+?),url=(.+?)\]/i.exec(substr);
                    return `![${tmp[1]}](${tmp[2]})`;
                });
            await rocket.sendToRoomId((context.sender.card || context.sender.nickname) + ': ' + message, i[1]);
        }
    }
};
exports.rocket_msg_group = async (e, context) => {
    for (let i of config) {
        if (i[1] == context.group_id) {
            let message = context.message
                .replace(/\[/g, '&#91;').replace(/\]/g, '&#93;')
                .replace(/:([a-z0-9]+):/g, substr => {
                    let tmp = /:([a-z0-9]+):/i.exec(substr);
                    for (let i of FACE_MAP)
                        if (i[1] == tmp[1]) {
                            tmp[1] = i[0];
                            break;
                        }
                    return '[CQ:face,id=' + tmp[1] + ']';
                });
            CQ('send_group_msg', {
                group_id: i[0], message: (context.sender.card || context.sender.nickname) + ': ' + message
            });
        }
    }
};