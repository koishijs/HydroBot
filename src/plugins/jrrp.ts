import { App } from 'koishi-core';
import { Collection } from 'mongodb';
import { endOfToday } from '../lib/expire';

interface Data {
    _id: number,
    num: number,
    expire: Date,
}

export const apply = (app: App) => {
    app.on('connect', () => {
        const coll: Collection<Data> = app.database.db.collection('jrrp');
        coll.createIndex('expire', { expireAfterSeconds: 0 });

        app.command('jrrp', { hidden: true, cost: 1 })
            .shortcut('.jrrp', { options: { global: true } })
            .action(async ({ session }) => {
                const res = await coll.findOne({ _id: session.userId });
                if (res) return `啊咧 ${session.$username} 今天的人品值是：${res.num}`;
                const num = Math.min(Math.floor(Math.random() * 101), 100);
                await coll.insertOne({ _id: session.userId, num, expire: endOfToday() });
                return `啊咧 ${session.$username.encode()} 今天的人品值是：${num}`;
            });
    });
};
