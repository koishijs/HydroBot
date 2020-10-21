import { App } from 'koishi-core';
import superagent from 'superagent';
import { filter } from 'lodash';

export function apply(app: App) {
    app.command('oi', 'OI related');
    app.command('oi/cf', 'Codeforces');

    app.command('oi/cf.user <name>', 'Codeforces User', { minInterval: 3000 })
        .action(async (_, name) => {
            const res = await superagent.get(`https://codeforces.com/api/user.info?handles=${name}`).catch(() => { });
            if (!res) return 'CF 挂了！';
            if (res.body.status === 'FAILED') return '没这个人!';
            const result = res.body.result[0];
            return `${result.handle} ${result.firstName || ''} ${result.lastName || ''} ${result.organization || ''}
[CQ:image,file=https:${result.avatar}]
Rating: ${result.rating}
Rank: ${result.rank}
MaxRating: ${result.maxRating}
MaxRank: ${result.maxRank}`;
        });

    app.command('oi/cf.contest', 'Codeforces Contest', { minInterval: 3000 })
        .action(async () => {
            const res = await superagent.get('https://codeforces.com/api/contest.list').catch(() => { });
            if (!res || res.body.status !== 'OK') return 'CF 挂了！';
            const now = new Date().getTime();
            const contests = filter(
                res.body.result,
                (contest) => contest.startTimeSeconds * 1000 > now,
            );
            let message = '最近的比赛：\n';
            for (let i = contests.length - 1; i >= Math.max(contests.length - 5, 0); i--) {
                const c = contests[i];
                message += `${c.name} ${new Date(c.startTimeSeconds * 1000).toLocaleString()}\n`;
            }
            return message;
        });
}
