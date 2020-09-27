import { App } from 'koishi-core';
import superagent from 'superagent';

const table = 'fZodR9XQDSUm21yCkr6zBqiveYah8bt4xsWpHnJE7jL5VG3guMTKNPAwcF';
const tr = {};
for (let i = 0; i < 58; i++) tr[table[i]] = i;
const s = [11, 10, 3, 8, 4, 6];
const r = ['B', 'V', '1', '', '', '4', '', '1', '', '7', '', ''];
const xor = 177451812;
const add = 8728348608;

function decode(source: string) {
    if (source.length !== 12 || (source[0] + source[1] + source[2] + source[5] + source[7] + source[9]).toUpperCase() !== r.join('')) {
        return null;
    }
    let result = 0;
    for (let i = 0; i < 6; i++) {
        result += tr[source[s[i]]] * (58 ** i);
    }
    result = ((result - add) ^ xor);
    return result > 0 && result < 1e9 ? result : null;
}

const RE_BVID: [reg: RegExp, processer: (result: RegExpExecArray) => Promise<number> | number][] = [
    [/(BV[0-9a-zA-Z]{10})/gmi, (result) => decode(result[1])],
    [/av([0-9]+)/gmi, (result) => parseInt(result[1], 10)],
    [/b23\.tv\/([a-zA-Z0-9]+)/gmi, async (result) => {
        const url = `https://b23.tv/${result[1]}`;
        const redirect: string = await new Promise((resolve) => {
            superagent.get(url)
                .buffer(false)
                .end((err, res) => {
                    resolve(res.redirects.length ? res.redirects.pop() : url);
                });
        });
        return decode(redirect.split('video/')[1].split('?')[0]);
    }],
];

export const apply = (app: App) => {
    app.command('bilibili <avid>', { hidden: true })
        .action(async ({ session }, av) => {
            const info = await superagent.get(`http://api.bilibili.com/x/web-interface/view?aid=${av}`);
            if (info.body.code !== 0) return;
            await session.$send(`bilibili.com/video/av${av}\n${info.body.data.title}\n[CQ:image,file=${info.body.data.pic}]`);
        })

    app.middleware(async (session, next) => {
        await next();
        let av: number;
        for (const RE of RE_BVID) {
            const result = RE[0].exec(session.message);
            if (result) {
                const res = RE[1](result);
                // eslint-disable-next-line no-await-in-loop
                if (res instanceof Promise) av = await res;
                else av = res;
                break;
            }
        }
        if (av) await session.$execute('bilibili ' + av);
    });
};
