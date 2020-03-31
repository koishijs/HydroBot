const
    { App: Koishi } = require('koishi'),
    fs = require('fs'),
    koa = require('koa'),
    body = require('koa-body'),
    router = require('koa-router'),
    path = require('path'),
    _ = require('lodash'),
    os = require('os'),
    { messageOutput } = require('./utils.js'),
    i18n = require('./modules/i18n');

require('koishi-database-memory');
i18n(path.resolve(__dirname, 'locales', 'zh-CN.yaml'), 'zh-CN');

process.on('unhandledRejection', (reason, p) => {
    console.log('Unhandled Rejection at:', p, '\nreason:', reason);
});

function warp(event, target) {
    return async (meta, next) => {
        if (meta.postType == event) {
            let res;
            try {
                res = target(meta);
                if (res instanceof Promise) res = await res;
            } catch (e) {
                return await meta.$send(e);
            }
            if (res) return await meta.$send(res);
        }
        return await next();
    };
}

String.prototype.decode = function () {
    return this.replace(/&#91;/gm, '[').replace(/&#93;/gm, ']').replace(/&amp;/gm, '&');
};
String.prototype.encode = function () {
    return this.replace(/\[/gm, '&#91;').replace(/\]/gm, '&#93;').replace(/&/gm, '&amp;');
};

class Bot{
    constructor(item) {
        this.config = item.config;
        this.plugins = {};
        this.app = new Koishi({
            type: 'ws',
            port: 6700,
            server: `ws://${this.config.host || 'localhost'}:${this.config.port || '6700'}`,
            token: this.config.access_token,
            commandPrefix: this.config.prompt,
            database: {
                memory: {}
            }
        });
        this.set = (event, func) => func ? this.app.middleware(warp(event, func)) : null;
        this.koa = new koa();
        this.router = new router();
        this.koa.use(body());
        this.info = {};
        this.log = require('./log');
        this.lib = {};
        this.run();
    }
    async run() {
        this.app.receiver.on('connect', async () => {
            console.log('Connected');
            for (let admin of this.config.admin) {
                this.app.database.getUser(admin, 5);
                console.log('Opped ' + admin);
            }
            let groups = await this.app.sender.getGroupList();
            console.log(`Found ${groups.length} groups`);
            for (let group of groups) {
                this.app.database.getGroup(group.groupId, this.app.selfId);
                console.log('Prepared group ' + group.groupName);
            }
        });
        this.app.prependMiddleware(async (meta, next) => {
            if (meta.messageType == 'private')
                this.log.log(meta.sender.nickname, meta.message);
            else if (meta.messageType == 'group') {
                let group = await this.app.sender.getGroupInfo(meta.groupId);
                let nick = meta.sender.card || meta.sender.nickname;
                let info = [meta.messageId, `${nick}@${group.groupName}`];
                this.log.log(...info, messageOutput(meta.message));
            }
            await this.app.database.getUser(meta.userId, 1);
            return await next();
        });
        this.app.middleware(async (meta, next) => {
            console.log(123);
            return await next();
        });
        await this.app.start();
    }
}

let config = require('./config.json');
const beautify = require('json-beautify');
global.App = new Bot({ config });
process.stdin.setEncoding('utf8');
process.stdin.on('data', async input => {
    input = input.toString();
    try {
        let res = eval(input);
        if (res instanceof Promise) res = await res;
        console.log(res);
    } catch (e) { console.error(e); }
});
process.on('SIGINT', () => {
    fs.writeFileSync('./config.json', beautify(global.App.config, null, 4, 80));
    process.exit(0);
});