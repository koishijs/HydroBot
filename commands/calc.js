const child = require('child_process');
const { svg2png } = require('../utils');

async function _calc({ meta }, expr) {
    expr = expr.decode().replace(/'/gmi, '\\\'').replace(/"/gmi, '\\"');
    console.log(`Calculating ${expr}`);
    let svg;
    try {
        const { stdout, stderr } = child.spawnSync('wolframscript', ['-c', `ExportString[${expr}, "svg"]`, '-timeout', '10']);
        svg = stdout + stderr;
    } catch (e) {
        return meta.$send(e.toString());
    }
    if (!svg.startsWith('<?xml')) return meta.$send(svg);
    return meta.$send(`[CQ:image,file=base64://${await svg2png(svg)}]`);
}
exports.register = ({ app }) => {
    app.command('calc <expression>', '计算表达式', { minInterval: 10 }).action(_calc);
};
