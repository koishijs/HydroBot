exports.exec = async (args, meta, { db }) => {
    let coll = db.collection('todo');
    let todos = await coll.find({ uid: meta.userId }).limit(5).toArray();
    let res = [];
    for (let i of todos) res.push(`${new Date(i._id.generationTime * 1000).toLocaleDateString()} ${i.content}(${i.status})`);
    return res.length ? res.join('\n') : 'Nothing here'.translate();
};