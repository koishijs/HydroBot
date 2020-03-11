exports.exec = async (args, e, context, { db }) => {
    let coll = db.collection('todo');
    await coll.deleteOne({ uid: context.user_id, content: args });
    return 'Removed'.translate();
}