exports.exec = async (args, meta, { db }) => {
    let coll_mapping = db.collection('todo_orgs_mapping');
    let res = await coll_mapping.findOne({ uid: meta.userId, group: meta.groupId });
    if (res) return 'You have already joined a organization in this group!';
    await coll_mapping.insertOne({ uid: meta.userId, group: meta.groupId, name: args });
    return 'Joined'.translate();
};