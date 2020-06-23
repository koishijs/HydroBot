exports.exec = async (args, meta, { db }) => {
    const coll = db.collection('todo');
    const res = await coll.deleteOne({ uid: meta.userId, content: args });
    if (res.deletedCount) return 'Removed'.translate();
    return 'No such todo: {0}'.translate().format(args);
};
