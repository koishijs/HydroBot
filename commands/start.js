exports.sudo = true;
exports.exec = () => {
    global.STOP = false;
    return 'started.';
}