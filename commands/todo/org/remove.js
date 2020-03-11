exports.exec = async (args, e, context, { db }) => {
    let org = await db.collection('todo_orgs_mapping').findOne({ uid: context.user_id, group: context.group_id });
    if (!org) return 'You haven\'t join an organization in this group.';
    let coll = db.collection('todo_orgs_todo');
    await coll.deleteOne({ org, content: args });
    return 'Removed'.translate();
}