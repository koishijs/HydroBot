'use strict';
let data_g = {}, config = {};
exports.init = item => {
    config = item.config;
};
exports.message = meta => {
    if (!data_g[meta.groupId]) {
        data_g[meta.groupId] = {};
        data_g[meta.groupId].msg = meta.message;
        data_g[meta.groupId].t = 1;
    } else {
        if (data_g[meta.groupId].msg == meta.message)
            data_g[meta.groupId].t++;
        else {
            data_g[meta.groupId].t = 1;
            data_g[meta.groupId].msg = meta.message;
        }
        if (data_g[meta.groupId].t == config.time)
            meta.$send(data_g[meta.groupId].msg);
    }
};
