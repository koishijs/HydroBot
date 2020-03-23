exports.exec = async (args, e, context, { db }) => {
    let coll = db.collection('todo');
    let res = await coll.findOne({ uid: context.userId, content: args });
    if (res) return 'This todo already exists: {0}'.translate().format(args);
    await coll.insertOne({ uid: context.userId, content: args, status: 'WIP' });
    return 'Added.'.translate();
};