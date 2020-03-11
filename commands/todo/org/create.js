exports.exec = async (args, e, context, { db }) => {
    await db.collection('todo_orgs').insertOne({ member: [context.user_id], _id: args });
    await db.collection('todo_orgs_mapping').insertOne({ uid: context.user_id, group: context.group_id, name: args });
    return 'Created'.translate();
}