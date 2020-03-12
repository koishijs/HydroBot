const
    { CQWebSocket } = require('cq-websocket'),
    fs = require('fs'),
    koa = require('koa'),
    body = require('koa-body'),
    router = require('koa-router'),
    path = require('path'),
    _ = require('lodash'),
    os = require('os'),
    { ErrorMessage } = require('./error'),
    { driver } = require('@rocket.chat/sdk'),
    i18n = require('./modules/i18n');

i18n(path.resolve(__dirname, 'locales', 'zh-CN.yaml'), 'zh-CN');

function warp(target) {
    return async (a, b, c) => {
        let res;
        try {
            res = target(a, b, c);
            if (res instanceof Promise) res = await res;
        } catch (e) {
            return e;
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
        this.CQ = new CQWebSocket({
            host: this.config.host || 'localhost',
            port: this.config.port || '6700',
            accessToken: this.config.access_token
        });
        if (this.config.rocket) this.rocket = driver;
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
        this.CQ
            .on('socket.error', this.log.error)
            .on('socket.connecting', (wsType, attempts) => this.log.log('Connecting ({0})'.translate().format(attempts)))
            .on('socket.connect', (wsType, sock, attempts) => this.log.log('Connected ({0})'.translate().format(attempts)))
            .on('socket.failed', (wsType, attempts) => this.log.log('Failed to connect ({0})'.translate().format(attempts)))
            .on('api.response', res => {
                this.log.log('Server response: {@}'.translate().rawformat(res));
                if (res.data && res.data.user_id) {
                    this.info.id = res.data.user_id;
                    this.loadLib();
                }
            })
            .on('socket.close', (wsType, code, desc) => this.log.log('[$0] Connection close (%1: %2)'.translate().format(wsType, code, desc)))
            .on('ready', () => this.log.log('Initialized.\nProvided by masnn'));
        this.basic();
        this.load();
        if (this.config.rocket) {
            let host = this.config.rocket;
            await driver.connect({ host: host.host, useSsl: host.ssl || true });
            this._userId = await driver.login({ username: host.username, password: host.password });
            await driver.joinRooms(host.rooms || ['GENERAL']);
            const processMessages = async (err, message, messageOptions) => {
                if (!err) {
                    if (message._id == this.lastRocketMessage) return;
                    this.lastRocketMessage = message._id;
                    if (message.u._id === this._userId) return;
                    const event = { stopPropagation: () => { } };
                    const context = {
                        message: message.msg, raw_message: message.msg,
                        user_id: message.u._id, group_id: message.rid,
                        message_id: message._id, host: host.name,
                        sender: { card: message.u.name, nickname: message.u.username }
                    }
                    let response;
                    try {
                        response = this.RocketMessage(event, context);
                        if (response instanceof Promise) response = await response;
                    } catch (e) {
                        response = e.toString + '\n' + e.stack;
                    }
                    if (typeof response == 'string') await driver.sendToRoomId(response, message.rid);
                    else if (response instanceof Array) await driver.sendToRoomId(response.join(''), message.rid);
                }
            }
            await driver.subscribeToMessages();
            await driver.reactToMessages(processMessages);
        }
        this.CQ.connect();
        if (this.config.api_port) {
            this.koa.use(this.router.routes()).use(this.router.allowedMethods());
            this.koa.listen(this.config.api_port);
            this.log.log('API inited at port {0}'.translate().format(this.config.api_port));
        }
    }
    async RocketMessage(event, context) {
        if (this.config.blacklist.group.includes(context.group_id) && !this.config.admin.includes(context.user_id)) return;
        else if (this.config.blacklist.private.includes(context.user_id)) return;
        if (this.config.logmode == 'full')
            this.log.log(context);
        else if (this.config.logmode == 'msg_only')
            this.log.log(context.group_id, context.user_id, context.message_id,
                context.sender.nickname, context.sender.card,
                context.message);
        if (context.raw_message.startsWith(this.config.prompt)) {
            let command = context.message.replace(/\r/gm, '').split(' '), app, res;
            let cmd = _.drop(command[0].split(''), 1).join('').replace(/\./gm, '/').toLowerCase();
            if (cmd[0] == '/') return 'msh: command not found: ' + cmd;
            if (global.STOP && cmd != 'start') return;
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
                    res = app.exec(_.drop(command, 1).join(' '), event, context, this);
                    if (res instanceof Promise) res = await res;
                    if (res instanceof String) res = res.toString();
                }
            } catch (e) {
                return `${e.message}\n${e.stack}`;
            }
            return res;
        }
        if (global.STOP) return;
        for (let command of this.commands) {
            if (command.type == 'private') continue;
            if (command.command.test(context.message))
                return await command.handler(command.command.exec(context.message), e, context);
        };
        for (let i in this.plugins) {
            let plugin = this.plugins[i], res;
            if (plugin.rocket_msg_group) res = await plugin.rocket_msg_group(event, context);
            else if (plugin.msg_group) res = await plugin.msg_group(event, context);
            if (res) return res;
            if (plugin.rocket_message) res = await plugin.rocket_message(event, context);
            else if (plugin.message) res = await plugin.message(event, context);
            if (res) return res;
        }
    }
    basic() {
        const
            msg_private = async (e, context) => {
                if (this.config.blacklist.private.includes(context.user_id))
                    e.stopPropagation();
                if (this.config.logmode == 'full')
                    this.log.log(context);
                else if (this.config.logmode == 'msg_only')
                    this.log.log(context.sender.nickname, context.message);
                if (global.STOP) return;
                for (let command of this.commands) {
                    if (command.type == 'group') continue;
                    if (command.command.test(context.message))
                        return await command.handler(command.command.exec(context.message), e, context);
                }
            },
            msg_group = async (e, context) => {
                if (this.config.blacklist.group.includes(context.group_id) && !this.config.admin.includes(context.user_id)) e.stopPropagation();
                else if (this.config.blacklist.private.includes(context.user_id)) e.stopPropagation();
                if (this.config.logmode == 'full')
                    this.log.log(context);
                else if (this.config.logmode == 'msg_only')
                    this.log.log(context.group_id, context.user_id, context.message_id,
                        context.sender.nickname, context.sender.card,
                        context.message);
                if (global.STOP) return;
                for (let command of this.commands) {
                    if (command.type == 'private') continue;
                    if (command.command.test(context.message))
                        return await command.handler(command.command.exec(context.message), e, context);
                }
            },
            msg = async (e, context) => {
                if (context.raw_message.startsWith(this.config.prompt)) {
                    let command = context.message.replace(/\r/gm, '').split(' '), app, res;
                    let cmd = _.drop(command[0].split(''), 1).join('').replace(/\./gm, '/').toLowerCase();
                    if (cmd[0] == '/') return 'msh: command not found: ' + cmd;
                    if (global.STOP && cmd != 'start') return;
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
                            res = app.exec(_.drop(command, 1).join(' '), e, context, this);
                            if (res instanceof Promise) res = await res;
                            if (res instanceof String) res = res.toString();
                        }
                    } catch (e) {
                        return `${e.message}\n${e.stack}`;
                    }
                    return res;
                }
                if (global.STOP && cmd != 'start') e.stopPropagation();
            };
        this.CQ.on('message.private', msg_private);
        this.CQ.on('message.group', msg_group);
        this.CQ.on('message', msg);
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
        this.lib.utils = new (require('./lib/utils'))({ info: this.info });
        this.log.log('Lib loaded.');
    }
    async load() {
        for (let i in this.config.enabledplugins) {
            let plugin = await this._import(this.config.enabledplugins[i]);
            if (plugin) {
                this.set('message', plugin.message);
                this.set('message.group', plugin.msg_group);
                this.set('message.private', plugin.msg_private);
                this.set('notice.group_upload', plugin.notice_group_upload);
                this.set('notice.group_admin.set', plugin.notice_group_setadmin);
                this.set('notice.group_admin.unset', plugin.notice_group_unsetadmin);
                this.set('notice.group_decrease', plugin.notice_group_decrease);
                this.set('notice.group_decrease.leave', plugin.notice_group_leave);
                this.set('notice.group_decrease.kick', plugin.notice_group_kick);
                this.set('notice.group_decrease.kick_me', plugin.notice_group_kickme);
                this.set('notice.group_increase', plugin.notice_group_increase);
                this.set('notice.group_increase.approve', plugin.notice_group_approve);
                this.set('notice.group_increase.invite', plugin.notice_group_invite);
                this.set('notice.friend_add', plugin.notice_friend_add);
                this.set('request.friend', plugin.request_friend);
                this.set('request.group', plugin.request_group);
                this.set('request.group.add', plugin.request_group_add);
                this.set('request.group.invite', plugin.request_group_invite);
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
                    rocket: this.rocket,
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
