import axios from 'axios';
import { Context } from 'koishi-core';

export const apply = (ctx: Context) => {
    ctx.middleware(async (session, next) => {
        if (session.content.includes('https://bot-api.lxns.net/bot-message/')) {
            const res = await axios.get(`https://${session.content.split('https://')[1]}`);
            session.content = res.data.replace(/<.*?>/g, '');
        }
        await next();
    }, true);
};
