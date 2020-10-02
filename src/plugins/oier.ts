import { App } from 'koishi-core';
import superagent from 'superagent';
import { take } from 'lodash';

const GENDER = {
    '-1': '女',
    0: '未知',
    1: '男',
};

export function apply(app: App) {
    app.command('oi', 'OI Related');

    app.command('oi/oier <query>', '查询oier', { minInterval: 30000, cost: 3 })
        .action(async (_, query) => {
            const res = await superagent.get(`https://bytew.net/OIer/search.php?method=normal&q=${encodeURIComponent(query)}`);
            const { result: results } = JSON.parse(res.text);
            let message = '';
            for (const result of take<any>(results, 3)) {
                const awards = JSON.parse(result.awards.replace(/'/gmi, '"'));
                message += `姓名：${result.name}  生理性别：${GENDER[result.sex]}\n`;
                for (const award of take<any>(awards, 5)) {
                    message += `于${award.grade}时在${award.province}${award.school}参加${award.identity}，`;
                    if (award.score) message += `以${award.score}的成绩`;
                    message += `取得${award.award_type}，排名${award.rank}。\n`;
                }
                if (awards.length > 5) message += `${awards.length - 5}个奖项被隐藏。\n`;
            }
            if (results.length > 3) message += `${results.length - 3}个搜索结果被隐藏。`;
            return message;
        });
}
