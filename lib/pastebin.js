const axios = require('axios');
module.exports = {
    paste: async (data) => {
        let res = await axios.post('https://paste.ubuntu.com/', {
            poster: 'bot',
            syntax: 'text',
            expiration: 'day',
            content: data
        });
        console.log(res);
    }
};
