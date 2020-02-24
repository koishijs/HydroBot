exports.sudo = true;
exports.exec = args => require('child_process').execSync(args).toString();