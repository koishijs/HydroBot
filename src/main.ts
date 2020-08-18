/* eslint-disable import/no-dynamic-require */
/* eslint-disable global-require */
/* eslint-disable no-await-in-loop */
import path from 'path';
import { App, Command } from 'koishi-core';
import fs from 'fs-extra';
import body from 'koa-body';
import { apply as KoishiPluginTools } from 'koishi-plugin-tools';
import { apply as KoishiPluginMongo } from './lib/plugin-mongo';
import 'koishi-adapter-cqhttp';

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

String.prototype.decode = function decode() {
    return this.replace(/&#91;/gm, '[').replace(/&#93;/gm, ']').replace(/&amp;/gm, '&');
};
String.prototype.encode = function encode() {
    return this.replace(/&/gm, '&amp;').replace(/\[/gm, '&#91;').replace(/\]/gm, '&#93;');
};

export = class {
    config: NodeJS.Dict<any>;

    app: App;

    constructor(item) {
        this.config = item.config;
        this.app = new App({
            type: 'cqhttp:ws',
            server: `ws://${this.config.host || 'localhost'}:${this.config.port || '6700'}/?access_token=${this.config.access_token}`,
            port: this.config.api_port,
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
        this.app.plugin(KoishiPluginTools, {
            brainfuck: true,
            bvid: true,
            crypto: true,
            magi: true,
            maya: true,
            mcping: true,
            music: false,
            oeis: false,
            qrcode: true,
            roll: true,
            weather: true,
        });
        this.app.router.use(body());
        this.app.on('connect', async () => {
            for (const admin of this.config.admin) {
                this.app.database.getUser(admin, 5);
                console.log(`Opped ${admin}`);
            }
        });
        this.app.prependMiddleware(async (session, next) => {
            if (session.messageType === 'group') {
                await this.app.database.getGroup(session.groupId, session.selfId);
            }
            return next();
        });
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
                console.error('Failed to load ', plugin, e);
            }
        }
    }
};
