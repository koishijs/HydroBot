import superagent from 'superagent';
import { App } from 'koishi-core';

const reg = /\[CQ:image,file=[0-9A-Z]+\.[a-z]+,url=(.+)\]/i;
const url = 'https://trace.moe/api/search?url=';
async function anime({ session }, args) {
    if (!reg.test(args)) session.$send('No images sent');
    const tmp = reg.exec(session.message);
    let ret;
    try {
        const res = await superagent.get(url + tmp[1]);
        res.body.docs = [res.body.docs[0]];
        ret = JSON.stringify(res.body, null, 2);
    } catch (e) {
        ret = `Request failed: ${e.status}`;
    }
    return session.$send(ret);
}
export const apply = (app: App) => {
    app.command('anime <image>', '查询动漫图片出处', { minInterval: 10000, showWarning: true }).action(anime);
};
