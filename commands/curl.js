const axios = require('axios');
exports.sudo = true;
exports.exec = async args => {
    console.log(args);
    let res = await axios.get(args);
    return res.data;
};