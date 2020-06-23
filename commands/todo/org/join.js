exports.exec = async (args, meta, { db }) => {
    const collMapping = db.collection('todo_orgs_mapping');
    const res = await collMapping.findOne({ uid: meta.userId, group: meta.groupId });
    if (res) return 'You have already joined a organization in this group!';
    await collMapping.insertOne({ uid: meta.userId, group: meta.groupId, name: args });
    return 'Joined'.translate();
};
