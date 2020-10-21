import { exec } from 'child_process';
import path from 'path';
import { tmpdir } from 'os';
import { Context } from 'koishi-core';
import { sleep } from 'koishi-utils';
import { unlink } from 'fs-extra';

export const apply = (ctx: Context) => {
    ctx.command('glados <message...>', 'Glados', { minInterval: 30000, cost: 3 })
        .action(async ({ session }, text) => {
            const id = Math.random().toString();
            const wav = path.resolve(tmpdir(), `${id}.wav`);
            const res = await new Promise((resolve) => {
                exec(`wget --tries=50 -O ${wav} https://glados.c-net.org/generate?text=${encodeURIComponent(text)}`, (err) => {
                    if (err) resolve(err);
                    resolve();
                });
            });
            if (res) {
                session.$send('请求正在处理中，请稍后（这可能需要数分钟）');
                await sleep(100000);
                const res1 = await new Promise((resolve) => {
                    exec(`wget --tries=50 -O ${wav} https://glados.c-net.org/generate?text=${encodeURIComponent(text)}`, (err) => {
                        if (err) resolve(err);
                        resolve();
                    });
                });
                if (res1) throw new Error('Service Error');
            }
            await session.$send(`[CQ:record,file=file://${wav}]`);
            await unlink(wav);
        });
};
