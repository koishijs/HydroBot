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
                newSession.groupId = undefined;
                newSession.messageType = 'private';
                newSession.subType = 'friend';
            }
            if (options.self) newSession.selfId = +options.self;
            if (options.user) {
                const id = getTargetId(options.user);
                if (!id) return '未指定目标。';
                newSession.userId = id;
                newSession.sender.userId = id;
            }
            await newSession.$send(command);
            let message = '';
            // eslint-disable-next-line no-await-in-loop
            for (let i = 1; i <= options.length; i++) message += await newSession.$prompt(30000);
            return message;
        });
};
