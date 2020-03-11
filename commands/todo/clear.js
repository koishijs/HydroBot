exports.exec = async (args, e, context, { db }) => {
    let coll = db.collection('todo');
    let res = await coll.deleteMany({ uid: context.user_id });
    return 'Deleted {0} item(s)'.translate().format(res.deletedCount);
}