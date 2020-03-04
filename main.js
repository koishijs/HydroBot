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
    i18n = require('./modules/i18n');

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
                this.log.log('Server response: {0}'.translate().rawformat(res));
                if (res.data && res.data.user_id) {
                    this.info.id = res.data.user_id;
                    this.loadLib();
                }
            })
            .on('socket.close', (wsType, code, desc) => this.log.log('[$0] Connection close (%1: %2)'.translate().format(wsType, code, desc)))
            .on('ready', () => this.log.log('Initialized.\nProvided by masnn'));
        this.basic();
        this.load();
        this.CQ.connect();
        if (this.config.api_port) {
            this.koa.use(this.router.routes()).use(this.router.allowedMethods());
            this.koa.listen(this.config.api_port);
            this.log.log('API inited at port {0}'.translate().format(this.config.api_port));
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
                for (let command of this.commands) {
                    if (command.type == 'private') continue;
                    if (command.command.test(context.message))
                        return await command.handler(command.command.exec(context.message), e, context);
                }
            },
            msg = async (e, context) => {
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
                            res = app.exec(_.drop(command, 1).join(' '), e, context);
                            if (res instanceof Promise) res = await res;
                        }
                    } catch (e) {
                        return `${e.message}\n${e.stack}`;
                    }
                    return res;
                }
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
