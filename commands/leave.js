exports.sudo = true;
exports.exec = async (args, meta, { app }) => {
    app.sender.setGroupLeave(meta.groupId);
};