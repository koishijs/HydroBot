exports.exec = (args, meta) => {
    meta.$ban(parseInt(args) || 30);
    return;
};