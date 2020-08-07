import child from 'child_process';
import { App, Group } from 'koishi';
import { getTargetId } from 'koishi-core';
import { text2png } from '../lib/graph';

export const apply = (app: App) => {
    app.command('_', '', { authority: 5 })
        .action(() => { });

    app.command('_.eval <expression...>', '', { authority: 5 })
        .action(async ({ session }, args) => {
            // eslint-disable-next-line no-eval
            let res = eval(args);
            if (res instanceof Promise) res = await res;
            if (typeof res === 'string' || res instanceof Array) return await session.$send(res.toString());
            if (typeof res === 'object') return session.$send(JSON.stringify(res));
            if (typeof res === 'undefined') return session.$send('undefined');
            return session.$send(res.toString());
        });

    app.command('_.sh <command...>', '', { authority: 5 })
        .action(async ({ session }, cmd) => {
            const p = child.execSync(cmd).toString();
            if (!p.trim().length) return session.$send('(execute success)');
            const img = await text2png(p);
            return session.$send(`[CQ:image,file=base64://${img}]`);
        });

    app.command('_.shutdown', '', { authority: 5 })
        .action(({ session }) => {
            setTimeout(() => {
                child.exec('pm2 stop robot');
                setTimeout(() => {
                    global.process.exit();
                }, 1000);
            }, 3000);
            return session.$send('Exiting in 3 secs...');
        });

    app.command('_.restart', '', { authority: 5 })
        .action(({ session }) => {
            setTimeout(() => {
                child.exec('pm2 restart robot');
            }, 3000);
            return session.$send('Restarting in 3 secs...');
        });

    app.command('_.leave', '', { authority: 5 })
        .action(({ session }) => session.$bot.setGroupLeave(session.groupId));

    app.command('_.setPriv <userId> <authority>', '', { authority: 5 })
        .action(async ({ session }, userId: string, authority: string) => {
            await session.$app.database.setUser(
                getTargetId(userId), { authority: parseInt(authority, 10) },
            );
            return `Set ${userId} to ${authority}`;
        });

    app.command('_.deactivate', '', { authority: 3 })
        .groupFields(['flag'])
        .action(({ session }) => {
            session.$group.flag |= Group.Flag.ignore;
        });

    app.command('_.activate', '', { authority: 3 })
        .groupFields(['flag'])
        .action(({ session }) => {
            session.$group.flag &= ~Group.Flag.ignore;
        });

    app.command('_.mute <user> <periodSecs>', '', { authority: 3 })
        .action(({ session }, user, secs = '600000') =>
            session.$bot.setGroupBan(session.groupId, getTargetId(user), parseInt(secs, 10)));

    app.on('message/group', async (session) => {
        await Promise.all([
            session.$observeUser(['authority']),
            session.$observeGroup(['flag']),
        ]);
        // @ts-expect-error
        if (session.message === '>_.activate' && session.$user.authority >= 3) {
            // @ts-expect-error
            session.$group.flag &= ~Group.Flag.ignore;
        }
    });
};
