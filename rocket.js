const
    { driver } = require('@rocket.chat/sdk'),
    fs = require('fs'),
    koa = require('koa'),
    body = require('koa-body'),
    router = require('koa-router'),
    path = require('path'),
    _ = require('lodash'),
    os = require('os'),
    { ErrorMessage } = require('./error'),
    i18n = require('./modules/i18n');

function warp(target) {
    return async (a, b, c) => {
        let res;
        try {
            res = target(a, b, c);
            if (res instanceof Promise) res = await res;
        } catch (e) {
            return e.message + '\n' + e.stack;
        }
        return res;
    };
}

String.prototype.decode = function () {
    return this.replace(/&#91;/gm, '[').replace(/&#93;/gm, ']').replace(/&amp;/gm, '&');
}
String.prototype.encode = function () {
    return this.replace(/\[/gm, '&#91;').replace(/\]/gm, '&#93;').replace(/&/gm, '&amp;');
}

module.exports = class {
    constructor(item) {
        this.config = item.config;
        this.plugins = {};
        this.set = (event, func) => func ? this.CQ.on(event, warp(func)) : null;
        this.koa = new koa();
        this.router = new router();
        this.koa.use(body());
        this.info = {};
        this.log = require('./log');
        this.lib = {};
        this.commands = [];
        this.run();
    }
    async run() {
        await this.preloadLib();
        await this.loadLib();
        await this.load();
        await driver.connect({ host: this.config.rocket_host, useSsl: this.config.rocket_ssl || true });
        this._userId = await driver.login({ username: this.config.rocket_username, password: this.config.rocket_password });
        console.log(this._userId);
        await driver.joinRooms(this.config.rooms || ['general']);
        await driver.subscribeToMessages();
        await driver.reactToMessages((err, message, messageOptions) => { this.processMessages(err, message, messageOptions) });
        await driver.sendToRoom('Mbot is listening ...', (this.config.rooms || ['general'])[0]);
        //if (this.config.api_port) {
        //    this.koa.use(this.router.routes()).use(this.router.allowedMethods());
        //    this.koa.listen(this.config.api_port);
        //    this.log.log('API inited at port {0}'.translate().format(this.config.api_port));
        //}
    }
    async processMessages(err, message, messageOptions) {
        if (!err) {
            if (message.u._id === this._userId) return;
            const event = { stopPropagation: () => { } };
            const context = {
                message: message.msg, raw_message: message.msg,
                user_id: message.u._id, group_id: message.rid,
                message_id: message._id,
                sender: {
                    card: message.u.username, nickname: message.u.username
                }
            }
            let response;
            try {
                response = this.message(event, context);
                if (response instanceof Promise) response = await response;
            } catch (e) {
                response = e.toString + '\n' + e.stack;
            }
            if (typeof response == 'string') await driver.sendToRoomId(response, message.rid);
            else if (response instanceof Array) await driver.sendToRoomId(response.join(''), message.rid);
        }
    }
    async message(event, context) {
        if (this.config.blacklist.group.includes(context.group_id) && !this.config.admin.includes(context.user_id)) e.stopPropagation();
        else if (this.config.blacklist.private.includes(context.user_id)) e.stopPropagation();
        if (this.config.logmode == 'full')
            this.log.log(context);
        else if (this.config.logmode == 'msg_only')
            this.log.log(context.group_id, context.user_id, context.message_id,
                context.sender.nickname, context.sender.card,
                context.message);
        if (context.raw_message.startsWith(this.config.prompt)) {
            let command = context.message.replace(/\r/gm, '').split(' '), app, res;
            let cmd = _.drop(command[0].split(''), 1).join('').replace(/\./gm, '/');
            if (cmd[0] == '/') return 'msh: command not found: ' + cmd;
            try {
                app = require(path.resolve(__dirname, 'commands', cmd + '.js'));
                if (app.platform && !app.platform.includes(os.platform())) throw new ErrorMessage(`This application require ${JSON.stringify(app.platform)}\nCurrent running on ${os.platform()}`);
            } catch (e) {
                if (e.code == 'MODULE_NOT_FOUND') return 'msh: command not found: ' + cmd;
                return `Error loading application:\n${e.message}${e.stack ? '\n' + e.stack : ''}`;
            }
            try {
                if (app.sudo && !this.config.admin.includes(context.user_id)) res = 'msh: permission denied: ' + cmd;
                else {
                    res = app.exec(_.drop(command, 1).join(' '), event, context);
                    if (res instanceof Promise) res = await res;
                }
            } catch (e) {
                return `${e.message}\n${e.stack}`;
            }
            return res;
        }
        for (let command of this.commands) {
            if (command.type == 'private') continue;
            if (command.command.test(context.message))
                return await command.handler(command.command.exec(context.message), e, context);
        };
        for (let i in this.plugins) {
            let plugin = this.plugins[i], res;
            if (plugin.msg_group) res = await plugin.msg_group(event, context);
            if (res) return res;
            if (plugin.message) res = await plugin.message(event, context);
            if (res) return res;
        }
    }
    async preloadLib() {
        if (this.config.db) {
            let url = 'mongodb://';
            if (this.config.db.user) url += this.config.db.user + ':' + this.config.db.password + '@';
            url += this.config.db.host + ':' + this.config.db.port + '/' + this.config.db.name;
            let Database = await (require('mongodb')).MongoClient.connect(
                url, { useNewUrlParser: true, useUnifiedTopology: true }
            );
            this.db = Database.db(this.config.db.name);
        }
    }
    async loadLib() {
        this.lib.utils = new (require('./lib/utils'))({ info: this.info, username: this._userId });
        this.log.log('Lib loaded.');
    }
    async load() {
        for (let i in this.config.enabledplugins) {
            let plugin = await this._import(this.config.enabledplugins[i]);
            if (plugin) {
                this.log.log('插件 ' + this.config.enabledplugins[i] + ' 已经启用');
                this.plugins[this.config.enabledplugins[i]] = plugin;
            }
        }
    }
    async _import(name) {
        let t, info, plugin;
        try {
            try {
                info = fs.statSync(`./plugins/${name}.js`);
            } catch (e) {
                throw 'Plugin file not exist';
            }
            if (info.isFile()) {
                plugin = require(`./plugins/${name}.js`);
                if (plugin.init) t = plugin.init({
                    CQ: this.CQ,
                    koa: this.koa,
                    router: this.router,
                    log: this.log,
                    db: this.db,
                    config: this.config.plugin[name] || {},
                    info: this.info,
                    lib: this.lib,
                    command: (type, cmd, handler) => {
                        this.commands.push({ type, command: cmd, handler: warp(handler) });
                    }
                });
                if (t instanceof Promise) await t;
            }
        } catch (err) {
            this.log.error('Error loading plugin {0}:\n {1}'.translate().format(name, err));
        }
        return plugin;
    }
};
