import { Context } from 'koishi-core';
import { ObjectID } from 'mongodb';

interface Bottle {
    _id?: ObjectID,
    content: string,
    groupId?: string,
    userId: number,
    pick: number,
}
declare module 'koishi-core' {
    interface Tables {
        bottle: Bottle,
    }
}

export const apply = (ctx: Context) => {
    ctx.on('connect', async () => {
        const coll = ctx.database.collection('bottle');

        ctx.command('bottle.throw <content:text>', '丢漂流瓶', { noRedirect: true })
            .alias('丢漂流瓶')
            .userFields(['id'])
            .action(async ({ session }, content) => {
                const res = await coll.insertOne({
                    groupId: `${session.platform}:${session.groupId}`,
                    userId: session.user.id,
                    content: content.trim(),
                    pick: 0,
                });
                return `已丢出。(${res.insertedId})`;
            });

        ctx.command('bottle.pick', '捡漂流瓶')
            .alias('捡漂流瓶')
            .action(async () => {
                const cnt = await coll.find({}).count();
                if (!cnt) return '没有捡到';
                const target = Math.floor(Math.random() * cnt);
                const [res] = await coll.find({}).skip(target).limit(1).toArray();
                const shouldDestory = Math.random() > 0.5;
                if (shouldDestory) await coll.deleteOne({ _id: res._id });
                else await coll.updateOne({ _id: res._id }, { $inc: { pick: 1 } });
                return `被捡起 ${res.pick + 1} 次
时间：${new Date(res._id.generationTime * 1000).toLocaleString()}
内容：${res.content}`;
            });

        ctx.command('bottle.del <query:text>', { authority: 5, hidden: true })
            .action(async (_, query) => {
                // eslint-disable-next-line no-eval
                const res = await coll.deleteMany(JSON.parse(query.decode()));
                return res.deletedCount.toString();
            });
    });

    ctx.command('bottle', '漂流瓶');
};
