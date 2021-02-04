import { App } from 'koishi-core';
import superagent from 'superagent';

export function apply(app: App) {
    app.command('github/dress <path>', 'komeiji-satori/Dress')
        .example('dress wuxianucw/001.jpg')
        .action(async ({ session }, id) => {
            try {
                const resp = await superagent.get(`https://cdn.jsdelivr.net/gh/komeiji-satori/Dress/${id}`).buffer();
                await session.send(`[CQ:image,file=base64://${resp.body.toString('base64')}]`);
            } catch (e) {
                return e.toString();
            }
        });
}
