import superagent from 'superagent';
import { Context, Logger } from 'koishi-core';

const logger = new Logger('luogu');

export const apply = (ctx: Context) => {
    ctx.command('oi', 'OI related');
    ctx.command('oi/luogu', 'Luogu');

    ctx.command('oi/luogu.problem <pid>', '获取Luogu题目')
        .action(async (_, id) => {
            const page = await ctx.app.browser.newPage();
            try {
                await page.goto(`https://www.luogu.com.cn/problem/${id}`, {
                    waitUntil: 'networkidle0',
                });
            } catch (error) {
                page.close();
                return '请求超时。';
            }
            const element = await page.$('.problem-card');
            return element.screenshot().then(async (buffer: Buffer) => {
                page.close();
                return `[CQ:image,file=base64://${buffer.toString('base64')}]`;
            }, (error) => {
                page.close();
                logger.debug(error);
                return '截图失败。';
            });
        });

    ctx.command('oi/luogu.user <uid>', '查询用户')
        .action(async (_, id) => {
            const res = await superagent.get(`https://www.luogu.com.cn/user/${id}?_contentOnly=1`)
                .set('User-Agent', 'Mozilla/5.0 (Windows NT 10.0; WOW64; Trident/7.0; rv:11.0) like Gecko');
            if (res.body.code === '404') return '没这个人!';
            const udoc = res.body.currentData.user;
            const level = udoc.ccfLevel === 0
                ? '无/藏了以方便假'
                : udoc.ccfLevel;
            return `${udoc.name}
关注: ${udoc.followingCount}
粉丝: ${udoc.followerCount}${udoc.passedProblemCount ? `
ACs/Submits: ${udoc.passedProblemCount}/${udoc.submittedProblemCount}` : ''}
颜色: ${udoc.color}
CCF评级:${level}`;
        });
};
