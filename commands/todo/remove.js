exports.exec = async (args, e, context, { db }) => {
    let coll = db.collection('todo');
    let res = await coll.deleteOne({ uid: context.user_id, content: args });
    if (res.deletedCount) return 'Removed'.translate();
    else return 'No such todo: {0}'.translate().format(args);
}