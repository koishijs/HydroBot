'use strict';
let data = require('../database/knowledgebase');
let log = null;
exports.init = item => { log = item.log; };
exports.info = {
    id: 'autoReply',
    author: 'masnn',
    hidden: true,
    contacts: {
        email: 'masnn0@outlook.com',
        github: 'https://github.com/masnn/'
    },
    description: '根据定义的知识库自动回复',
    usage: ''
};
exports.message = (e, context) => {
    data.knowledgebase.forEach(dat => {
        if (dat.reg) {
            if (dat.reg.test(context.raw_message)) {
                e.setMessage(dat.res);
                return;
            }
        } else if (dat.msg) {
            if (dat.mode == 'strict') {
                if (context.raw_message == dat.msg) {
                    e.setMessage(dat.res);
                    return;
                }
            } else {
                dat.reg = new RegExp('^[\s\S]*' + dat.msg + '[\s\S]*'); // eslint-disable-line no-useless-escape
                if (dat.reg.test(context.raw_message)) {
                    e.setMessage(dat.res);
                    return;
                }
            }
        }
    });
};
exports.reload = () => {
    try {
        data = require('../database/knowledgebase');
    } catch (err) {
        log.error(err);
        return;
    }
    log.log('[AutoReply] Reloaded.');
};