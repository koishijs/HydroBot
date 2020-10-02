import path from 'path';
import os from 'os';
import fs from 'fs-extra';
import { Context } from 'koishi-core';
import boa from '@pipcook/boa';

const { TextRank4Keyword } = boa.import('textrank4zh');
const { WordCloud } = boa.import('wordcloud');

export async function apply(ctx: Context, config: any) {
    ctx.app.on('connect', async () => {
        const c = ctx.app.database.db.collection('message');

        ctx.command('wordcloud', 'Get daily wordcloud', { minInterval: 60000, cost: 5 })
            .action(async ({ session }) => {
                const messages = await c.find(
                    { time: { $gt: new Date(new Date().getTime() - 24 * 3600 * 1000) }, group: session.groupId },
                ).project({ message: 1 }).toArray();
                const text = messages.map((line) => line.message
                    .replace(/\[CQ:\w+,.+?\]/gmi, '')
                    .replace(/(https?|ftp|file):\/\/[-A-Za-z0-9+&@#/%?=~_|!:,.;]+[-A-Za-z0-9+&@#/%=~_|]/gmi, '')
                    .replace('&#91;视频&#93;你的QQ暂不支持查看视频短片，请升级到最新版本后查看。', '')).join(' ');
                const window = config.windowSize ?? 5;
                const keyWordLen = config.keyWordLen ?? 3;
                const keyWordNum = config.keyWordNum ?? 50;
                const fontPath = config.fontPath;
                const tr4w = TextRank4Keyword();
                tr4w.analyze(boa.kwargs({ text, lower: true, window }));
                const words = {};
                for (const item of tr4w.get_keywords(keyWordNum, boa.kwargs({ word_min_len: keyWordLen }))) words[item.word] = item.weight;
                const wc = WordCloud(boa.kwargs({ font_path: fontPath, background_color: 'white' }));
                const getter = () => Object.entries(words);
                wc.generate_from_frequencies({ items: getter });
                const file = path.join(os.tmpdir(), `${Math.random().toString()}.png`);
                wc.to_file(file);
                await session.$send(`今日热词：[CQ:image,file=file://${file}]`);
                await fs.unlink(file);
            });
    });
}
