const child = require('child_process');
const text2img = require('../text2img');

async function _eval({ meta }, args) {
    // eslint-disable-next-line no-eval
    let res = eval(args);
    if (res instanceof Promise) res = await res;
    if (typeof res === 'string' || res instanceof Array) return await meta.$send(res.toString());
    if (typeof res === 'object') return await meta.$send(JSON.stringify(res));
    if (typeof res === 'undefined') return await meta.$send('undefined');
    return await meta.$send(res.toString());
}
async function _sh({ meta }, args) {
    const p = child.execSync(args).toString();
    const img = await text2img(p);
    return await meta.$send(`[CQ:image,file=base64://${img.replace('data:image/png;base64,', '')}]`);
}
async function _shutdown({ meta }) {
    setTimeout(() => {
        child.exec('pm2 stop robot');
        setTimeout(() => {
            global.process.exit();
        }, 1000);
    }, 3000);
    return await meta.$send('Exiting in 3 secs...');
}
async function _restart({ meta }) {
    setTimeout(() => {
        child.exec('pm2 restart robot');
    }, 3000);
    return await meta.$send('Restarting in 3 secs...');
}
async function _ignore() { }

exports.apply = (app) => {
    app.command('_', '', { authority: 5 }).action(_ignore);
    app.command('_.eval <expression...>', '', { authority: 5 }).action(_eval);
    app.command('_.sh <command...>', '', { authority: 5 }).action(_sh);
    app.command('_.shutdown', '', { authority: 5 }).action(_shutdown);
    app.command('_.restart', '', { authority: 5 }).action(_restart);
};
