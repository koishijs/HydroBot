exports.exec = async (args, meta, { db }) => {
    const coll = db.collection('todo');
    const res = await coll.deleteMany({ uid: meta.userId });
    return 'Deleted {0} item(s)'.translate().format(res.deletedCount);
};
