import { App } from 'koishi';
import { getPage } from '../lib/graph';

export const apply = (app: App) => {
    app.command('page <url...>', 'Get page', { minInterval: 1000 })
        .option('--full', 'Full page')
        .option('--viewport <viewport>', '指定Viewport', { default: '1600x900' })
        .action(({ session, options }, message) => {
            const url = message.trim();
            console.log(url);
            if (!url) return session.$send('请输入要打开的 URL。');
            const t = options.viewport.split('x');
            if (t.length !== 2) return session.$send('Invalid vieport');
            return getPage(url, options.full, options.viewport)
                .catch((e: Error) => session.$send(`${e.toString()} at ${url}`))
                .then((image: string) => session.$send(`[CQ:image,file=base64://${image}]`));
        });
};
