/* eslint-disable no-template-curly-in-string */
import { totalmem, freemem } from 'os';
import { Context } from 'koishi-core';
import { apply as KoishiPluginStatus, extend } from 'koishi-plugin-status';
import moment from 'moment';

declare module 'koishi-plugin-status' {
    interface Status {
        totalSendCount: number,
        totalReceiveCount: number,
        usedmem: number,
        totalmem: number,
    }
}

export async function apply(ctx: Context) {
    ctx.plugin(KoishiPluginStatus, {
        formatBot: '{{ label || selfId }}：{{ code ? `无法连接` : `工作中（${rate}/min）` }}',
        format: [
            '{{ bots }}',
            '==========',
            '用户数量：{{ activeUsers }}',
            '群数量：{{ activeGroups }}',
            'CPU 使用率：{{ (cpu.total * 100).toFixed() }}%',
            '内存使用量：{{ usedmem }}M / {{ totalmem }}M',
            '今日收发消息量 {{ totalReceiveCount }}/{{ totalSendCount }}',
        ].join('\n'),
    });

    ctx.app.on('connect', () => {
        const c = ctx.app.database.collection('message');

        extend(async (status) => {
            const udocs = await Promise.all(
                status.bots.map((bot) => ctx.app.database.getUser(bot.platform, bot.selfId.toString())),
            );
            const ids = udocs.map((i) => i.id);
            const time = { time: { $gt: moment().add(-1, 'day').toDate() } };
            status.activeUsers = await ctx.app.database.user.find({}).count();
            status.totalSendCount = await c.find({ ...time, sender: { $in: ids } }).count();
            status.totalReceiveCount = await c.find({ ...time, sender: { $nin: ids } }).count();
            status.usedmem = Math.floor((totalmem() - freemem()) / 1024 / 1024);
            status.totalmem = Math.floor(totalmem() / 1024 / 1024);
        });
    });
}
