/* eslint-disable no-await-in-loop */
import { Context, Group } from 'koishi-core';
import { sortBy, sort } from 'lodash';
import moment from 'moment';

declare module 'koishi-core/dist/database' {
    interface Group {
        kick: number
    }
}

Group.extend(() => ({
    kick: 0,
}));

export async function apply(ctx: Context) {
    ctx.command('autokick <count>', '', { hidden: true, authority: 4 })
        .groupFields(['kick'])
        .action(async ({ session }, count) => {
            session.$group.kick = +count;
            return `set to ${count}`;
        });

    ctx.command('autokick.run [groupId]', '', { hidden: true, authority: 4 })
        .groupFields(['kick'])
        .option('dry', 'dry run', { authority: 2 })
        .action(async ({ session, options }, groupId) => {
            const groupList = groupId ? [await session.$bot.getGroupInfo(+groupId)] : await session.$bot.getGroupList();
            for (const group of groupList) {
                const gdoc = await session.$app.database.getGroup(group.groupId, ['kick']);
                if (gdoc.kick && gdoc.kick < group.memberCount) {
                    let users = await session.$bot.getGroupMemberList(group.groupId);
                    users = sortBy(users.map((user) => ({ ...user, sort: Math.max(user.lastSentTime, user.joinTime) })), 'sort');
                    await session.$send([
                        `将 ${users[0].nickname || users[0].card} (${users[0].userId}) 移出群`,
                        `（${moment(users[0].joinTime * 1000 || 0).fromNow()}加入，上次发言 ${moment(users[0].lastSentTime * 1000 || 0).fromNow()}）`,
                    ].join('\n'));
                    if (!options.dry) await session.$bot.setGroupKick(group.groupId, users[0].userId);
                }
            }
        });
}
