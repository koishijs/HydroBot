exports.exec = async (args, e, context, { db }) => {
    let org = await db.collection('todo_orgs_mapping').findOne({ uid: context.userId, group: context.groupId });
    if (!org) return 'You haven\'t join an organization in this group.';
    let coll = db.collection('todo_orgs_todo');
    let todos = await coll.find({ org }).limit(5).toArray();
    let res = [];
    for (let i of todos) res.push(i.content + (i.status ? `(${i.status})` : ''));
    return res.length ? res.join('\n') : 'Nothing here'.translate();
}