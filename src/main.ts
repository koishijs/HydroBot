/* eslint-disable import/no-dynamic-require */
/* eslint-disable global-require */
/* eslint-disable no-await-in-loop */
import path from 'path';
import {
    App, Command, ExecuteArgv, NextFunction,
} from 'koishi-core';
import { Session } from 'koishi-core/dist/session';
import { Logger, noop } from 'koishi-utils';
import fs from 'fs-extra';
import { apply as KoishiPluginMongo } from 'koishi-plugin-mongo';
import 'koishi-adapter-cqhttp';
// import './plugins/adapter-telegram/index';

process.on('unhandledRejection', (_, p) => {
    console.log('Unhandled Rejection:', p);
});

Command.defaultConfig.checkArgCount = true;

declare global {
    interface String {
        decode: () => string,
        encode: () => string,
    }
}
declare module 'koishi-core' {
    interface Session {
        _silent: boolean,
        $executeSilent(argv: ExecuteArgv): Promise<void>,
        $executeSilent(message: string, next?: NextFunction): Promise<void>,
    }
}

String.prototype.decode = function decode() {
    return this.replace(/&#91;/gm, '[').replace(/&#93;/gm, ']').replace(/&amp;/gm, '&');
};
String.prototype.encode = function encode() {
    return this.replace(/&/gm, '&amp;').replace(/\[/gm, '&#91;').replace(/\]/gm, '&#93;');
};
Session.prototype.$executeSilent = function $executeSilent(this: Session, arg0: any, arg1?: any) {
    this._silent = true;
    this.$send = noop;
    this.$sendQueued = noop;
    return this.$execute(arg0, arg1);
};

export = class {
    config: NodeJS.Dict<any>;

    app: App;

    logger: Logger;

    constructor(item) {
        this.logger = new Logger('main');
        this.config = item.config;
        this.app = new App({
            port: this.config.port,
            bots: this.config.bots,
            type: this.config.type,
            prefix: this.config.prompt as string,
            preferSync: true,
            defaultAuthority: 1,
            similarityCoefficient: 0.9,
        });
        this.run();
    }

    async run() {
        fs.ensureDirSync(path.resolve(__dirname, '..', '.cache'));
        this.app.plugin(KoishiPluginMongo, this.config.db);
        this.app.on('connect', async () => {
            for (const admin of this.config.admin) {
                this.app.database.getUser(admin, 5);
                this.app.database.setUser(admin, { authority: 5, sudoer: true });
                this.logger.info(`Opped ${admin}`);
            }
        });
        this.app.prependMiddleware(async (session, next) => {
            if (session.messageType === 'group') {
                await this.app.database.getGroup(session.groupId, session.selfId);
            }
            return next();
        });
        this.app.on('request/friend', (session) => session.$bot.setFriendAddRequest(session.flag, true));
        this.app.on('request/group/invite', (session) => session.$bot.setGroupAddRequest(session.flag, 'invite', true));
        await this.load();
        await this.app.start();
        await this.app.getSelfIds();
    }

    async load() {
        for (const plugin of this.config.enabledplugins) {
            try {
                if (typeof plugin === 'string') {
                    this.app.plugin(require(plugin).apply);
                } else if (plugin instanceof Array) {
                    this.app.plugin(require(plugin[0]).apply, plugin[1]);
                }
            } catch (e) {
                this.logger.error('Failed to load ', plugin, e);
            }
        }
    }
};
