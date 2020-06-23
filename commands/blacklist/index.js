exports.sudo = true;
exports.exec = (args) => ['Current: ', global.App.config.blacklist[args].join(' ')];
