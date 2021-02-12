import { Context } from 'koishi-core';
import axios from 'axios';

export function apply(ctx: Context) {
    ctx.command('tools/calc <expr:text>', 'calc', { minInterval: 2000 })
        .shortcut(/^\?([\s\S]+)$/, { args: ['$1'] })
        .option('full', '-f, --full full output')
        .option('raw', '-r, --raw raw input', { authority: 5 })
        .example('calc 1+1')
        .example('calc Solve[x^2+1==0,{x}]')
        .example('calc FactorInteger[233333]')
        .action(async ({ session, options }, expr) => {
            const { data: svg } = await axios.post('http://127.0.0.1:10378/', {
                raw: options.raw ? '1' : null, input: expr.decode(), type: options.full ? 'Image' : 'Result',
            });
            if (!svg.startsWith('<?xml')) return svg;
            const page = await session.$app.browser.newPage();
            await page.setContent(svg);
            const ele = await page.$('svg');
            const buffer = await page.screenshot({
                clip: await ele.boundingBox(),
            });
            page.close();
            return `[CQ:image,file=base64://${buffer.toString('base64')}]`;
        });
}
