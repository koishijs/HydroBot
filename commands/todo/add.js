exports.exec = async (args, meta, { db }) => {
    let coll = db.collection('todo');
    let res = await coll.findOne({ uid: meta.userId, content: args });
    if (res) return 'This todo already exists: {0}'.translate().format(args);
    await coll.insertOne({ uid: meta.userId, content: args, status: 'WIP' });
    return 'Added.'.translate();
};