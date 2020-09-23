import { App, Bot, Meta, Server } from 'koishi-core';
import {
    Logger, defineProperty, snakeCase, assertProperty,
} from 'koishi-utils';
import { } from 'koa-bodyparser';
import Axios, { AxiosInstance } from 'axios';
import Telegram from './interface';

export interface ResponsePayload {
    delete?: boolean
    ban?: boolean
    banDuration?: number
    kick?: boolean
    reply?: string
    autoEscape?: boolean
    atSender?: boolean
    approve?: boolean
    remark?: string
    reason?: string
}

declare module 'koishi-core/dist/session' {
    interface Session {
        _response?: (payload: ResponsePayload) => void
    }
}

const logger = new Logger('server');

export default class TelegramHTTPServer extends Server {
    _axios: AxiosInstance

    constructor(app: App) {
        assertProperty(app.options, 'port');
        const bot = app.options.bots.find((bot) => bot.server);
        if (!bot.type) logger.info('infer type as telegram');
        super(app);
    }

    private async __listen(bot: Bot) {
        bot.ready = true;
        this._axios = Axios.create({ baseURL: bot.server });
        const path = new URL(bot.url).pathname;
        this.router.all(path, (ctx) => {
            logger.info('receive %o', ctx.request.body);
            const payload = ctx.request.body as Telegram.Update;
            const body: Meta = {
                selfId: bot.selfId,
            };
            if (payload.message) {
                body.messageId = payload.message.message_id;
                body.postType = 'message';
                body.messageType = payload.message.chat.type === 'private' ? 'private' : 'group';
                body.time = payload.message.date;
                // TODO convert message
                body.message = body.rawMessage = payload.message.text;
                body.userId = payload.message.from.id;
                body.groupId = payload.message.chat.id;
                body.sender = {
                    userId: payload.message.from.id,
                    nickname: payload.message.from.username,
                    sex: 'unknown',
                    age: 0,
                    card: payload.message.from.username,
                };
            }
            const meta = this.prepare(body);
            if (!meta) return ctx.status = 403;
            const { quickOperation } = this.app.options;
            if (quickOperation > 0) {
                // bypass koa's built-in response handling for quick operations
                ctx.respond = false;
                ctx.res.writeHead(200, {
                    'Content-Type': 'application/json',
                });
                // use defineProperty to avoid meta duplication
                defineProperty(meta, '$response', (data: any) => {
                    meta._response = null;
                    clearTimeout(timer);
                    ctx.res.write(JSON.stringify(snakeCase(data)));
                    ctx.res.end();
                });
                const timer = setTimeout(() => {
                    meta._response = null;
                    ctx.res.end();
                }, quickOperation);
            }

            // dispatch events
            this.dispatch(meta);
        });
        bot._request = async (action, params) => {
            const { data } = await this._axios.get(action, { params });
            return data;
        };
        await bot.get('setWebhook');
        await bot.get('setWebhook', { url: bot.url });
        logger.info('connected to %c', bot.server);
    }

    async _listen() {
        await Promise.all(this.bots.map((bot) => this.__listen(bot)));
    }

    _close() {
        logger.debug('http server closing');
        this.server.close();
    }
}

Server.types.telegram = TelegramHTTPServer;
