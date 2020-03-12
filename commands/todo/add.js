exports.exec = async (args, e, context, { db }) => {
    let coll = db.collection('todo');
    let res = await coll.findOne({ uid: context.user_id, content: args });
    if (res) return 'This todo already exists: {0}'.translate().format(args);
    await coll.insertOne({ uid: context.user_id, content: args, status: 'WIP' });
    return 'Added.'.translate();
}