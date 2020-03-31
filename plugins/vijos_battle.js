// eslint-disable
'use strict';
const
    { CQAt } = require('cq-websocket'),
    baseURL = 'https://vijos.org',
    RE_BIO = /<div class="section__body typo">([\s\S]*)<\/div>/i,
    axios = require('axios'),
    random = () => (Math.floor(Math.random() * 900000) + 100000),
    _ = require('lodash');

let log = null, coll = null, coll_battle = null;
exports.init = item => {
    if (!item.db) throw new Error('This plugin require MongoDB!');
    coll = item.db.collection('vijos_battle_user');
    coll_battle = item.db.collection('vijos_battle_battle');
    log = item.log;
};
exports.info = {
    id: 'vijos_battle',
    author: 'masnn',
    hidden: false,
    contacts: {
        email: 'masnn0@outlook.com',
        github: 'https://github.com/masnn/'
    },
    description: 'Vijos对战系统',
    usage: `Vijos对战
\\vj bind (uid) 绑定账号
\\vj unbind 解绑账号
\\vj challenge 发起挑战
\\vj join (tid) 加入挑战
\\vj leave 退出挑战
\\vj submit (tid) 刷新挑战结果`
};

async function bind(uid, e, context) {
    let qq = context.userId.toString();
    if (parseInt(uid) == NaN) return '请输入正确的UID！';
    let tgt = await coll.findOne({ uid, bind: true });
    if (tgt) return `错误：这个账户已被QQ：${tgt.qq} 绑定。`;
    let res = await coll.findOne({ qq });
    if (res && res.uid == uid) {
        let rs;
        try {
            rs = await axios.get(`${baseURL}/user/${uid}`);
        } catch (e) {
            return '用户不存在！';
        }
        let r = RE_BIO.exec(rs.data);
        if (r[1].includes(res.code)) {
            await coll.findOneAndUpdate({ qq, uid }, { $set: { bind: true } });
            return '绑定成功';
        } else
            return '绑定失败';
    } else if (res) {
        let code = random();
        await coll.findOneAndUpdate({ qq }, { $set: { code, uid, bind: false } });
        return `请将账户的个人简介改为 ${code} 后再次进行验证。`;
    } else {
        let code = random();
        await coll.insertOne({ qq, uid, code, bind: false });
        return `请将账户的个人简介改为 ${code} 后再次进行验证。`;
    }
}
async function unbind(e, context) {
    let qq = context.userId.toString();
    let res = await coll.findOne({ qq, bind: true });
    if (!res) return '您没有绑定任何账号';
    await coll.deleteMany({ qq: context.userId.toString() });
    return '解绑成功';
}
async function challenge_create(e, context) {
    let qq = context.userId.toString();
    let from = await coll.findOne({ qq, bind: true });
    if (!from) return '请先绑定账号！';
    if (from.in_battle) return '请先完成之前的对战！';
    let id = random();
    await coll_battle.insertOne({ status: 'Waiting', from: qq, id });
    return `已创建对战。等待其他玩家加入。使用\\vj join ${id}可加入对战。`;
}
async function challenge_join(id, e, context) {
    let qq = context.userId.toString();
    let to = await coll.findOne({ qq, bind: true });
    if (!to) return '请先绑定账号！';
    if (to.in_battle) return '请先完成之前的对战！';
    id = parseInt(id);
    let res = await coll_battle.findOne({ status: 'Waiting', id });
    if (!res) return '此对战不存在或已经开始！';
    if (res.from == qq) return '您无需手动加入您创建的对战。';
    let pid = await axios.get(`${baseURL}/p/random`);
    pid = pid.data.pid.toString();
    await coll_battle.findOneAndUpdate({ status: 'Waiting', id }, { $set: { status: 'Running', to: qq, pid } });
    return [
        new CQAt(parseInt(res.from)), new CQAt(context.userId),
        '对战开始，请完成 ', `${baseURL}/p/${pid}`,
        `完成后请使用\\vj submit ${id}提交结果。`
    ];
}
async function submit(id, e, context) {
    let qq = context.userId.toString();
    let from = await coll.findOne({ qq, bind: true });
    if (!from) return '请先绑定账号！';
    id = parseInt(id);
    let res = await coll_battle.findOne({ status: 'Running', id });
    if (!res) return '对战不存在！';
    if (!(res.from == qq || res.to == qq)) return '您不在本局对战中！';
    let status = await axios.get(`${baseURL}/records?uid_or_name=${from.uid}&pid=${res.pid}&tid=`);
    if (status.data.includes('record-status--text pass')) {
        await coll_battle.findOneAndUpdate({ id, status: 'Running' }, { $set: { status: 'Finished', winner: qq } });
        await coll.findOneAndUpdate({ qq }, { $set: { in_battle: false }, $inc: { wins: 1 } }, { upsert: true });
        return [
            new CQAt(parseInt(res.from)), new CQAt(parseInt(res.to)),
            '对战结束，', new CQAt(parseInt(qq)),
            '赢得了胜利！'
        ];
    }
    return '你并没有AC这道题！';
}
async function challenge_leave(e, context) {
    let qq = context.userId.toString();
    await coll_battle.deleteMany({ from: qq });
    await coll_battle.deleteMany({ to: qq });
    await coll.findOneAndUpdate({ qq }, { $set: { in_battle: false } });
    return '已为您退出所有对战！';
}
async function list(e, context) {
    let running = await coll_battle.find({ status: 'Running' }).toArray();
    let waiting = await coll_battle.find({ status: 'Waiting' }).toArray();
    return [
        '进行中的对战：\n',
        running.join('\n'),
        '等待加入的对战：\n',
        waiting.join('\n')
    ];
}
exports.message = async (e, context) => {
    if (!context.raw_message.startsWith('\\vj ')) return;
    let ops = context.raw_message.split(' ');
    try {
        switch (ops[1]) {
        case 'bind': return await bind(ops[2], e, context);
        case 'unbind': return await unbind(e, context);
        case 'challenge': return await challenge_create(e, context);
        case 'join': return await challenge_join(ops[2], e, context);
        case 'leave': return await challenge_leave(e, context);
        case 'submit': return await submit(ops[2], e, context);
        case 'list': return await list(e, context);
        }
    } catch (e) {
        return e.message + '\n' + e.stack;
    }
};
