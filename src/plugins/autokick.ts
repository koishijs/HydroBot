/* eslint-disable no-await-in-loop */
import { CQBot, GroupMemberInfo } from 'koishi-adapter-onebot';
import { Context, Channel } from 'koishi-core';
import { filter, sortBy } from 'lodash';
import moment from 'moment';

declare module 'koishi-core' {
    interface Channel {
        kick: number
    }
    interface Tables {
        autokick: any,
    }
}
Channel.extend(() => ({
    kick: 0,
}));

export async function apply(ctx: Context) {
    ctx.select('platform', 'onebot').command('autokick <count>', '', { hidden: true, authority: 4 })
        .channelFields(['kick'])
        .action(async ({ session }, count) => {
            session.channel.kick = +count;
            return `set to ${count}`;
        });

    ctx.app.on('connect', () => {
        const coll = ctx.app.database.collection('autokick');

        ctx.select('platform', 'onebot').command('autokick.run', '', { hidden: true, authority: 4 })
            .channelFields(['kick'])
            .option('dry', 'dry run', { authority: 2 })
            .action(async ({ session, options }) => {
                const group = await session.bot.getGroup(session.groupId);
                let users = await (session.bot as CQBot).$getGroupMemberList(group.groupId);
                const kicked = (await coll.find({ groupId: session.groupId }).toArray()).map((i) => i.userId);
                users = filter(users, (user) => !kicked.includes(user.userId));
                if (session.channel.kick && session.channel.kick < users.length) {
                    let target: GroupMemberInfo;
                    users = sortBy(users.map((user) => ({ ...user, sort: Math.max(user.lastSentTime, user.joinTime) })), 'sort');
                    for (const user of users) {
                        const udoc = await coll.findOne({ groupId: session.groupId, userId: user.userId });
                        if (!udoc) {
                            target = user;
                            break;
                        }
                    }
                    await session.send([
                        `将 ${target.nickname || target.card} (${target.userId}) 移出群`,
                        `（${moment(target.joinTime * 1000 || 0).fromNow()}加入，上次发言 ${moment(target.lastSentTime * 1000 || 0).fromNow()}）`,
                    ].join('\n'));
                    if (!options.dry) {
                        await Promise.all([
                            (session.bot as CQBot).$setGroupKick(group.groupId, target.userId),
                            coll.insertOne({ groupId: session.groupId, userId: target.userId }),
                        ]);
                    }
                }
            });
    });
}
