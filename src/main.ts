/* eslint-disable import/no-duplicates */
/* eslint-disable import/no-dynamic-require */
/* eslint-disable global-require */
/* eslint-disable no-await-in-loop */
import path from 'path';
import {
    App, Argv, Command, NextFunction, Session,
} from 'koishi-core';
import { Logger, noop } from 'koishi-utils';
import fs from 'fs-extra';
import { apply as KoishiPluginMongo } from 'koishi-plugin-mongo';
import 'koishi-adapter-onebot';
import 'koishi-adapter-telegram';

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
declare module 'koishi-core/dist/session' {
    interface Session {
        _silent: boolean,
        executeSilent(content: string, next?: NextFunction): Promise<string>;
        executeilent(argv: Argv, next?: NextFunction): Promise<string>;
    }
}

String.prototype.decode = function decode() {
    return this.replace(/&#91;/gm, '[').replace(/&#93;/gm, ']').replace(/&amp;/gm, '&');
};
String.prototype.encode = function encode() {
    return this.replace(/&/gm, '&amp;').replace(/\[/gm, '&#91;').replace(/\]/gm, '&#93;');
};
Session.prototype.executeSilent = function executeSilent(this: Session, arg0: any, arg1?: any) {
    this._silent = true;
    this.send = noop;
    this.sendQueued = noop;
    return this.execute(arg0, arg1);
};

export = class {
    config: Record<string, any>;

    app: App;

    logger: Logger;

    constructor(item) {
        this.logger = new Logger('main');
        this.config = item.config;
        this.app = new App({
            port: this.config.port,
            bots: this.config.bots,
            type: this.config.type,
            onebot: this.config.onebot,
            telegram: this.config.telegram,
            prefix: this.config.prompt as string,
            autoAuthorize: 1,
            autoAssign: true,
            similarityCoefficient: 0.7,
        });
        this.run();
    }

    async run() {
        fs.ensureDirSync(path.resolve(__dirname, '..', '.cache'));
        this.app.plugin(KoishiPluginMongo, this.config.db);
        this.app.on('connect', async () => {
            for (const line of this.config.admin) {
                const users = line.split('&');
                let found;
                for (const user of users) {
                    const [type, id] = user.split(':');
                    const udoc = await this.app.database.getUser(type, id);
                    if (udoc) found = [type, id];
                }
                const map = Object.assign({}, ...users.map((i) => i.split(':')).map((i) => ({ [i[0]]: i[1] })));
                if (found) {
                    this.app.database.setUser(found[0], found[1], { ...map, authority: 5, sudoer: true });
                }
                this.logger.info(`Opped ${line}`);
            }
        });
        await this.load();
        await this.app.start();
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
