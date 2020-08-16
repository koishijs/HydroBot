import { App } from 'koishi-core';
import { Collection, ObjectID } from 'mongodb';

interface Bottle {
    _id?: ObjectID,
    content: string,
    isFromGroup: boolean,
    groupId?: number,
    userId: number,
}

export const apply = (app: App) => {
    app.on('connect', async () => {
        const coll: Collection<Bottle> = app.database.db.collection('bottle');

        app.command('bottle.throw <content...>', 'Throw a bottle', { maxUsage: 10 })
            .action(async ({ session }, content) => {
                await coll.insertOne({
                    isFromGroup: !!session.groupId,
                    groupId: session.groupId,
                    userId: session.userId,
                    content: content.trim(),
                });
                return '已丢出。';
            });

        app.command('bottle.pick', 'Pick a bottle', { maxUsage: 5 })
            .action(async () => {
                const cnt = await coll.find({}).count();
                if (!cnt) return '没有捡到';
                const target = Math.floor(Math.random() * cnt);
                const [res] = await coll.find({}).skip(target).limit(1).toArray();
                const shouldDestory = Math.random() > 0.5;
                if (shouldDestory) await coll.deleteOne({ _id: res._id });
                return `来源：${res.isFromGroup ? `群组${res.groupId}` : ''} 用户${res.userId}
时间：${new Date(res._id.generationTime * 1000).toLocaleString()}
内容：${res.content}
`;
            });
    });

    app.command('bottle', '漂流瓶').action(() => 'Use bottle -h for help.');
};
