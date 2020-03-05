exports.sudo = true;
exports.exec = () => {
    setTimeout(() => {
        child.exec('pm2 restart robot');
    }, 3000);
    return 'Restarting in 3 secs...';
}