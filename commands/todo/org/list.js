exports.exec = async (args, meta, { db }) => {
    const org = await db.collection('todo_orgs_mapping').findOne({ uid: meta.userId, group: meta.groupId });
    if (!org) return 'You haven\'t join an organization in this group.';
    const coll = db.collection('todo_orgs_todo');
    const todos = await coll.find({ org }).limit(5).toArray();
    const res = [];
    for (const i of todos) res.push(i.content + (i.status ? `(${i.status})` : ''));
    return res.length ? res.join('\n') : 'Nothing here'.translate();
};
