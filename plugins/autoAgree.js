let config = {};
let app = null;
exports.init = (item) => {
    config = item.config;
    app = item.app;
};
exports.request = async (meta) => {
    console.log(meta);
    if (meta.requestType === 'friend') {
        if (config.friend) await meta.$approve();
    } else if (meta.requestType === 'group') {
        if (config.group) await meta.$approve();
        app.database.getGroup(meta.groupId, this.app.selfId);
    }
};
