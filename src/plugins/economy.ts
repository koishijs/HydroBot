import { App, getTargetId, User } from 'koishi-core';
import { Session } from 'koishi-core/dist/session';
import { Items, ItemMeta } from '../lib/item';

declare module 'koishi-core/dist/command' {
    interface CommandConfig {
        cost?: number,
    }
}

export interface Slot<T extends string> {
    id: T,
    count: number,
    meta: ItemMeta[T],
}

declare module 'koishi-core/dist/database' {
    interface User {
        coin: number,
        backpack: Slot<any>[],
    }
}

User.extend(() => ({
    coin: 0,
    backpack: [],
}));

function sum(...args: number[]) {
    let result = 0;
    for (const arg of args) result += arg;
    return result;
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
        if (session._silent) return;
        const cost = command.getConfig('cost', session);
        // @ts-ignore
        if (cost) session.$user.coin -= cost;
    });

    app.command('property', '财产系统');

    app.command('property/backpack', '背包')
        .userFields(['backpack'])
        .action(({ session }) => {
            if (!session.$user.backpack.length) return '你的背包是空的！';
            return [
                `你的背包共${sum(...session.$user.backpack.map((slot) => slot.count))}个物品。`,
                ...session.$user.backpack.map((slot) => {
                    const item = Items[slot.id] || Items.fallback;
                    return `${item.name} * ${slot.count}`;
                }),
            ].join('\n');
        });

    app.command('property/checkin', '签到', { maxUsage: 1 })
        .shortcut('签到', { prefix: false })
        .userFields(['coin'])
        .action(async ({ session }) => {
            const add = 20 + Math.floor(Math.random() * 10);
            session.$user.coin += add;
            return `签到成功，获得${add}个硬币（共有${session.$user.coin}个）`;
        });

    app.command('property/pay <targetUserId> <count>', '转账', { noRedirect: true })
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
            return `已转账${n}个硬币。`;
        });
}
