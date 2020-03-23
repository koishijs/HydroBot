'use strict';
let config = {};
exports.init = item => {
    config = item.config;
};
exports.request = async meta => {
    if (meta.requestType == 'friend') {
        if (config.friend) await meta.$approve();
    } else if (meta.requestType == 'group') {
        if (config.group) await meta.$approve();
    }
};
