import child from 'child_process';
import { svg2png } from '../lib/graph';

async function _calc({ session }, expr) {
    expr = expr.decode().replace(/'/gmi, '\\\'').replace(/"/gmi, '\\"');
    console.log(`Calculating ${expr}`);
    let svg: string;
    try {
        const { stdout, stderr } = child.spawnSync('wolframscript', ['-cloud', '-c', `ExportString[${expr}, "svg"]`, '-timeout', '10']);
        svg = (stdout || '').toString() + (stderr || '').toString();
    } catch (e) {
        console.error(e);
        return session.$send(e.toString());
    }
    console.log(svg);
    if (!svg.startsWith('<?xml')) return session.$send(svg);
    return session.$send(`[CQ:image,file=base64://${await svg2png(svg)}]`);
}

export const apply = (app) => {
    app.command('calc <expression...>', '计算表达式', { minInterval: 10000 }).action(_calc);
};
