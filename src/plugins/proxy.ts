import { Context } from 'koishi-core';
import { getTargetId, Session } from 'koishi-core/dist/session';

export const apply = (ctx: Context) => {
    ctx.command('proxy <command...>', 'Proxy a command', { hidden: true, authority: 4 })
        .option('id', '-u <userId>')
        .option('group', '-g <groupId>')
        .option('length', '-l <length>', { fallback: 1 })
        .action(async ({ session, options }, command) => {
            const newSession = new Session(session.$app, session);
            newSession.userId = getTargetId(options.id);
            newSession.groupId = getTargetId(options.group);
            await newSession.$send(command);
            let message = '';
            // eslint-disable-next-line no-await-in-loop
            for (let i = 1; i <= options.length; i++) message += await newSession.$prompt(5000);
            return message;
        });
};
