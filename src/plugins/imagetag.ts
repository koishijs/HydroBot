/* eslint-disable import/no-dynamic-require */
import { resolve } from 'path';
import { tmpdir } from 'os';
import { Context, Session } from 'koishi-core';
import { CQCode, Logger } from 'koishi-utils';
import yaml from 'js-yaml';
import axios from 'axios';
import { unlink, writeFile, readFile } from 'fs-extra';

const logger = new Logger('imagetag');
const imageRE = /(\[CQ:image,file=[^,]+,url=[^\]]+\])/;
const checkGroupAdmin = (session: Session<'authority'>) => (
    (session.$user.authority >= 4 || ['admin', 'owner'].includes(session.sender.role))
        ? false
        : '仅管理员可执行该操作。'
);

declare module 'koishi-core/dist/database' {
    interface Group {
        enableAutoTag?: boolean,
    }
}

export const apply = async (ctx: Context, config: any = {}) => {
    const transfile = await readFile(resolve(process.cwd(), 'database', 'image.tags.translation.yaml'));
    const trans = yaml.safeLoad(transfile.toString());
    const names = require(resolve(process.cwd(), 'database', 'class_names_6000.json'));

    ctx.on('before-attach-group', (session, fields) => {
        fields.add('enableAutoTag');
    });

    ctx.middleware(async (session, next) => {
        const capture = imageRE.exec(session.message);
        if (capture) {
            // @ts-ignore
            if (!session.$group.enableAutoTag) session.$executeSilent(`tag ${capture[1]}`);
            else session.$execute(`tag ${capture[1]}`);
        }
        return next();
    });

    ctx.command('tag <image>', 'Get image tag', { hidden: true, cost: 3 })
        .action(async ({ session }, image) => {
            try {
                const file = CQCode.parse(image);
                const { data } = await axios.get<ArrayBuffer>(file.data.url, { responseType: 'arraybuffer' });
                const fp = resolve(tmpdir(), `${Math.random().toString()}.png`);
                await writeFile(fp, data);
                logger.info('downloaded');
                const { data: probs } = await axios.post('http://127.0.0.1:10377/', { path: fp }) as any;
                if (typeof probs === 'string') {
                    if (probs.includes('output with shape')) throw new Error('不支持的图片格式');
                    throw new Error(probs.split('HTTP')[0]);
                }
                console.log(probs);
                const tags = [];
                let txt = '';
                for (const i of probs) {
                    tags.push(names[i[0]]);
                    txt += `${trans[names[i[0]]] || names[i[0]]}:${Math.floor(i[1] * 100)}%    `;
                }
                if (config.url && config.tags) {
                    for (const tag of tags) {
                        if (config.tags.includes(tag)) {
                            axios.get(`${config.url}&source=${encodeURIComponent(file.data.url)}&format=json`);
                            break;
                        }
                    }
                }
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
            session.$group.enableAutoTag = false;
            return 'Disabled';
        });

    ctx.command('tag.enable', '在群内启用', { noRedirect: true })
        .userFields(['authority'])
        .before(checkGroupAdmin)
        .groupFields(['enableAutoTag'])
        .action(({ session }) => {
            session.$group.enableAutoTag = true;
            return 'enabled';
        });
};
