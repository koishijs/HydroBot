exports.exec = async (args, meta, { db }) => {
    let org = await db.collection('todo_orgs_mapping').findOne({ uid: meta.userId, group: meta.groupId });
    if (!org) return 'You haven\'t join an organization in this group.';
    let coll = db.collection('todo_orgs_todo');
    await coll.insertOne({ org, content: args, status: 'WIP' });
    return 'Added todo'.translate();
};