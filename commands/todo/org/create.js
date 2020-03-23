exports.exec = async (args, e, context, { db }) => {
    await db.collection('todo_orgs').insertOne({ member: [context.userId], _id: args });
    await db.collection('todo_orgs_mapping').insertOne({ uid: context.userId, group: context.groupId, name: args });
    return 'Created'.translate();
}