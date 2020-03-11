exports.sudo = true;
exports.exec = () => {
    global.STOP = true;
    return 'stopped.';
}