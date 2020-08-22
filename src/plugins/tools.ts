/* eslint-disable no-await-in-loop */
import child from 'child_process';
import axios from 'axios';
import sharp from 'sharp';
import { App } from 'koishi-core';
import { take, filter } from 'lodash';

export const apply = (app: App) => {
    app.command('tools/tex <code...>', 'KaTeX 渲染')
        .alias('katex <code...>')
        .action(async ({ session }, tex) => {
            let { data: svg } = await axios.get(`https://www.zhihu.com/equation?tex=${encodeURIComponent(tex)}`);
            const text = svg.match(/>([^<]+)<\/text>/);
            if (text) return session.$send(text[1]);
            const viewBox = svg.match(/ viewBox="0 (-?\d*(.\d+)?) -?\d*(.\d+)? -?\d*(.\d+)?" /);
            if (viewBox) svg = svg.replace('\n', `\n<rect x="0" y="${viewBox[1]}" width="100%" height="100%" fill="white"></rect>\n`);
            const png = await sharp(Buffer.from(svg)).png().toBuffer();
            return session.$send(`[CQ:image,file=base64://${png.toString('base64')}]`);
        });

    app.command('tools/ip <ip>', '查询ip').action(async ({ session }, args) => {
        const url = `http://freeapi.ipip.net/${args}`;
        axios.get(url).then((res) => {
            session.$send(res.data.join(' '));
        }).catch((e) => {
            session.$send(e.toString());
        });
    });

    app.command('tools/oeis <sequence>', '使用 OEIS 进行数列查询', { maxUsage: 10 })
        .option('start', '-s <start> 设置起始页码', { fallback: 0 })
        .usage('输入用逗号隔开的数作为要查询的数列的前几项，或者直接输入以 id:A 打头的数列编号。')
        .example('oeis 1,2,3,6,11,23,47,106,235')
        .example('oeis id:A000055')
        .action(async ({ options, session }, sequence) => {
            const { data } = await axios.get(`https://oeis.org/search?fmt=json&q=${sequence}&start=${options.start}`);
            const results = filter(data.results, (result) => !result.name.startsWith('Duplicate'));
            for (const result of take(results, 3)) {
                await session.$sendQueued([
                    `https://oeis.org/A${String(result.number).padStart(6, '0')}`,
                    `${result.name}${result.id ? ` (${result.id})` : ''}`,
                    `${take(result.data.split(','), 10).join(',')}`,
                ].join('\n'));
            }
        });

    app.command('tools/calc <expression...>', '计算表达式', { minInterval: 10000 })
        .example('calc 1+1')
        .example('calc Solve[x^2+1==0,{x}]')
        .example('calc FactorInteger[233333]')
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
            const viewBox = svg.match(/ viewBox="0 (-?\d*(.\d+)?) -?\d*(.\d+)? -?\d*(.\d+)?" /);
            if (viewBox) svg = svg.replace('\n', `\n<rect x="0" y="${viewBox[1]}" width="100%" height="100%" fill="white"></rect>\n`);
            return session.$send(`[CQ:image,file=base64://${(await sharp(Buffer.from(svg)).png().toBuffer()).toString('base64')}]`);
        });
};
