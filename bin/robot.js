#!/usr/bin/env node

const path = require('path');
const fs = require('fs');
const yaml = require('js-yaml');
// eslint-disable-next-line import/no-unresolved
const Main = require('../dist/main.js');

const config = yaml.load(fs.readFileSync(path.resolve(process.cwd(), 'config.yaml')));

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
