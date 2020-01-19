const
    { CQWebSocket } = require('cq-websocket'),
    fs = require('fs'),
    koa = require('koa'),
    body = require('koa-body'),
    router = require('koa-router'),
    i18n = require('./modules/i18n');

function warp(target) {
    return async (e, ctx) => {
        let res;
        try {
            res = target(e, ctx);
            if (res instanceof Promise) res = await res;
        } catch (e) {
            return e;
        }
        return res;
    }
}

module.exports = class {
    constructor(item) {
        this.config = item.config;
        this.db = item.db;
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
        this.run();
    }
    async run() {
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
        const blacklist = require('./database/blacklist'),
            RE_HELP = /^帮助>([0-9])+/i,
            msg_private = (e, context) => {
                if (blacklist.private.includes(context.user_id))
                    e.stopPropagation();
                if (this.config.logmode == 'full')
                    this.log.log(context);
                else if (this.config.logmode == 'msg_only')
                    this.log.log(context.sender.nickname, context.message);
            },
            msg_group = (e, context) => {
                if (blacklist.group.includes(context.group_id)) e.stopPropagation();
                else if (blacklist.private.includes(context.user_id)) e.stopPropagation();
                if (this.config.logmode == 'full')
                    this.log.log(context);
                else if (this.config.logmode == 'msg_only')
                    this.log.log(context.group_id, context.user_id, context.message_id,
                        context.sender.nickname, context.sender.card,
                        context.message);
            },
            msg_discuss = (e, context) => {
                if (blacklist.discuss.includes(context.discuss_id))
                    e.stopPropagation();
            },
            msg = (e, context) => {
                let enabled = this.config.enabledplugins;
                if (context.raw_message == '帮助') {
                    let res = ['当前开启的功能有：\n'];
                    for (let i in enabled) {
                        try {
                            let info = this.plugins[this.config.enabledplugins[i]].info();
                            res.push(i, ':', info.description, '\n');
                        } catch (e) { /* Ignore */ }
                    }
                    res.push('输入 帮助>序号 可获得详细信息');
                    return res;
                }
                if (RE_HELP.test(context.raw_message)) {
                    let tmp = RE_HELP.exec(context.raw_message), info;
                    if (!this.config.enabledplugins[i] || this.config.enabledplugins)
                        try {
                            info = this.plugins[this.config.enabledplugins[parseInt(tmp[1])]].info();
                            if (info.hidden) throw new Error();
                        } catch (e) {
                            return '编号不合法！';
                        }
                    return ['插件:', info.id, '\n提供者:', info.author, '\n使用方式:\n', info.usage];
                }
            };
        this.CQ.on('message.private', msg_private);
        this.CQ.on('message.group', msg_group);
        this.CQ.on('message.discuss', msg_discuss);
        this.CQ.on('message', msg);
    }
    loadLib() {
        this.lib.utils = new (require('./lib/utils'))({ info: this.info });
        this.log.log('Lib loaded.');
    }
    async load() {
        for (let i in this.config.enabledplugins) {
            let plugin = await this._import(this.config.enabledplugins[i]);
            if (plugin) {
                this.set('message', plugin.message);
                this.set('message.group', plugin.msg_group);
                this.set('message.discuss', plugin.msg_discuss);
                this.set('message.discuss.@.me', plugin.msg_discuss_atme);
                this.set('message.private', plugin.msg_private);
                this.set('notice.group_upload', plugin.notice_group_upload);
                this.set('notice.group_admin.set', plugin.notice_group_setadmin);
                this.set('notice.group_admin.unset', plugin.notice_group_unsetadmin)
                this.set('notice.group_decrease', plugin.notice_group_decrease);
                this.set('notice.group_decrease.leave', plugin.notice_group_leave);
                this.set('notice.group_decrease.kick', plugin.notice_group_kick);
                this.set('notice.group_decrease.kick_me', plugin.notice_group_kickme);
                this.set('notice.group_increase', plugin.notice_group_increase);
                this.set('notice.group_increase.approve', plugin.notice_group_approve)
                this.set('notice.group_increase.invite', plugin.notice_group_invite);
                this.set('notice.friend_add', plugin.notice_friend_add);
                this.set('request.friend', plugin.request_friend)
                this.set('request.group', plugin.request_group)
                this.set('request.group.add', plugin.request_group_add);
                this.set('request.group.invite', plugin.request_group_invite)
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
                    lib: this.lib
                });
                if (t instanceof Promise) await t;
            }
        } catch (err) {
            this.log.error('Error loading plugin {0}:\n {1}'.translate().format(name, err));
        }
        return plugin;
    }
};
