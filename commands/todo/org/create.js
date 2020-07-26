exports.exec = async (args, meta, { db }) => {
    await db.collection('todo_orgs').insertOne({ member: [meta.userId], _id: args });
    await db.collection('todo_orgs_mapping').insertOne({ uid: meta.userId, group: meta.groupId, name: args });
    return 'Created';
};
