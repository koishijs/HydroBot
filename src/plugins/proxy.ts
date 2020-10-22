import { Context } from 'koishi-core';
import { getTargetId, Session } from 'koishi-core/dist/session';

export const apply = (ctx: Context) => {
    ctx.command('proxy <command...>', 'Proxy a command', { hidden: true, authority: 4 })
        .option('user', '-u <userId>')
        .option('self', '-s <selfId>')
        .option('group', '-g <groupId>')
        .option('length', '-l <length>', { fallback: 1 })
        .action(async ({ session, options }, command) => {
            const newSession = new Session(ctx.app, session);
            delete newSession.groupId;
            if (options.group) {
                newSession.groupId = +options.group;
                newSession.messageType = 'group';
                newSession.subType = 'normal';
            } else {
                newSession.messageType = 'private';
                newSession.subType = 'other';
            }
            if (options.self) newSession.selfId = +options.self;
            if (options.user) {
                const id = getTargetId(options.user);
                if (!id) return '未指定目标。';
                newSession.userId = id;
                newSession.sender.userId = id;
            }
            if (options.group) {
                const info = await session.$bot.getGroupMemberInfo(newSession.groupId, newSession.userId).catch(() => ({}));
                Object.assign(newSession.sender, info);
            } else if (options.user) {
                const info = await session.$bot.getStrangerInfo(newSession.userId).catch(() => ({}));
                Object.assign(newSession.sender, info);
            }
            await newSession.$send(command);
            let message = '';
            // eslint-disable-next-line no-await-in-loop
            for (let i = 1; i <= options.length; i++) message += await newSession.$prompt(5000);
            return message;
        });
};
