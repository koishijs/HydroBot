import { App } from 'koishi';
import superagent from 'superagent';

export function apply(app: App) {
    app.command('cf', 'Codeforces');

    app.command('cf.user <name>', 'Codeforces User')
        .action(async (_, name) => {
            const res = await superagent.get(`https://codeforces.com/api/user.info?handles=${name}`);
            if (res.body.status === 'FAILED') return '没这个人!';
            const result = res.body.result[0];
            return `${result.handle} ${result.firstName} ${result.lastName} ${result.organization}
[CQ:image,file=https:${result.avatar}]
Rating: ${result.rating}
Rank: ${result.rank}
MaxRating: ${result.maxRating}
MaxRank: ${result.maxRank}`;
        });
}
