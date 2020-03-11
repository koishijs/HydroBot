const _ = require('lodash');
exports.sudo = true;
exports.exec = args => {
    args = args.split(' ');
    global.App.config.blacklist[args[0]] = _.pull(global.App.config.blacklist[args[0]], parseInt(args[1]) || args[1]);
    return ['Removed ', args[0], ' ', args[1]];
}