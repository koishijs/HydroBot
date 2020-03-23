const child = require('child_process');

async function _eval({ meta }, args) {
    let res = eval(args);
    if (res instanceof Promise) res = await res;
    if (typeof res == 'string' || res instanceof Array) return await meta.$send(res);
    else if (typeof res == 'object') return await meta.$send(JSON.stringify(res));
    else if (typeof res == 'undefined') return await meta.$send('undefined');
    else return await meta.$send(res.toString());
}
async function _sh({ meta }, args) {
    await meta.$send(child.execSync(args).toString());
}
async function _shutdown({ meta }, args) {
    setTimeout(() => {
        child.exec('pm2 stop robot');
        setTimeout(() => {
            global.process.exit();
        }, 1000);
    }, 3000);
    return await meta.$send('Exiting in 3 secs...');
}
async function _restart({ meta }, args) {
    setTimeout(() => {
        child.exec('pm2 restart robot');
    }, 3000);
    return await meta.$send('Restarting in 3 secs...');
}
async function _start({ meta }, args) {
    global.STOP = false;
    return await meta.$send('started.');
}
async function _stop({ meta }, args) {
    global.STOP = true;
    return await meta.$send('stopped.');
}

exports.apply = (app) => {
    app.command('_.eval <expression...>', '', { authority: 5 }).action(_eval);
    app.command('_.sh <command...>', '', { authority: 5 }).action(_sh);
    app.command('_.shutdown', '', { authority: 5 }).action(_shutdown);
    app.command('_.restart', '', { authority: 5 }).action(_restart);
    app.command('_.start', '', { authority: 5 }).action(_start);
    app.command('_.stop', '', { authority: 5 }).action(_stop);
};