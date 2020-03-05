const _ = require('lodash');
exports.sudo = true;
exports.exec = (args, e, context, { CQ }) => {
    CQ('send_private_msg', { group_id: args.split(' ')[0], message: _.drop(args.split(' ')).join(' ') });
}