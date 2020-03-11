exports.sudo = true;
exports.exec = args => {
    args = args.split(' ');
    global.App.config.blacklist[args[0]].push(parseInt(args[1]) || args[1]);
    return ['Added ', args[0], ' ', args[1]];
}