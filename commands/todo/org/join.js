exports.exec = async (args, e, context, { db }) => {
    let coll_mapping = db.collection('todo_orgs_mapping');
    let res = await coll_mapping.findOne({ uid: context.userId, group: context.groupId });
    if (res) return 'You have already joined a organization in this group!';
    await coll_mapping.insertOne({ uid: context.userId, group: context.groupId, name: args });
    return 'Joined'.translate();
}