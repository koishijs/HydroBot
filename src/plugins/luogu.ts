import axios from 'axios';

async function _luogu({ session }, id) {
    if (!id) return await session.$send('请输入要查询的题号！');
    let res;
    try {
        res = await axios({
            url: `https://www.luogu.com.cn/api/problem/detail/${id}`,
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; WOW64; Trident/7.0; rv:11.0) like Gecko',
                Accept: 'text/html, application/xhtml+xml, image/jxr, */*',
                'Accept-Language': 'zh-Hans-CN, zh-Hans; q=0.8, en-US; q=0.5, en; q=0.3',
                'Accept-Encoding': 'gzip, deflate',
            },
        });
    } catch (e) {
        return await session.$send('获取失败');
    }
    const p = res.data;
    if (p.status === 200) return await session.$send(`${p.data.StringPID} ${p.data.Name}\n${p.data.Description}`);
    return await session.$send(p.data);
}

export const apply = (app) => {
    app.command('luogu <id...>', '获取Luogu题目').action(_luogu);
};
