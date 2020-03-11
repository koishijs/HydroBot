exports.exec = async (args, e, context, { db }) => {
    let coll = db.collection('todo');
    let todos = await coll.find({ uid: context.user_id }).limit(5).toArray();
    let res = [];
    for (let i of todos) res.push(i.content + (i.status ? `(${i.status})` : ''));
    return res.length ? res.join('\n') : 'Nothing here'.translate();
}