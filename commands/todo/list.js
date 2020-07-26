exports.exec = async (args, meta, { db }) => {
    const coll = db.collection('todo');
    const todos = await coll.find({ uid: meta.userId }).limit(5).toArray();
    const res = [];
    for (const i of todos) res.push(`${new Date(i._id.generationTime * 1000).toLocaleDateString()} ${i.content}(${i.status})`);
    return res.length ? res.join('\n') : 'Nothing here';
};
