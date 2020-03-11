exports.exec = async (args, e, context, { db }) => {
    let coll_mapping = db.collection('todo_orgs_mapping');
    let res = await coll_mapping.findOne({ uid: context.user_id, group: context.group_id });
    if (res) return 'You have already joined a organization in this group!';
    await coll_mapping.insertOne({ uid: context.user_id, group: context.group_id, name: args });
    return 'Joined'.translate();
}