exports.exec = async (args, e, context, { db }) => {
    let coll = db.collection('todo');
    await coll.insertOne({ uid: context.user_id, content: args, status: 'WIP' });
    return 'Added'.translate();
}