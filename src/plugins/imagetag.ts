/* eslint-disable import/no-dynamic-require */
import { resolve } from 'path';
import { createHash } from 'crypto';
import { Context, Logger, segment } from 'koishi-core';
import yaml from 'js-yaml';
import axios from 'axios';
import { readFile } from 'fs-extra';
import sharp from 'sharp';

const logger = new Logger('imagetag');
const imageRE = /(\[CQ:image,file=[^,]+,url=[^\]]+\])/;
const checkGroupAdmin = ({ session }) => (
    (session.user.authority >= 4 || session.author.roles.includes('admin') || session.author.roles.includes('owner'))
        ? null
        : '仅管理员可执行该操作。'
);

interface ImageTagCache {
    _id: string,
    md5: string,
    txt: string,
}
declare module 'koishi-core/dist/database' {
    interface Channel {
        enableAutoTag?: number,
    }
    interface Tables {
        'image.tag': ImageTagCache
    }
}

function MD5(buffer: Buffer) {
    const hash = createHash('md5');
    hash.update(buffer);
    return hash.digest('hex');
}

export const apply = async (ctx: Context, config: any = {}) => {
    const transfile = await readFile(resolve(process.cwd(), 'database', 'image.tags.translation.yaml'));
    const trans = yaml.safeLoad(transfile.toString());
    const names = require(resolve(process.cwd(), 'database', 'class_names_6000.json'));

    ctx.on('before-attach-channel', (_, fields) => {
        fields.add('enableAutoTag');
    });

    ctx.middleware(async (session, next) => {
        const capture = imageRE.exec(session.content);
        if (capture) {
            // @ts-ignore
            if (session.channel.enableAutoTag === 2) session.executeSilent(`tag ${capture[1]}`);
            // @ts-ignore
            else if (session.channel.enableAutoTag === 1) session.execute(`tag ${capture[1]}`);
        }
        return next();
    });

    ctx.app.on('connect', async () => {
        const coll = ctx.app.database.collection('image.tag');
        coll.createIndex({ md5: 1 }, { unique: true });

        ctx.command('tag [image]', 'Get image tag', { hidden: true, minInterval: 2000 })
            .action(async ({ session }, image) => {
                try {
                    if (!image) {
                        await session.send('请发送图片。');
                        image = await session.prompt(30000);
                    }
                    let id;
                    let url = image;
                    const file = segment.from(image);
                    if (file) {
                        if (file.type !== 'image') throw new Error('没有发现图片。');
                        url = file.data.url;
                        id = file.data.file;
                    }
                    if (!url.startsWith('http')) throw new Error('没有发现图片。');
                    if (!id) id = Buffer.from(url).toString('base64');
                    let c = await coll.findOne({ _id: id });
                    if (c) return c.txt;
                    const { data } = await axios.get<ArrayBuffer>(url, { responseType: 'arraybuffer' });
                    const buf = Buffer.alloc(data.byteLength);
                    const view = new Uint8Array(data);
                    for (let i = 0; i < buf.length; ++i) buf[i] = view[i];
                    const md5 = MD5(buf);
                    c = await coll.findOne({ md5 });
                    if (c) return c.txt;
                    const img = (await sharp(buf).png().toBuffer()).toString('base64');
                    logger.info('downloaded');
                    const { data: probs } = await axios.post('http://127.0.0.1:10377/', { img }) as any;
                    if (typeof probs === 'string') {
                        let errmsg = probs.split('HTTP')[0];
                        if (probs.includes('output with shape') || probs.includes('size of tensor')) {
                            errmsg = '不支持的图片格式（请尝试截图发送）';
                            await coll.insertOne({ _id: id, md5, txt: errmsg });
                        }
                        throw new Error(errmsg);
                    }
                    const tags = [];
                    let txt = '';
                    for (const i of probs) {
                        tags.push(names[i[0]]);
                        txt += `${trans[names[i[0]]] || names[i[0]]}:${Math.floor(i[1] * 100)}%  `;
                    }
                    logger.info(txt);
                    if (config.url && config.tags) {
                        for (const tag of tags) {
                            if (config.tags.includes(tag) || tags.length > 7) {
                                axios.get(`${config.url}&source=${encodeURIComponent(url)}&format=json`);
                                break;
                            }
                        }
                    }
                    await coll.insertOne({ _id: id, md5, txt });
                    return txt;
                } catch (e) {
                    return e.toString().split('\n')[0];
                }
            });

        ctx.command('tag.disable', '在群内禁用', { noRedirect: true })
            .userFields(['authority'])
            .check(checkGroupAdmin)
            .channelFields(['enableAutoTag'])
            .action(({ session }) => {
                session.channel.enableAutoTag = 0;
                return 'Disabled';
            });

        ctx.command('tag.enable', '在群内启用', { noRedirect: true })
            .option('silent', '-s')
            .userFields(['authority'])
            .check(checkGroupAdmin)
            .channelFields(['enableAutoTag'])
            .action(({ session, options }) => {
                session.channel.enableAutoTag = options.silent ? 2 : 1;
                return 'enabled';
            });
    });
};
