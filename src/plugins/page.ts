import { App } from 'koishi-core';
import { getPage } from '../lib/graph';

export const apply = (app: App) => {
    app.command('page <url...>', 'Get page', { minInterval: 1000 })
        .option('full', '-f Full page', { value: false })
        .option('viewport', '<viewport> 指定Viewport', { fallback: '1600x900' })
        .action(({ session, options }, message) => {
            const url = message.trim();
            console.log(url);
            const t = options.viewport.split('x');
            if (t.length !== 2) return session.$send('Invalid vieport');
            return getPage(url, options.full, options.viewport)
                .then((image: string) => session.$send(`[CQ:image,file=base64://${image}]`))
                .catch((e: Error) => session.$send(`${e.toString()} at ${url}`));
        });
};
