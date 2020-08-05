import axios from 'axios';
import { App } from 'koishi';
import { svg2png } from '../lib/graph';

export const apply = (app: App) => {
    app.command('tex <code...>', 'KaTeX 渲染')
        .alias('katex <code...>')
        .usage('渲染器由 https://www.zhihu.com/equation 提供。')
        .action(async ({ session }, tex) => {
            let { data: svg } = await axios.get(`https://www.zhihu.com/equation?tex=${encodeURIComponent(tex)}`);
            const text = svg.match(/>([^<]+)<\/text>/);
            if (text) return session.$send(text[1]);
            const viewBox = svg.match(/ viewBox="0 (-?\d*(.\d+)?) -?\d*(.\d+)? -?\d*(.\d+)?" /);
            if (viewBox) svg = svg.replace('\n', `\n<rect x="0" y="${viewBox[1]}" width="100%" height="100%" fill="white"></rect>\n`);
            return session.$send(`[CQ:image,file=base64://${await svg2png(svg)}]`);
        });
};
