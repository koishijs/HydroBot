import axios from 'axios';

function _ip({ session }, args) {
    const url = `http://freeapi.ipip.net/${args}`;
    axios.get(url).then((res) => {
        session.$send(res.data.join(' '));
    }).catch((e) => {
        session.$send(e.toString());
    });
}

export const apply = (app) => {
    app.command('ip <ip>', '查询ip').action(_ip);
};
