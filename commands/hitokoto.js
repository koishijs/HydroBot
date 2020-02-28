const axios = require('axios');
exports.exec = async () => {
    let res = await axios.get('https://v1.hitokoto.cn/?c=a');
    return `${res.data.hitokoto}\n------《${res.data.from}》`;
}