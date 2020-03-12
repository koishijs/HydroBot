exports.sudo = true;
exports.exec = args => {
    return ['Current: ', global.App.config.blacklist[args].join(' ')];
}