import os from 'os';
import path from 'path';
import superagent from 'superagent';
import fs, { unlink } from 'fs-extra';
import { App } from 'koishi-core';
import { ObjectID } from 'mongodb';
import sharp from 'sharp';
import ffi from 'ffi-napi';
import { } from 'koishi-plugin-mongo';

interface Lib {
    MakePersonalCard: (args: string) => string,
    Sayobot_SetPath: (key: string, dir: string) => any,
}

const sayobot: Lib = ffi.Library(path.resolve(__dirname, 'sayobot'), {
    MakePersonalCard: ['string', ['string']],
    Sayobot_SetPath: ['string', ['string', 'string']],
});

const PNG_PATH = path.resolve(__dirname, 'png');
const FONT_PATH = path.resolve(__dirname, 'fonts');
const BACK_PATH = path.resolve(__dirname, 'png', 'stat');
const EDGE_PATH = path.resolve(__dirname, 'png', 'tk');
const AVATAR_PATH = path.resolve(__dirname, 'png', 'avatars');

sayobot.Sayobot_SetPath('png', PNG_PATH);
sayobot.Sayobot_SetPath('font', FONT_PATH);

interface GetUserResult {
    mode: number,
    username: string,
    count300: number,
    count100: number,
    count50: number,
    playcount: number,
    ranked_score: number,
    total_score: number,
    pp_rank: number,
    level: number, // double
    pp_raw: number, // double
    accuracy: number, // double
    count_rank_ss: number,
    count_rank_ssh: number,
    count_rank_s: number,
    count_rank_sh: number,
    count_rank_a: number,
    country: string,
    total_seconds_played: number,
    pp_country_rank: number,
}

interface ApiResult {
    mode: number,
    user_id: string, // int
    username: string, // string
    join_date: string, // datestr
    count300: string, // int
    count100: string, // int
    count50: string, // int
    playcount: string, // int
    ranked_score: string, // int
    total_score: string, // int
    pp_rank: string, // int
    level: string, // double
    pp_raw: string, // double
    accuracy: string, // double
    count_rank_ss: string // int
    count_rank_ssh: string // int
    count_rank_s: string // int
    count_rank_sh: string, // int
    count_rank_a: string, // int
    country: string,
    total_seconds_played: string, // int
    pp_country_rank: string // int
    events: any[],
}

interface HistoryColumn extends GetUserResult {
    _id?: ObjectID, // create time
    isAuto?: boolean,
}

interface UserInfo {
    _id: number,
    account: number,
    sign: string,
    nickname: string,
    Opacity: number,
    history: HistoryColumn[],
    // relative path
    ProfileEdge: string,
    DataEdge: string,
    SignEdge: string,
    ProfileFontColor: string,
    DataFontColor: string,
    SignFontColor: string,
    Background: string,
}
declare module 'koishi-core/dist/database' {
    interface Tables {
        osu: UserInfo
    }
}

const DefaultUserInfo: UserInfo = {
    _id: 123456,
    account: 0,
    sign: '无',
    nickname: 'Sayobot',
    Opacity: 50,
    history: [],
    ProfileEdge: 'adm0.png',
    DataEdge: 'adm1.png',
    SignEdge: 'adm1.png',
    ProfileFontColor: '#000000',
    DataFontColor: '#000000',
    SignFontColor: '#000000',
    Background: '1.png',
};

namespace Api {
    export const modes = {
        std: 0, taiko: 1, ctb: 2, mania: 3,
    };

    export async function getUserIDByNick(nickname: string) {
        const result = await superagent.get(`https://api.sayobot.cn/ppy/get_user?u=${nickname}&m=0`);
        if (result.status === 404) return '阁下，小夜找不到这个人呢';
        if (result.status !== 200) return `Status: ${result.status}`;
        if (!result.body.length) return '阁下，小夜找不到这个人呢';
        return parseInt(result.body[0].user_id, 10);
    }

    export async function getUser(uid: number, mode: number): Promise<GetUserResult | string> {
        const response = await superagent.get(`https://api.sayobot.cn/ppy/get_user?u=${uid}&m=${mode}`);
        if (response.status === 404) return '阁下，小夜找不到这个人呢';
        if (response.status !== 200) return `Status: ${response.status}`;
        if (!response.body.length) return '阁下，小夜找不到这个人呢';
        const t: ApiResult = response.body[0];
        const result: GetUserResult = {
            mode,
            username: t.username,
            count300: parseInt(t.count300, 10),
            count100: parseInt(t.count100, 10),
            count50: parseInt(t.count50, 10),
            playcount: parseInt(t.playcount, 10),
            ranked_score: parseInt(t.ranked_score, 10),
            total_score: parseInt(t.total_score, 10),
            pp_rank: parseInt(t.pp_rank, 10),
            level: parseFloat(t.level),
            pp_raw: parseFloat(t.pp_raw),
            accuracy: parseFloat(t.accuracy),
            count_rank_ss: parseInt(t.count_rank_ss, 10),
            count_rank_ssh: parseInt(t.count_rank_ssh, 10),
            count_rank_s: parseInt(t.count_rank_s, 10),
            count_rank_sh: parseInt(t.count_rank_sh, 10),
            count_rank_a: parseInt(t.count_rank_a, 10),
            country: t.country,
            total_seconds_played: parseInt(t.total_seconds_played, 10),
            pp_country_rank: parseInt(t.pp_country_rank, 10),
        };
        return result;
    }
}

export function apply(app: App) {
    app.command('osu', 'osu');

    app.on('connect', () => {
        const coll = app.database.collection('osu');

        function update(_id: number, $set: Partial<UserInfo>) {
            return coll.updateOne({ _id }, { $set });
        }

        app.command('osu.set <nickname>', 'Bind osu account')
            .shortcut('！set', { prefix: false, fuzzy: true })
            .shortcut('! set', { prefix: false, fuzzy: true })
            .shortcut('!set', { prefix: false, fuzzy: true })
            .userFields(['id'])
            .action(async ({ session }, nickname) => {
                const account = await Api.getUserIDByNick(nickname);
                if (typeof account === 'string') return account;
                await coll.updateOne(
                    { _id: session.$user.id },
                    { $set: { account, nickname } },
                    { upsert: true },
                );
                return '阁下绑定成功啦，发送指令!o就可以查看阁下的资料卡。还有其他指令阁下可以通过!help查看哦';
            });

        app.command('osu.unset', 'Unset')
            .shortcut('！unset', { prefix: false })
            .shortcut('! unset', { prefix: false })
            .shortcut('!unset', { prefix: false })
            .userFields(['id'])
            .action(async ({ session }) => {
                const result = await coll.deleteOne({ _id: session.$user.id });
                if (!result.deletedCount) return '阁下还没绑定哦';
                return '啊咧咧，，阁下你叫什么名字呀，突然不记得了，快用 !set 告诉我吧';
            });

        app.command('osu.updateSign <sign:text>', 'updatesign', { checkArgCount: false })
            .shortcut('！更新个签', { prefix: false, fuzzy: true })
            .shortcut('! 更新个签', { prefix: false, fuzzy: true })
            .shortcut('!更新个签', { prefix: false, fuzzy: true })
            .shortcut('！更换个签', { prefix: false, fuzzy: true })
            .shortcut('! 更换个签', { prefix: false, fuzzy: true })
            .shortcut('!更换个签', { prefix: false, fuzzy: true })
            .userFields(['id'])
            .action(async ({ session }, sign) => {
                if (!sign) return '更新个签有1个参数哦阁下';
                const userInfo = await coll.findOne({ _id: session.$user.id });
                if (!userInfo) return '阁下还没绑定哦，用set把阁下的名字告诉我吧';
                const res = await update(session.$user.id, { sign });
                return res.modifiedCount ? '更新成功' : '更新失败惹';
            });

        app.command('osu.updateEdge [arg0:number] [arg1:number]', 'updateedge')
            .shortcut('！更新框框', { prefix: false, fuzzy: true })
            .shortcut('! 更新框框', { prefix: false, fuzzy: true })
            .shortcut('!更新框框', { prefix: false, fuzzy: true })
            .shortcut('！更换框框', { prefix: false, fuzzy: true })
            .shortcut('! 更换框框', { prefix: false, fuzzy: true })
            .shortcut('!更换框框', { prefix: false, fuzzy: true })
            .userFields(['id'])
            .action(async ({ session }, arg0, arg1) => {
                const userInfo = await coll.findOne({ _id: session.$user.id });
                if (!userInfo) return '阁下还没绑定哦，用!set把阁下的名字告诉我吧';
                const fields = ['ProfileEdge', 'DataEdge', 'SignEdge'];
                const fontColors = ['ProfileFontColor', 'DataFontColor', 'SignFontColor'];
                if (!(arg0 && arg1)) return '更新框框有2个参数哦阁下';
                if (!(arg0 >= 0 && arg0 <= 2)) return '更新框框第1个参数是0-2的数字哦阁下';
                const filepath = path.join(EDGE_PATH, `${arg1 + arg0}.png`);
                if (!fs.existsSync(filepath)) return '没有这个框框哦阁下';
                const colorFile = path.join(EDGE_PATH, `${arg1}/0.col`);
                let color: string;
                if (fs.existsSync(colorFile)) {
                    color = `#${fs.readFileSync(colorFile).toString()}`;
                } else color = '#000000';
                const result = await update(session.$user.id, { [fontColors[arg0]]: color, [fields[arg0]]: `${arg1 + arg0}.png` });
                if (result.modifiedCount) return '更新成功';
                return '更新失败惹';
            });

        app.command('osu.updateBackground [arg0]', 'updateback', { checkArgCount: false })
            .shortcut('！更新背景', { prefix: false, fuzzy: true })
            .shortcut('! 更新背景', { prefix: false, fuzzy: true })
            .shortcut('!更新背景', { prefix: false, fuzzy: true })
            .shortcut('！更换背景', { prefix: false, fuzzy: true })
            .shortcut('! 更换背景', { prefix: false, fuzzy: true })
            .shortcut('!更换背景', { prefix: false, fuzzy: true })
            .userFields(['id'])
            .action(async ({ session }, arg0) => {
                const userInfo = await coll.findOne({ _id: session.$user.id });
                if (!userInfo) return '阁下还没绑定哦，用!set把阁下的名字告诉我吧';
                if (!arg0) return '更换背景有1个参数哦阁下';
                const filename = path.resolve(BACK_PATH, `${arg0}.png`);
                if (!fs.existsSync(filename)) return '没有这个背景哦阁下';
                const result = await update(session.$user.id, { Background: `${arg0}.png` });
                if (result.modifiedCount) return '更新成功';
                return '更新失败惹';
            });

        app.command('osu.updateOpacity [arg0:number]', '更改透明度', { checkArgCount: false })
            .userFields(['id'])
            .action(async ({ session }, opacity) => {
                const userInfo = await coll.findOne({ _id: session.$user.id });
                if (!userInfo) return '阁下还没绑定哦，用!set把阁下的名字告诉我吧';
                if (!opacity) return '更改透明度有1个参数哦阁下';
                if (Number.isNaN(opacity) || opacity % 5) return '更改透明度第1个参数是0-100以内可被5整除的数字哦阁下';
                await update(session.$user.id, { Opacity: opacity });
                return '更新成功';
            });

        app.command('osu.updateGravatar', '刷新头像缓存')
            .userFields(['id'])
            .action(async ({ session }) => {
                const userInfo = await coll.findOne({ _id: session.$user.id });
                if (!userInfo) return '阁下还没绑定哦，用!set把阁下的名字告诉我吧';
                const w = fs.createWriteStream(path.join(AVATAR_PATH, `${userInfo.account}.png`));
                superagent.get(`https://a.ppy.sh/${userInfo.account}`).pipe(w);
                return '更新头像完成，如果阁下的头像还是没有更新，等一会再试试吧';
            });

        app.command('osu.fetch', 'Fetch data', { authority: 4 })
            .action(async () => {
                let message = '';
                const start = new Date().getTime();
                const [count, users] = await Promise.all([
                    coll.find().count(),
                    coll.find().toArray(),
                ]);
                let api = 0;
                for (const user of users) {
                    if (!user.history) continue;
                    const modes = Array.from(new Set(user.history.map((i) => i.mode)));
                    for (const mode of modes) {
                        const search = new Date().getTime() - 3600 * 24 * 1000;
                        const item = user.history[user.history.length - 1];
                        if (item._id.generationTime * 1000 > search && item.mode === mode) continue;
                        // eslint-disable-next-line no-await-in-loop
                        const current = await Api.getUser(user.account, mode);
                        api++;
                        if (typeof current === 'string') message += `Error ${user._id} ${current}\n`;
                        // eslint-disable-next-line no-await-in-loop
                        else await coll.updateOne({ _id: user._id }, { $push: { history: { ...current, isAuto: true, _id: new ObjectID() } } });
                    }
                }
                const duration = new Date().getTime() - start;
                return `更新了${count}条数据，执行了${api}条查询，耗时${Math.floor(duration / 1000)}秒\n${message}`;
            });

        app.command('osu.stat [userId] [day]', '', { minInterval: 5000 })
            .option('mode', '-m <mode>', { value: 'std' })
            .shortcut('！o', { prefix: false, fuzzy: true, options: { mode: 'std' } })
            .shortcut('!o', { prefix: false, fuzzy: true, options: { mode: 'std' } })
            .shortcut('！t', { prefix: false, fuzzy: true, options: { mode: 'taiko' } })
            .shortcut('!t', { prefix: false, fuzzy: true, options: { mode: 'taiko' } })
            .shortcut('！c', { prefix: false, fuzzy: true, options: { mode: 'ctb' } })
            .shortcut('!c', { prefix: false, fuzzy: true, options: { mode: 'ctb' } })
            .shortcut('！m', { prefix: false, fuzzy: true, options: { mode: 'mania' } })
            .shortcut('!m', { prefix: false, fuzzy: true, options: { mode: 'mania' } })
            .userFields(['id'])
            .action(async ({ session, options }, _userId, _day) => {
                console.time('api');
                let day = 0;
                let isSelf = false;
                let userId: number;
                if (!_userId) {
                    userId = session.$user.id;
                    isSelf = true;
                } else if (_userId.startsWith('#')) {
                    userId = session.$user.id;
                    isSelf = true;
                    day = parseInt(_userId.split('#')[1], 10);
                } else {
                    userId = +_userId;
                    isSelf = false;
                    if (_day) day = parseInt(_day.split('#')[1], 10);
                }
                if (Number.isNaN(day)) return '天数必须是数字哦';
                let image = path.resolve(os.tmpdir(), `${new ObjectID().toHexString()}.png`);
                if (Api.modes[options.mode] === undefined) return '未知的模式';
                let userInfo = await coll.findOne({ _id: userId });
                if (!userInfo) return isSelf ? '阁下还没绑定哦，用!set把阁下的名字告诉我吧' : '小夜还不认识这个人哦，阁下把他介绍给我吧';
                userInfo = { ...DefaultUserInfo, ...userInfo };
                if (!fs.existsSync(path.join(AVATAR_PATH, `${userInfo.account}.png`))) {
                    const result = await superagent.get(`https://a.ppy.sh/${userInfo.account}`).catch(() => { });
                    if (result && result.text) {
                        fs.writeFileSync(path.join(AVATAR_PATH, `${userInfo.account}.png`), result.text);
                    }
                }
                const current = await Api.getUser(userInfo.account, Api.modes[options.mode]);
                console.timeEnd('api');
                console.time('image');
                if (typeof current === 'string') return current;
                if (day) {
                    let found: HistoryColumn;
                    const search = new Date().getTime() - day * 3600 * 24 * 1000;
                    for (let i = userInfo.history.length - 1; i >= 0; i--) {
                        const item = userInfo.history[i];
                        if (item._id.generationTime * 1000 < search && item.mode === Api.modes[options.mode]) {
                            found = item;
                            break;
                        }
                    }
                    if (!found) return `小夜没有查到${isSelf ? '阁下' : '这个人'}${day}天前的信息`;
                    if (!found.playcount) return `${isSelf ? '阁下' : '这个人'}还没有玩过这个模式哦，赶紧去试试吧`;
                    await coll.updateOne({ _id: userId }, { $push: { history: { ...current, _id: new ObjectID() } } });
                    const currentTotal = current.count300 + current.count100 + current.count50;
                    const foundTotal = found.count300 + found.count100 + found.count50;
                    const result = sayobot.MakePersonalCard(
                        [
                            userInfo.DataFontColor, userInfo.ProfileFontColor, userInfo.SignFontColor,
                            Api.modes[options.mode], userInfo.account, current.country, current.username, userId.toString(),
                            userInfo.sign, userInfo.Background, userInfo.ProfileEdge, userInfo.DataEdge, userInfo.SignEdge,
                            userInfo.Opacity, current.count300, current.count100, current.count50, current.playcount,
                            current.total_score, current.ranked_score, currentTotal, current.pp_raw, current.pp_country_rank,
                            current.pp_rank, current.count_rank_ssh, current.count_rank_ss, current.count_rank_sh, current.count_rank_s,
                            current.count_rank_a, current.total_seconds_played, current.level, current.accuracy, found.total_score,
                            found.ranked_score, foundTotal, found.accuracy, found.pp_raw, found.level,
                            found.pp_rank, found.pp_country_rank, found.playcount, found.count_rank_ssh, found.count_rank_ss,
                            found.count_rank_sh, found.count_rank_s, found.count_rank_a, day, image,
                        ].join('\n'),
                    );
                    if (result) return result;
                } else {
                    const currentTotal = current.count300 + current.count100 + current.count50;
                    let found: HistoryColumn = current;
                    for (let i = userInfo.history.length - 1; i >= 0; i--) {
                        const item = userInfo.history[i];
                        if (item.mode === Api.modes[options.mode] && !item.isAuto) {
                            found = item;
                            break;
                        }
                    }
                    await coll.updateOne({ _id: userId }, { $push: { history: { ...current, _id: new ObjectID() } } });
                    const foundTotal = found.count300 + found.count100 + found.count50;
                    const result = sayobot.MakePersonalCard(
                        [
                            userInfo.DataFontColor, userInfo.ProfileFontColor, userInfo.SignFontColor,
                            Api.modes[options.mode], userInfo.account, current.country, current.username, userId.toString(),
                            userInfo.sign, userInfo.Background, userInfo.ProfileEdge, userInfo.DataEdge, userInfo.SignEdge,
                            userInfo.Opacity, current.count300, current.count100, current.count50, current.playcount,
                            current.total_score, current.ranked_score, currentTotal, current.pp_raw, current.pp_country_rank,
                            current.pp_rank, current.count_rank_ssh, current.count_rank_ss, current.count_rank_sh, current.count_rank_s,
                            current.count_rank_a, current.total_seconds_played, current.level, current.accuracy, found.total_score,
                            found.ranked_score, foundTotal, found.accuracy, found.pp_raw, found.level,
                            found.pp_rank, found.pp_country_rank, found.playcount, found.count_rank_ssh, found.count_rank_ss,
                            found.count_rank_sh, found.count_rank_s, found.count_rank_a, day, image,
                        ].join('\n'),
                    );
                    if (result) return result;
                }
                console.timeEnd('image');
                console.time('compress');
                if (fs.existsSync(image)) {
                    await sharp(image).jpeg({ quality: 80 }).toFile(`${image}.jpg`);
                    await unlink(image);
                    image += '.jpg';
                }
                console.timeEnd('compress');
                await session.send(`[CQ:image,file=file://${image}]`);
                await unlink(image);
            });

        app.command('osu.help [category]', 'Get help')
            .shortcut('！help', { prefix: false, fuzzy: true })
            .shortcut('! help', { prefix: false, fuzzy: true })
            .shortcut('!help', { prefix: false, fuzzy: true })
            .action(async (_, category) => {
                if (!category) return `[CQ:image,file=file://${path.resolve(__dirname, 'png', 'help', 'Sayobot help.png')}]`;
                if (!['框框', '背景', '个签', '大括号'].includes(category)) return '没有这个帮助的图片哦';
                return `[CQ:image,file=file://${path.resolve(__dirname, 'png', 'help', `help-${category}.png`)}]`;
            });

        app.command('osu.download', '?', { hidden: true })
            .action(() => `Welcome to OSU! 点击下载osu客户端
https://dl.sayobot.cn/osu.zip
点击打开OSU地图镜像站 https://osu.sayobot.cn
点击在线游玩 http://game.osu.sh`);

        app.on('message', async (session) => {
            if (session.content.startsWith('https://osu.ppy.sh/')) {
                return session.send(`点击链接下载此图 https://osu.sayobot.cn/?search=${session.content.split('beatmapsets/')[1].split('#')[0]}`);
            }
        });
    });
}
