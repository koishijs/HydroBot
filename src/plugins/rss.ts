import { App, Session } from 'koishi';
import RssFeedEmitter from 'rss-feed-emitter';
import { Collection } from 'mongodb';

const feeder = new RssFeedEmitter({ skipFirstLoad: true });
feeder.on('error', console.error);

type Target = [boolean, number, number];

interface RssSubscription {
    _id: string,
    target: Target[],
}

function get(session: Session): Target {
    return [!!session.groupId, session.groupId || session.userId, session.selfId];
}

export const apply = (app: App) => {
    app.on('connect', async () => {
        const coll: Collection<RssSubscription> = app.database.db.collection('rss');

        const urls = await coll.find().map((doc) => doc._id).toArray();
        for (const url of urls) {
            feeder.add({ url, refresh: 60000 });
        }

        feeder.on('new-item', async (payload) => {
            console.log(payload);
            const source = payload.meta.link.toLowerCase();
            const message = `${payload.meta.title} (${payload.author})\n${payload.title}`;
            const data = await coll.findOne({ _id: source });
            if (data) {
                for (const [isGroup, id, selfId] of data.target) {
                    if (isGroup) app.bots[selfId].sendGroupMsg(id, message);
                    else app.bots[selfId].sendPrivateMsg(id, message);
                }
            }
        });

        app.command('rss.subscribe <repo>', 'Subscribe a rss url')
            .action(async ({ session }, url) => {
                url = url.toLowerCase();
                const current = await coll.findOne({ _id: url });
                if (current) {
                    await coll.updateOne(
                        { _id: url },
                        {
                            $addToSet: {
                                target: get(session),
                            },
                        },
                        { upsert: true },
                    );
                    return `Watching ${url}`;
                }
                await coll.insertOne(
                    {
                        _id: url,
                        target: [get(session)],
                    },
                );
                feeder.add({ url, refresh: 60000 });
                return `Watching ${url}`;
            });

        app.command('rss.cancel <repo>', 'Cancel')
            .action(async ({ session }, url) => {
                url = url.toLowerCase();
                await coll.updateOne(
                    { _id: url },
                    { $pull: { target: get(session) } },
                );
                return `Cancelled ${url}`;
            });
    });

    app.command('rss', 'Rss')
        .action(({ session }) => session.$send('Use rss -h for help.'));
};
