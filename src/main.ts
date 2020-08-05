/* eslint-disable import/no-dynamic-require */
/* eslint-disable global-require */
/* eslint-disable no-await-in-loop */
import path from 'path';
import { App } from 'koishi';
import fs from 'fs-extra';
import Koa from 'koa';
import Router from 'koa-router';
import body from 'koa-body';
import { apply as KoishiPluginCommon } from 'koishi-plugin-common';
import { apply as KoishiPluginEval } from 'koishi-plugin-eval';
import { apply as KoishiPluginMongo } from './lib/plugin-mongo';

process.on('unhandledRejection', (reason, p) => {
    console.log('Unhandled Rejection at:', p, '\nreason:', reason);
});

declare global {
    interface String {
        decode: () => string,
        encode: () => string,
    }
}
declare module 'koishi-core' {
    interface Context {
        koa: Koa
        router: Router
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
            type: 'ws',
            port: 6700,
            server: `ws://${this.config.host || 'localhost'}:${this.config.port || '6700'}`,
            token: this.config.access_token,
            prefix: this.config.prompt as string,
            preferSync: true,
            defaultAuthority: 1,
        });
        this.run();
    }

    async run() {
        fs.ensureDirSync(path.resolve(__dirname, '..', '.cache'));
        this.app.plugin(KoishiPluginMongo, this.config.db);
        this.app.plugin(KoishiPluginEval, {
            timeout: 5000,
            resourceLimits: {
                maxYoungGenerationSizeMb: 32,
                maxOldGenerationSizeMb: 128,
                codeRangeSizeMb: 32,
            },
        });
        this.app.plugin(KoishiPluginCommon, {
            admin: false,
            broadcast: true,
            contextify: false,
            echo: false,
            exit: false,
            info: false,
            usage: false,
            debug: {
                showGroupId: true,
            },
        });
        this.app.koa = new Koa();
        this.app.router = new Router();
        this.app.koa.use(body());
        this.app.on('connect', async () => {
            console.log('Connected');
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
        if (this.config.api_port) {
            this.app.koa.use(this.app.router.routes()).use(this.app.router.allowedMethods());
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
