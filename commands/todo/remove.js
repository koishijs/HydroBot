exports.exec = async (args, meta, { db }) => {
    let coll = db.collection('todo');
    let res = await coll.deleteOne({ uid: meta.userId, content: args });
    if (res.deletedCount) return 'Removed'.translate();
    else return 'No such todo: {0}'.translate().format(args);
};