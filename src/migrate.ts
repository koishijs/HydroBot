import { argv } from 'yargs';
import { MongoClient, ObjectID } from 'mongodb';
import { Logger, noop } from 'koishi-utils';

const logger = new Logger('migrate');

async function main() {
    logger.info('Connecting to database');
    logger.info('%o', argv);
    const srcDb = await MongoClient.connect(argv.src as string, { useUnifiedTopology: true });
    const dstDb = await MongoClient.connect((argv.dst || argv.src) as string, { useUnifiedTopology: true });
    const src = srcDb.db(argv.srcDb as string);
    const dst = dstDb.db(argv.dstDb as string);
    if (argv.srcPrefix) {
        src.collection = ((c) => (name: string) => c(`${argv.srcPrefix}.${name}`))(src.collection.bind(src));
    }
    if (argv.dstPrefix) {
        dst.collection = ((c) => (name: string) => c(`${argv.dstPrefix}.${name}`))(dst.collection.bind(dst));
    }
    async function copy(name: string) {
        logger.info(name);
        await dst.collection(name).drop().catch(noop);
        await src.collection(name).find().forEach((doc) => dst.collection(name).insertOne(doc));
        logger.success(`${name} Done`);
    }
    logger.success('Connected');

    // User
    logger.info('User');
    let currId = 100;
    const umap = argv.bind ? JSON.parse(argv.bind as string) : {};
    await dst.collection('user').drop().catch(noop);
    await src.collection('user').find().forEach((doc) => {
        if (!umap[doc._id]) {
            currId++;
            umap[doc._id] = currId;
        }
        return dst.collection('user').insertOne({
            ...doc,
            _id: umap[doc._id],
            onebot: doc._id.toString(),
        });
    });
    logger.success('User Done');

    // Channel
    logger.info('Channel');
    await dst.collection('channel').drop().catch(noop);
    await src.collection('group').find().forEach((doc) => dst.collection('channel').insertOne({
        ...doc,
        _id: new ObjectID(),
        pid: doc._id.toString(),
        type: 'onebot',
    }));
    logger.success('Channel Done');

    // Bottle
    logger.info('Bottle');
    await dst.collection('bottle').drop().catch(noop);
    await src.collection('bottle').find().forEach((doc) => dst.collection('bottle').insertOne({
        ...doc,
        groupId: `onebot:${doc.groupId}`,
        userId: umap[doc.userId],
        pick: 0,
    }));
    logger.success('Bottle Done');

    // Dialogue
    logger.info('Dialogue');
    await dst.collection('dialogue').drop().catch(noop);
    await src.collection('dialogue').find().forEach((doc) => dst.collection('dialogue').insertOne({
        ...doc,
        writer: umap[doc.writer],
        groups: doc.groups.map((group: number) => `onebot:${group}`),
    }));
    logger.success('Dialogue Done');

    // Rss
    logger.info('Rss');
    await dst.collection('rss').drop().catch(noop);
    await src.collection('rss').find().forEach((doc) => dst.collection('rss').insertOne({
        ...doc,
        target: doc.target.map((t: number) => `onebot:${t}`),
    }));
    logger.success('Rss Done');

    // Github
    logger.info('Github');
    await dst.collection('github_watch').drop().catch(noop);
    await src.collection('github_watch').find().forEach((doc) => dst.collection('github_watch').insertOne({
        ...doc,
        target: doc.target.map((t: number) => `onebot:${t}`),
    }));
    logger.success('Github Done');

    // Osu
    logger.info('Osu');
    await dst.collection('osu').drop().catch(noop);
    await src.collection('osu').find().forEach((doc) => dst.collection('osu').insertOne({
        ...doc,
        _id: umap[doc._id],
    }));
    logger.success('Osu Done');

    // Message
    logger.info('Message');
    let cnt = 0;
    await dst.collection('message').drop().catch(noop);
    await src.collection('message').find().forEach((doc) => {
        cnt++;
        if (!(cnt % 100000)) logger.info(cnt);
        return dst.collection('message').insertOne({
            ...doc,
            group: `onebot:${doc.group}`,
            sender: umap[doc.sender],
        });
    });
    logger.success('Message Done');

    // Other
    await copy('image');
    await copy('image.tag');
}

main().catch(logger.error);
