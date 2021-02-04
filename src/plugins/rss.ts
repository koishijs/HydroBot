import { App, Platform } from 'koishi-core';
import superagent from 'superagent';
import RssFeedEmitter from 'rss-feed-emitter';

const feeder = new RssFeedEmitter({ skipFirstLoad: true });
feeder.on('error', console.error);

interface RssSubscription {
    _id: string,
    target: string[],
}
declare module 'koishi-core/dist/database' {
    interface Tables {
        'rss': RssSubscription
    }
}

export const apply = (app: App) => {
    app.on('connect', async () => {
        const coll = app.database.collection('rss');

        const urls = await coll.find().map((doc) => doc._id).toArray();
        for (const url of urls) {
            feeder.add({ url, refresh: 60000 });
        }

        feeder.on('new-item', async (payload) => {
            console.log(payload);
            const source = payload.meta.link;
            const message = `${payload.meta.title} (${payload.author})\n${payload.title}`;
            const data = await coll.findOne({ _id: source });
            if (data) {
                for (const target of data.target) {
                    const [platform, id] = target.split(':') as [Platform, string];
                    // eslint-disable-next-line no-await-in-loop
                    const cdoc = await app.database.getChannel(platform, id, ['assignee']);
                    if (cdoc.assignee) app.bots[`${platform}:${cdoc.assignee}`].sendMessage(id, message);
                }
            }
        });

        app.select('groupId').command('rss.subscribe <url>', 'Subscribe a rss url')
            .alias('rss.add')
            .action(async ({ session }, url) => {
                const current = await coll.findOne({ _id: url });
                if (current) {
                    await coll.updateOne(
                        { _id: url },
                        { $addToSet: { target: `${session.platform}:${session.channelId}` } },
                        { upsert: true },
                    );
                    return `Watching ${url}`;
                }
                const res = await superagent.get(url).catch(() => { });
                if (!res) throw new Error('无法获取内容。');
                await coll.insertOne({
                    _id: url,
                    target: [session.groupId],
                });
                feeder.add({ url, refresh: 60000 });
                return `Watching ${url}`;
            });

        app.select('groupId').command('rss.cancel <url>', 'Cancel')
            .alias('rss.remove')
            .action(async ({ session }, url) => {
                await coll.updateOne(
                    { _id: url },
                    { $pull: { target: session.groupId } },
                );
                return `Cancelled ${url}`;
            });

        app.select('groupId').command('rss.list', 'List')
            .action(async ({ session }) => {
                const docs = await coll.find({ target: { $elemMatch: { $eq: session.groupId } } }).project({ _id: 1 }).toArray();
                return docs.map((doc) => doc._id).join('\n');
            });
    });

    app.select('groupId').command('rss', 'Rss');
};
