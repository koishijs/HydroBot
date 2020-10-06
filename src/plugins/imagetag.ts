/* eslint-disable import/no-dynamic-require */
import { resolve } from 'path';
import { tmpdir } from 'os';
import { createHash } from 'crypto';
import { Context, Session } from 'koishi-core';
import { CQCode, Logger } from 'koishi-utils';
import yaml from 'js-yaml';
import axios from 'axios';
import {
    unlink, writeFile, readFile, readFileSync,
} from 'fs-extra';
import { Collection } from 'mongodb';

const logger = new Logger('imagetag');
const imageRE = /(\[CQ:image,file=[^,]+,url=[^\]]+\])/;
const checkGroupAdmin = (session: Session<'authority'>) => (
    (session.$user.authority >= 4 || ['admin', 'owner'].includes(session.sender.role))
        ? false
        : '仅管理员可执行该操作。'
);

declare module 'koishi-core/dist/database' {
    interface Group {
        enableAutoTag?: number,
    }
}

interface ImageTagCache {
    _id: string,
    md5: string,
    txt: string,
}

function MD5(filePath: string) {
    const buffer = readFileSync(filePath);
    const hash = createHash('md5');
    hash.update(buffer);
    return hash.digest('hex');
}

export const apply = async (ctx: Context, config: any = {}) => {
    const transfile = await readFile(resolve(process.cwd(), 'database', 'image.tags.translation.yaml'));
    const trans = yaml.safeLoad(transfile.toString());
    const names = require(resolve(process.cwd(), 'database', 'class_names_6000.json'));

    ctx.on('before-attach-group', (_, fields) => {
        fields.add('enableAutoTag');
    });

    ctx.middleware(async (session, next) => {
        const capture = imageRE.exec(session.message);
        if (capture) {
            // @ts-ignore
            if (session.$group.enableAutoTag === 2) session.$executeSilent(`tag ${capture[1]}`);
            // @ts-ignore
            else if (session.$group.enableAutoTag === 1) session.$execute(`tag ${capture[1]}`);
        }
        return next();
    });

    ctx.app.on('connect', async () => {
        const coll: Collection<ImageTagCache> = ctx.app.database.db.collection('image.tag');
        coll.createIndex({ md5: 1 }, { unique: true });

        ctx.command('tag [image]', 'Get image tag', { hidden: true, cost: 3 })
            .action(async ({ session }, image) => {
                try {
                    if (!image) {
                        await session.$send('请发送图片。');
                        image = await session.$prompt(30000);
                    }
                    let id;
                    let url = image;
                    const file = CQCode.parse(image);
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
                    const fp = resolve(tmpdir(), `${Math.random().toString()}.png`);
                    await writeFile(fp, data);
                    const md5 = MD5(fp);
                    c = await coll.findOne({ md5 });
                    if (c) return c.txt;
                    logger.info('downloaded');
                    const { data: probs } = await axios.post('http://127.0.0.1:10377/', { path: fp }) as any;
                    if (typeof probs === 'string') {
                        let errmsg = probs.split('HTTP')[0];
                        if (probs.includes('output with shape') || probs.includes('size of tensor')) {
                            errmsg = '不支持的图片格式（请发送png格式图片）';
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
                            if (config.tags.includes(tag)) {
                                axios.get(`${config.url}&source=${encodeURIComponent(url)}&format=json`);
                                break;
                            }
                        }
                    }
                    await coll.insertOne({ _id: id, md5, txt });
                    await session.$send(txt);
                    await unlink(fp);
                } catch (e) {
                    return e.toString().split('\n')[0];
                }
            });

        ctx.command('tag.disable', '在群内禁用', { noRedirect: true })
            .userFields(['authority'])
            .before(checkGroupAdmin)
            .groupFields(['enableAutoTag'])
            .action(({ session }) => {
                session.$group.enableAutoTag = 0;
                return 'Disabled';
            });

        ctx.command('tag.enable', '在群内启用', { noRedirect: true })
            .option('silent', '-s')
            .userFields(['authority'])
            .before(checkGroupAdmin)
            .groupFields(['enableAutoTag'])
            .action(({ session, options }) => {
                session.$group.enableAutoTag = options.silent ? 2 : 1;
                return 'enabled';
            });
    });
};
