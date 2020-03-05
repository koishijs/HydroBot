'use strict';
const Axios = require('axios');
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
let config, CQ, rocket, axios;
exports.init = item => {
    config = item.config || {};
    CQ = item.CQ;
    rocket = item.rocket;
    if (!rocket) throw new Error('No rocket server for forwarding');
    axios = Axios.create({
        baseURL: config.image.host,
        headers: {
            'Content-Type': 'application/x-www-form-urlencoded'
        },
        transformRequest: [
            function (data) {
                let ret = '';
                for (let it in data)
                    ret += encodeURIComponent(it) + '=' + encodeURIComponent(data[it]) + '&';
                return ret.substr(0, ret.length - 1);
            }
        ]
    });
};

const FACE_MAP = [
    ['2', 'se'],
    ['13', 'cy'],
    ['26', 'jk'],
    ['32', 'yiw'],
    ['76', 'qiang'],
    ['107', 'kk'],
    ['111', 'kel'],
    ['178', 'xyx'],
    ['182', 'xk'],
    ['212', 'ts']
]

exports.msg_group = async (e, context) => {
    for (let i of config.maps) {
        if (i[0] == context.group_id) {
            let images = [], attachments = [];
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
                    images.push([tmp[1], tmp[2]]);
                    return '';
                });
            for (let i of images) {
                let res = await axios.post('/api/1/upload', {
                    key: config.image.key,
                    source: i[1],
                    format: 'json'
                });
                console.log('url=', res.data.image.image.url)
                attachments.push({ image_url: res.data.image.image.url });
            }
            let msgobj = rocket.prepareMessage((context.sender.card || context.sender.nickname) + ': ' + message, i[1]);
            msgobj.attachments = attachments;
            await rocket.sendMessage(msgobj);
        }
    }
};
exports.rocket_msg_group = async (e, context) => {
    for (let i of config.maps) {
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