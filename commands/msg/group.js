const _ = require('lodash');

exports.sudo = true;
exports.exec = (args, e, context, { CQ }) => {
    CQ('send_group_msg', { groupId: args.split(' ')[0], message: _.drop(args.split(' ')).join(' ') });
};
