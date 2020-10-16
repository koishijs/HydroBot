import { totalmem, freemem } from 'os';
import { BotStatusCode, Context } from 'koishi-core';
import { apply as KoishiPluginStatus, extendStatus } from 'koishi-plugin-status';
import moment from 'moment';

declare module 'koishi-plugin-status' {
    interface Status {
        totalSendCount: number,
        totalReceiveCount: number,
    }
}

export async function apply(ctx: Context) {
    ctx.plugin(KoishiPluginStatus, {
        output({
            bots, cpu, activeUsers, activeGroups, totalSendCount, totalReceiveCount,
        }) {
            const output = bots
                .filter((bot) => bot.code !== BotStatusCode.BOT_IDLE)
                .map(({
                    label, selfId, code, rate,
                }) => `${label || selfId}：${code ? '无法连接' : `工作中（${rate}/min）`}`);

            output.push('==========');
            output.push(
                `活跃用户数量：${activeUsers}`,
                `活跃群数量：${activeGroups}`,
                `CPU 使用率：${(cpu.total * 100).toFixed()}%`,
                `内存使用量：${Math.floor((totalmem() - freemem()) / 1024 / 1024)}M / ${Math.floor(totalmem() / 1024 / 1024)}M`,
                `今日收发消息量 ${totalReceiveCount}/${totalSendCount}`,
            );
            return output.join('\n');
        },
    });

    ctx.app.on('connect', () => {
        const c = ctx.app.database.db.collection('message');

        extendStatus(async (status) => {
            const bots = status.bots.map((bot) => bot.selfId);
            const time = { time: { $gt: moment().add(-1, 'day').toDate() } };
            status.totalSendCount = await c.find({ ...time, sender: { $in: bots } }).count();
            status.totalReceiveCount = await c.find({ ...time, sender: { $nin: bots } }).count();
        }, true);
    });
}
