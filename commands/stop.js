exports.sudo = true;
exports.exec = () => {
    setTimeout(() => {
        child.exec('pm2 stop robot');
        setTimeout(() => {
            global.process.exit();
        }, 1000);
    }, 3000);
    return 'Exiting in 3 secs...';
}