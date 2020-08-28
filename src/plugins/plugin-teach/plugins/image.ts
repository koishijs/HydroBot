/* eslint-disable no-await-in-loop */
import { Context } from 'koishi-core';
import axios from 'axios';
import { Binary, Collection } from 'mongodb';

declare module 'koishi-core/dist/app' {
    interface App {
        getImageServerStatus(): Promise<ImageServerStatus>
    }
}

declare module '../utils' {
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

export default function apply(ctx: Context) {
    const logger = ctx.logger('teach');

    ctx.on('connect', () => {
        const coll: Collection<ImageDoc> = ctx.app.database.db.collection('image');

        const downloadFile = async (file: string, url: string) => {
            const { data } = await axios.get<ArrayBuffer>(url, { responseType: 'arraybuffer' });
            const buf = Buffer.alloc(data.byteLength);
            const view = new Uint8Array(data);
            for (let i = 0; i < buf.length; ++i) buf[i] = view[i];
            await coll.insertOne({ _id: file, data: new Binary(buf) });
        };

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
}
