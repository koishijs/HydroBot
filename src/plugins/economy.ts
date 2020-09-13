import { App, Session, getTargetId } from 'koishi-core';

declare module 'koishi-core/dist/command' {
    interface CommandConfig {
        cost?: number,
    }
}

declare module 'koishi-core/dist/database' {
    interface User {
        coin: number,
    }
}

export function apply(app: App) {
    app.on('before-command', ({ session, command }) => {
        const cost = command.getConfig('cost', session);
        // @ts-ignore
        if (session.$user.coin < cost) return '你没有足够的硬币执行该命令。';
    });

    app.on('before-attach-user', (session, fields) => {
        fields.add('coin');
    });

    app.on('command', ({ session, command }) => {
        const cost = command.getConfig('cost', session);
        // @ts-ignore
        if (cost) session.$user.coin -= cost;
    });

    app.command('checkin', '签到', { maxUsage: 1 })
        .shortcut('签到', { prefix: false })
        .userFields(['coin'])
        .action(async ({ session }) => {
            const add = 20 + Math.floor(Math.random() * 10);
            if (!session.$user.coin) session.$user.coin = 0;
            session.$user.coin += add;
            return `签到成功，获得${add}个硬币（共有${session.$user.coin}个）`;
        });

    app.command('money', '经济系统');

    app.command('money.pay <targetUserId> <count>', '转账', { noRedirect: true })
        .userFields(['coin'])
        .action(async ({ session }, targetUser, count) => {
            const n = parseInt(count, 10);
            if (!(Number.isSafeInteger(n) && n > 0)) return '不合法的数值。';
            if (session.$user.coin < n) return '你没有足够的硬币。';
            const id = getTargetId(targetUser);
            if (!id) return '未指定目标。';
            const newSession = new Session(app, session);
            newSession.userId = id;
            newSession.sender.userId = id;
            delete newSession.$user;
            const user = await newSession.$observeUser(['coin']);
            session.$user.coin -= n;
            user.coin += n;
            await newSession.$user._update();
            return '操作完成。';
        });
}
