exports.exec = async (args, meta, { db }) => {
    const coll = db.collection('todo');
    const res = await coll.findOne({ uid: meta.userId, content: args });
    if (res) return `This todo already exists: ${args}`;
    await coll.insertOne({ uid: meta.userId, content: args, status: 'WIP' });
    return 'Added.';
};
