const dataG = {};
let config = {};
exports.init = (item) => {
    config = item.config;
};
exports.message = (meta) => {
    if (!dataG[meta.groupId]) {
        dataG[meta.groupId] = {};
        dataG[meta.groupId].msg = meta.message;
        dataG[meta.groupId].t = 1;
    } else {
        if (dataG[meta.groupId].msg === meta.message) dataG[meta.groupId].t++;
        else {
            dataG[meta.groupId].t = 1;
            dataG[meta.groupId].msg = meta.message;
        }
        if (dataG[meta.groupId].t === config.time) meta.$send(dataG[meta.groupId].msg);
    }
};
