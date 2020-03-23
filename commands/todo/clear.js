exports.exec = async (args, e, context, { db }) => {
    let coll = db.collection('todo');
    let res = await coll.deleteMany({ uid: context.userId });
    return 'Deleted {0} item(s)'.translate().format(res.deletedCount);
};