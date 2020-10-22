/* eslint-disable no-await-in-loop */
import { Context } from 'koishi-core';
import { apply as KoishiPluginTeach, Dialogue } from 'koishi-plugin-teach';
import axios from 'axios';
import { Binary, Collection } from 'mongodb';

declare module 'koishi-core/dist/command' {
    interface CommandConfig {
        noRedirect?: boolean,
    }
}
declare module 'koishi-core/dist/session' {
    interface Session {
        _dialogue?: Dialogue
    }
}
declare module 'koishi-core/dist/app' {
    interface App {
        getImageServerStatus(): Promise<ImageServerStatus>
    }
}
declare module 'koishi-plugin-teach/dist/utils' {
    // eslint-disable-next-line no-shadow
    namespace Dialogue {
        interface Config {
            imagePath?: string
            imageServer?: string
            uploadKey?: string
            uploadPath?: string
            uploadServer?: string
        }
    }
}
interface ImageServerStatus {
    totalSize: number
    totalCount: number
}
interface ImageDoc {
    _id: string,
    data: Binary
}

const imageRE = /\[CQ:image,file=([^,]+),url=([^\]]+)\]/;
const REimage = /\[CQ:image,file=image:\/\/([^,]+)\]/;

export const apply = (ctx: Context, config: Dialogue.Config) => {
    const logger = ctx.logger('teach');

    ctx.plugin(KoishiPluginTeach, config);

    ctx.on('before-command', async ({ session, command }) => {
        const noRedirect = command.getConfig('noRedirect', session);
        if (noRedirect && session._redirected) {
            const creator = await ctx.app.database.getUser(session._dialogue.writer, ['authority']);
            // @ts-ignore
            if (creator.authority < 5 && !creator.sudoer) return '不支持在插值中调用该命令。';
        }
    });

    ctx.on('connect', () => {
        const coll: Collection<ImageDoc> = ctx.app.database.db.collection('image');

        const downloadFile = async (file: string, url: string) => {
            if (await coll.findOne({ _id: file })) return;
            const { data } = await axios.get<ArrayBuffer>(url, { responseType: 'arraybuffer' });
            const buf = Buffer.alloc(data.byteLength);
            const view = new Uint8Array(data);
            for (let i = 0; i < buf.length; ++i) buf[i] = view[i];
            await coll.insertOne({ _id: file, data: new Binary(buf) });
        };

        ctx.on('dialogue/detail', async (dialogue, output) => {
            try {
                for (const i in output) {
                    let t = '';
                    let capture: RegExpExecArray;
                    // eslint-disable-next-line no-cond-assign
                    while (capture = REimage.exec(output[i])) {
                        const [text, file] = capture;
                        t += output[i].slice(0, capture.index);
                        output[i] = output[i].slice(capture.index + text.length);
                        const res = await coll.findOne({ _id: file });
                        t += `[CQ:image,file=base64://${res.data.buffer.toString('base64')}]`;
                    }
                    output[i] = t + output[i];
                }
            } catch (error) {
                logger.warn(error.message);
                throw new Error('下载图片时发生错误。');
            }
        });

        ctx.on('dialogue/before-send', async (state) => {
            let { answer } = state;
            if (!answer) return;
            try {
                let output = '';
                let capture: RegExpExecArray;
                // eslint-disable-next-line no-cond-assign
                while (capture = REimage.exec(answer)) {
                    const [text, file] = capture;
                    output += answer.slice(0, capture.index);
                    answer = answer.slice(capture.index + text.length);
                    const res = await coll.findOne({ _id: file });
                    output += `[CQ:image,file=base64://${res.data.buffer.toString('base64')}]`;
                }
                state.answer = output + answer;
            } catch (error) {
                logger.warn(error.message);
                throw new Error('下载图片时发生错误。');
            }
        });

        ctx.on('dialogue/before-modify', async ({ options }) => {
            let { answer } = options;
            if (!answer) return;
            try {
                let output = '';
                let capture: RegExpExecArray;
                // eslint-disable-next-line no-cond-assign
                while (capture = imageRE.exec(answer)) {
                    const [text, file, url] = capture;
                    output += answer.slice(0, capture.index);
                    answer = answer.slice(capture.index + text.length);
                    await downloadFile(file, url);
                    output += `[CQ:image,file=image://${file}]`;
                }
                options.answer = output + answer;
            } catch (error) {
                logger.warn(error.message);
                return '上传图片时发生错误。';
            }
        });
    });
};
