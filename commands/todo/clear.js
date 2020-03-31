exports.exec = async (args, meta, { db }) => {
    let coll = db.collection('todo');
    let res = await coll.deleteMany({ uid: meta.userId });
    return 'Deleted {0} item(s)'.translate().format(res.deletedCount);
};