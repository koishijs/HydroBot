import { App } from 'koishi';
import superagent from 'superagent';

export function apply(app: App) {
    app.command('dress <user/id>', '获取指定女装照（如wuxianucw/001.jpg）')
        .action(async (_, id) => {
            const resp = await superagent.get(`https://cdn.jsdelivr.net/gh/komeiji-satori/Dress/${id}`).buffer();
            return `[CQ:image,file=base64://${resp.body.toString('base64')}]`;
        });
}
