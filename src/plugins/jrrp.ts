import { App } from 'koishi-core';
import { Collection } from 'mongodb';

interface Data {
    _id: number,
    num: number,
    expire: Date,
}

export const apply = (app: App) => {
    app.on('connect', () => {
        const coll: Collection<Data> = app.database.db.collection('jrrp');
        coll.createIndex('expire', { expireAfterSeconds: 0 });

        app.command('jrrp', { hidden: true })
            .shortcut('.jrrp', { options: { global: true } })
            .action(async ({ session }) => {
                const res = await coll.findOne({ _id: session.userId });
                if (res) return `啊咧 ${session.$username} 今天的人品值是：${res.num}`;
                const num = Math.min(Math.floor(Math.random() * 101), 100);
                const expire = new Date();
                expire.setHours(23);
                expire.setMinutes(59);
                expire.setSeconds(59);
                await coll.insertOne({ _id: session.userId, num, expire });
                return `啊咧 ${session.$username.encode()} 今天的人品值是：${num}`;
            });
    });
};
