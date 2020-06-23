const _ = require('lodash');

exports.sudo = true;
exports.exec = (args, e, context, { CQ }) => {
    CQ('send_private_msg', { userId: args.split(' ')[0], message: _.drop(args.split(' ')).join(' ') });
};
