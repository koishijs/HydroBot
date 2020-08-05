#!/usr/bin/env node

const path = require('path');
// eslint-disable-next-line import/no-dynamic-require
const config = require(path.resolve(process.cwd(), 'config.json'));
// eslint-disable-next-line import/no-unresolved
const Main = require('../dist/main.js');

const App = new Main({ config });
global.App = App;

process.stdin.setEncoding('utf8');
process.stdin.on('data', async (input) => {
    input = input.toString();
    try {
        // eslint-disable-next-line no-eval
        let res = eval(input);
        if (res instanceof Promise) res = await res;
        console.log(res);
    } catch (e) {
        console.error(e);
    }
});
