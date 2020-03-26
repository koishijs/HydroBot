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

module.exports = class {
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
        if (this.config.db) {
            let url = 'mongodb://';
            if (this.config.db.user) url += this.config.db.user + ':' + this.config.db.password + '@';
            url += this.config.db.host + ':' + this.config.db.port + '/' + this.config.db.name;
            let Database = await (require('mongodb')).MongoClient.connect(
                url, { useNewUrlParser: true, useUnifiedTopology: true }
            );
            this.db = Database.db(this.config.db.name);
        }
        this.app.plugin(require('koishi-plugin-common'), {
            admin: true,
            broadcast: false,
            contextify: false,
            echo: false,
            exec: false,
            exit: false,
            help: true,
            info: true
        });
        this.app.receiver.on('ready', async () => {
            for (let admin of this.config.admin) {
                this.app.database.getUser(admin, 5);
                console.log('Opped ' + admin);
            }
            let groups = await this.app.sender.getGroupList();
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
            if (meta.$parsed.prefix == '>') {
                let command = meta.$parsed.message.replace(/\r/gm, '').split(' '), app, res;
                let cmd = command[0].replace(/\./gm, '/');
                if (cmd[0] == '/') return meta.$send('msh: command not found: ' + cmd);
                try {
                    app = require(path.resolve(__dirname, 'commands', cmd + '.js'));
                    if (app.platform && !app.platform.includes(os.platform())) throw new Error(`This application require ${JSON.stringify(app.platform)}\nCurrent running on ${os.platform()}`);
                } catch (e) {
                    if (e.code == 'MODULE_NOT_FOUND') return 'msh: command not found: ' + cmd;
                    return meta.$send(`Error loading application:\n${e.message}${e.stack ? '\n' + e.stack : ''}`);
                }
                if (app.exec instanceof Function) {
                    try {
                        if (app.sudo && !this.config.admin.includes(meta.userId)) res = 'msh: permission denied: ' + cmd;
                        else {
                            res = app.exec(_.drop(command, 1).join(' '), meta, this);
                            if (res instanceof Promise) res = await res;
                            if (res instanceof String) res = res.toString();
                            if (res instanceof Array) res = res.join('');
                        }
                    } catch (e) {
                        return meta.$send(`${e.message}\n${e.stack}`);
                    }
                    return meta.$send(res);
                }
            }
            return await next();
        });
        await this.load();
        if (this.config.api_port) {
            this.koa.use(this.router.routes()).use(this.router.allowedMethods());
            this.koa.listen(this.config.api_port);
            this.log.log('API inited at port {0}'.translate().format(this.config.api_port));
        }
        await this.app.start();
    }
    async load() {
        for (let i in this.config.enabledplugins) {
            let plugin = await this._import(this.config.enabledplugins[i]);
            if (plugin) {
                this.set('message', plugin.message);
                this.set('notice', plugin.notice);
                this.set('request', plugin.request);
                this.set('metaEvent', plugin.metaEvent);
                this.log.log('插件 ' + this.config.enabledplugins[i] + ' 已经启用');
                this.plugins[this.config.enabledplugins[i]] = plugin;
            }
        }
        let files = fs.readdirSync(path.resolve(process.cwd(), 'commands'));
        for (let i of files) {
            let file = path.resolve(process.cwd(), 'commands', i);
            try {
                let res, app = require(file);
                if (app.register) res = app.register(this);
                if (res instanceof Promise) res = await res;
            } catch (e) {
                this.log.log(`Failed to load: ${file}`, e, '\n');
            }
        }
    }
    async _import(name) {
        let t, info, plugin;
        let base = {
            app: this.app,
            koa: this.koa,
            router: this.router,
            log: this.log,
            db: this.db,
            info: this.info,
            lib: this.lib
        };
        try {
            try {
                info = fs.statSync(`./plugins/${name}.js`);
            } catch (e) {
                throw 'Plugin file not exist';
            }
            if (info.isFile()) {
                plugin = require(`./plugins/${name}.js`);
                if (plugin.init) t = plugin.init({ ...base, config: this.config.plugin[name] || {} });
                if (t instanceof Promise) await t;
                if (plugin.apply)
                    this.app.plugin(plugin, { ...base, config: this.config.plugin[name] || {} });
            }
        } catch (err) {
            this.log.error('Error loading plugin {0}:\n {1}'.translate().format(name, err));
        }
        return plugin;
    }
};
