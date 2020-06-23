const beautify = require('json-beautify');
const fs = require('fs');
const config = require('./config.json');
const Main = require('./main.js');

global.App = new Main({ config });

process.stdin.setEncoding('utf8');
process.stdin.on('data', async (input) => {
    input = input.toString();
    try {
    // eslint-disable-next-line no-eval
        let res = eval(input);
        if (res instanceof Promise) res = await res;
        console.log(res);
    } catch (e) { console.error(e); }
});
process.on('SIGINT', () => {
    fs.writeFileSync('./config.json', beautify(global.App.config, null, 4, 80));
    process.exit(0);
});
