import { App } from 'koishi-core';
import { Logger, noop } from 'koishi-utils';
import { PNG } from 'pngjs';
import { } from 'koishi-plugin-puppeteer';

export interface Config {
    loadTimeout?: number
    idleTimeout?: number
    maxLength?: number
}

export const defaultConfig: Config = {
    loadTimeout: 10000, // 10s
    idleTimeout: 30000, // 30s
    maxLength: 1000000, // 1MB
};

const allowedProtocols = ['http', 'https'];

const logger = Logger.create('puppeteer');

export function apply(app: App, config: Config) {
    config = { ...defaultConfig, ...config };

    app.command('shot').dispose();

    app.command('page <url...>', 'Get page', { minInterval: 1000, checkArgCount: false })
        .alias('screenshot', 'shot')
        .option('full', '-f Full page')
        .option('viewport', '<viewport> 指定Viewport', { fallback: '1600x900' })
        .action(async ({ session, options }, message = '') => {
            let url = message.trim();
            if (!url) return '请输入网址。';
            const t = options.viewport.split('x');
            if (t.length !== 2) return session.$send('Invalid vieport');
            const scheme = /^(\w+):\/\//.exec(url);
            if (!scheme) url = `http://${url}`;
            else if (!allowedProtocols.includes(scheme[1])) return '请输入正确的网址。';
            const page = await app.browser.newPage();
            let loaded = false;
            page.on('load', () => loaded = true);
            await page.setViewport({
                width: parseInt(t[0], 10),
                height: parseInt(t[1], 10),
                deviceScaleFactor: 1,
            });
            try {
                await new Promise((resolve, reject) => {
                    const timer = setTimeout(
                        () => (loaded
                            ? session.$send('正在加载中，请稍等片刻~')
                            : reject(new Error('navigation timeout'))
                        ),
                        config.loadTimeout,
                    );
                    const _resolve = () => {
                        clearTimeout(timer);
                        resolve();
                    };
                    page.goto(url, {
                        waitUntil: 'networkidle0',
                        timeout: config.idleTimeout,
                    }).then(_resolve, () => (loaded ? _resolve() : reject(new Error('navigation timeout'))));
                });
            } catch (error) {
                page.close();
                logger.debug(error);
                return '无法打开页面。';
            }

            return page.screenshot({
                fullPage: options.full,
            }).then(async (buffer) => {
                page.close();
                if (buffer.byteLength > config.maxLength) {
                    await new Promise<PNG>((resolve, reject) => {
                        const png = new PNG();
                        png.parse(buffer, (error, data) => (error ? reject(error) : resolve(data)));
                    }).then((data) => {
                        const width = data.width;
                        const height = (data.height * config.maxLength) / buffer.byteLength;
                        const png = new PNG({ width, height });
                        data.bitblt(png, 0, 0, width, height, 0, 0);
                        buffer = PNG.sync.write(png);
                    }).catch(noop);
                }
                return `[CQ:image,file=base64://${buffer.toString('base64')}]`;
            }, (error) => {
                page.close();
                logger.debug(error);
                return '截图失败。';
            });
        });
}
