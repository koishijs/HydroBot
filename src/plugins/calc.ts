import child from 'child_process';
import { App } from 'koishi';
import { svg2png } from '../lib/graph';

export const apply = (app: App) => {
    app.command('calc <expression...>', '计算表达式', { minInterval: 10000 })
        .action(async ({ session }, expr) => {
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
            if (!svg.startsWith('<?xml')) return session.$send(svg);
            return session.$send(`[CQ:image,file=base64://${await svg2png(svg)}]`);
        });
};
