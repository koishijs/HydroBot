import { Context } from 'koishi-core';
import { apply as KoishiPluginTeach, Dialogue } from 'koishi-plugin-teach';

declare module 'koishi-core/dist/command' {
    interface CommandConfig {
        noRedirect?: boolean,
    }
}
declare module 'koishi-core/dist/session' {
    interface Session {
        _dialogue?: Dialogue
    }
}

export const apply = (ctx: Context, config: Dialogue.Config) => {
    ctx.plugin(KoishiPluginTeach, config);
    ctx.on('before-command', async ({ session, command }) => {
        const noRedirect = command.getConfig('noRedirect', session);
        if (noRedirect && session._redirected) {
            const creator = await ctx.app.database.getUser(session._dialogue.writer, ['authority']);
            // @ts-ignore
            if (creator.authority < 5 && !creator.sudoer) return '不支持在插值中调用该命令。';
        }
    });
};
