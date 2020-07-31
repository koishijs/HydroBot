const child = require('child_process');
const { svg2png } = require('../utils');

async function _calc({ meta }, expr) {
    expr = expr.decode().replace(/'/gmi, '\\\'').replace(/"/gmi, '\\"');
    console.log(`Calculating ${expr}`);
    let svg;
    try {
        const { stdout, stderr } = child.spawnSync('wolframscript', ['-cloud', '-c', `ExportString[${expr}, "svg"]`, '-timeout', '10']);
        svg = (stdout || '').toString() + (stderr || '').toString();
    } catch (e) {
        console.error(e);
        return meta.$send(e.toString());
    }
    console.log(svg);
    if (!svg.startsWith('<?xml')) return meta.$send(svg);
    return meta.$send(`[CQ:image,file=base64://${await svg2png(svg)}]`);
}
exports.apply = (app) => {
    app.command('calc <expression...>', '计算表达式', { minInterval: 10 }).action(_calc);
};
