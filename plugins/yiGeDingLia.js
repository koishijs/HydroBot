const getFirstPinyin = data => {
    return (data.pinyin.split(/\s+/).shift() || '')
        .replace(/[āáǎà]/g, 'a').replace(/[ōóǒò]/g, 'o').replace(/[ēéěèê]/g, 'e')
        .replace(/[īíǐì]/g, 'i').replace(/[ūúǔù]/g, 'u').replace(/[ǖǘǚǜü]/g, 'v');
};
const getLastPinyin = data => {
    return (data.pinyin.split(/\s+/).pop() || '')
        .replace(/[āáǎà]/g, 'a').replace(/[ōóǒò]/g, 'o').replace(/[ēéěèê]/g, 'e')
        .replace(/[īíǐì]/g, 'i').replace(/[ūúǔù]/g, 'u').replace(/[ǖǘǚǜü]/g, 'v');
};
const fix = data => {
    if ('味同嚼蜡' === data.word)
        data.pinyin = data.pinyin.replace('cù', 'là');
    if (data.word.endsWith('俩'))
        data.pinyin = data.pinyin.replace('liǎng', 'liǎ');
    data.pinyin = data.pinyin.replace(/yi([ēéěèêe])/g, 'y$1');
    return data;
};
const indexed = json => {
    let result = { firstPinyin: {}, lastPinyin: {}, word: {} };
    for (const data of json) {
        fix(data);
        if (data.word.length === 4) {
            const key1 = getLastPinyin(data);
            const values1 = result.lastPinyin[key1] || [];
            result.lastPinyin[key1] = values1;
            values1.push(data);
            const key2 = getFirstPinyin(data);
            const values2 = result.firstPinyin[key2] || [];
            result.firstPinyin[key2] = values2;
            values2.push(data);
            result.word[data.word] = data;
        }
    }
    let pinyins = new Set(['yi']);
    for (let level = 1; pinyins.size > 0; ++level) {
        const newpinyins = new Set();
        pinyins.forEach(pinyin => {
            for (const data of result.lastPinyin[pinyin] || [])
                if (!data.level) {
                    data.level = level;
                    newpinyins.add(getFirstPinyin(data));
                }
        });
        console.log(`Generate ${newpinyins.size} entries for level ${level}`);
        pinyins = newpinyins;
    }
    return result;
};
const handle = input => {
    let result = [];
    let data = db.word[input];
    while (data && data.level) {
        const level = data.level;
        result.push(data);
        if (level > 1) {
            const next = db.firstPinyin[getLastPinyin(data)];
            const filtered = next.filter(d => d.level && d.level < level);
            data = filtered[Math.floor(Math.random() * filtered.length)];
        } else {
            result.push({ word: '一个顶俩', pinyin: 'yī gè dǐng liǎ' });
            return result;
        }
    }
    return result;
};
const db = indexed(require('../database/yiGeDingLia.json'));
const reg = /^(一个顶俩|成语接龙)>(.*)/i;
exports.info = {
    id: 'yiGeDingLia',
    author: 'masnn',
    hidden: false,
    contacts: {
        email: 'masnn0@outlook.com',
        github: 'https://github.com/masnn/'
    },
    description: '一个顶俩',
    usage: '一个顶俩>成语'
};
exports.message = async (e, context) => {
    if (!reg.test(context.raw_message)) return;
    let tmp = reg.exec(context.raw_message);
    let d = await handle(tmp[2]);
    if (d) {
        let res = [];
        for (let i in d) res.push(d[i].word, ' ');
        return res;
    }
};
