const axios = require('axios');

function _ip({ meta }, args) {
    const url = `http://freeapi.ipip.net/${args}`;
    axios.get(url).then((res) => {
        meta.$send(res.data.join(' '));
    }).catch((e) => {
        meta.$send(e.toString());
    });
}
exports.register = ({ app }) => {
    app.command('ip <ip>', '查询ip').action(_ip);
};
