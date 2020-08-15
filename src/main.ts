/* eslint-disable import/no-dynamic-require */
/* eslint-disable global-require */
/* eslint-disable no-await-in-loop */
import path from 'path';
import { App, Command } from 'koishi-core';
import fs from 'fs-extra';
import Koa from 'koa';
import Router from 'koa-router';
import body from 'koa-body';
import { apply as KoishiPluginEval } from 'koishi-plugin-eval';
import { apply as KoishiPluginTools } from 'koishi-plugin-tools';
import { apply as KoishiPluginStatus } from 'koishi-plugin-status';
import { apply as KoishiPluginImageSearch } from 'koishi-plugin-image-search';
import { apply as KoishiPluginMongo } from './lib/plugin-mongo';
import { apply as KoishiPluginTeach } from './plugins/plugin-teach/index';
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
declare module 'koishi-core/dist/context' {
    interface Context {
        koa: Koa
        api: Router
    }
}

String.prototype.decode = function decode() {
    return this.replace(/&#91;/gm, '[').replace(/&#93;/gm, ']').replace(/&amp;/gm, '&');
};
String.prototype.encode = function encode() {
    return this.replace(/\[/gm, '&#91;').replace(/\]/gm, '&#93;').replace(/&/gm, '&amp;');
};

export = class {
    config: NodeJS.Dict<any>;

    app: App;

    constructor(item) {
        this.config = item.config;
        this.app = new App({
            type: 'cqhttp:ws',
            server: `ws://${this.config.host || 'localhost'}:${this.config.port || '6700'}`,
            token: this.config.access_token,
            secret: this.config.access_token,
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
        this.app.plugin(KoishiPluginStatus);
        this.app.plugin(KoishiPluginImageSearch);
        this.app.plugin(KoishiPluginTeach);
        this.app.plugin(KoishiPluginEval, {
            timeout: 5000,
            resourceLimits: {
                maxYoungGenerationSizeMb: 32,
                maxOldGenerationSizeMb: 128,
                codeRangeSizeMb: 32,
            },
        });
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
        this.app.koa = new Koa();
        this.app.api = new Router();
        this.app.koa.use(body());
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
        if (this.config.api_port) {
            this.app.koa.use(this.app.api.routes()).use(this.app.api.allowedMethods());
            this.app.koa.listen(this.config.api_port);
            console.log(`API inited at port ${this.config.api_port}`);
        }
    }

    async load() {
        for (const plugin of this.config.enabledplugins) {
            try {
                if (typeof plugin === 'string') {
                    this.app.plugin(require(`./plugins/${plugin}`).apply);
                }
            } catch (e) {
                console.error('Failed to load ', plugin, e);
            }
        }
    }
};
