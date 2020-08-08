import superagent from 'superagent';
import { getTargetId, App } from 'koishi';

export const apply = (app: App) => {
    app.command('luogu', 'Luogu');

    app.command('luogu.problem <pid>', '获取Luogu题目')
        .action(async (_, id) => {
            const res = await superagent.get(`https://www.luogu.com.cn/api/problem/detail/${id}`)
                .set('User-Agent', 'Mozilla/5.0 (Windows NT 10.0; WOW64; Trident/7.0; rv:11.0) like Gecko');
            console.log(res);
            const p = res.body;
            if (p.status === 200) return `${p.data.StringPID} ${p.data.Name}\n${p.data.Description}`;
            return p.data;
        });

    app.command('luogu.user <uid>', '查询用户')
        .action(async (_, id) => {
            const uid = getTargetId(id);
            const res = await superagent.get(`https://www.luogu.com.cn/user/${uid}?_contentOnly=1`)
                .set('User-Agent', 'Mozilla/5.0 (Windows NT 10.0; WOW64; Trident/7.0; rv:11.0) like Gecko');
            if (res.body.code === '404') return '没这个人!';
            const udoc = res.body.currentData.user;
            const level = udoc.ccfLevel === 0
                ? '无/藏了以方便假'
                : udoc.ccfLevel;
            return `${udoc.name}
关注: ${udoc.followingCount}
粉丝: ${udoc.followerCount}
ACs/Submits: ${udoc.passedProblemCount}/${udoc.submittedProblemCount}
颜色: ${udoc.color}
CCF评级:${level}`;
        });
};
