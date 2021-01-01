/* eslint-disable no-template-curly-in-string */
import { totalmem, freemem } from 'os';
import { Context } from 'koishi-core';
import { apply as KoishiPluginStatus, extendStatus } from 'koishi-plugin-status';
import moment from 'moment';

declare module 'koishi-plugin-status' {
    interface Status {
        totalSendCount: number,
        totalReceiveCount: number,
        freemem: number,
        usedmem: number,
    }
}

export async function apply(ctx: Context) {
    ctx.plugin(KoishiPluginStatus, {
        formatBot: '{{ label || selfId }}：{{ code ? `无法连接` : `工作中（${rate}/min）` }}',
        format: [
            '{{ bots }}',
            '==========',
            '活跃用户数量：{{ activeUsers }}',
            '活跃群数量：{{ activeGroups }}',
            'CPU 使用率：{{ (cpu.total * 100).toFixed() }}%',
            '内存使用量：{{ usedmem }}M / {{ totalmem }}M',
            '今日收发消息量 {{ totalReceiveCount }}/{{ totalSendCount }}',
        ].join('\n'),
    });

    ctx.app.on('connect', () => {
        const c = ctx.app.database.db.collection('message');

        extendStatus(async (status) => {
            const bots = status.bots.map((bot) => bot.selfId);
            const time = { time: { $gt: moment().add(-1, 'day').toDate() } };
            status.totalSendCount = await c.find({ ...time, sender: { $in: bots } }).count();
            status.totalReceiveCount = await c.find({ ...time, sender: { $nin: bots } }).count();
            status.usedmem = Math.floor((totalmem() - freemem()) / 1024 / 1024);
            status.freemem = Math.floor(freemem() / 1024 / 1024);
        }, true);
    });
}
