import { Context } from 'koishi-core';

declare module 'koishi-core/dist/database' {
    interface User {
        sudoer?: boolean,
    }
}
declare module 'koishi-core/dist/session' {
    interface Session {
        _sudo?: boolean,
    }
}

export function apply(ctx: Context) {
    ctx.command('sudo <command...>', { hidden: true, noRedirect: true })
        .userFields(['sudoer', 'authority'])
        .action(async ({ session }, command) => {
            if (!session.$user.sudoer) throw new Error('You are not in the sudoers file.');
            const old = session.$user.authority;
            session.$user.authority = 5;
            session._sudo = true;
            await session.$execute(command);
            session.$user.authority = old;
        });
}
