const getFirstPinyin = (data) => (data.pinyin.split(/\s+/).shift() || '')
    .replace(/[āáǎà]/g, 'a').replace(/[ōóǒò]/g, 'o').replace(/[ēéěèê]/g, 'e')
    .replace(/[īíǐì]/g, 'i')
    .replace(/[ūúǔù]/g, 'u')
    .replace(/[ǖǘǚǜü]/g, 'v');
const getLastPinyin = (data) => (data.pinyin.split(/\s+/).pop() || '')
    .replace(/[āáǎà]/g, 'a').replace(/[ōóǒò]/g, 'o').replace(/[ēéěèê]/g, 'e')
    .replace(/[īíǐì]/g, 'i')
    .replace(/[ūúǔù]/g, 'u')
    .replace(/[ǖǘǚǜü]/g, 'v');
const fix = (data) => {
    if (data.word === '味同嚼蜡') data.pinyin = data.pinyin.replace('cù', 'là');
    if (data.word.endsWith('俩')) data.pinyin = data.pinyin.replace('liǎng', 'liǎ');
    data.pinyin = data.pinyin.replace(/yi([ēéěèêe])/g, 'y$1');
    return data;
};
const indexed = (json) => {
    const result = { firstPinyin: {}, lastPinyin: {}, word: {} };
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
        const newpinyins: Set<string> = new Set();
        pinyins.forEach((pinyin) => {
            for (const data of result.lastPinyin[pinyin] || []) {
                if (!data.level) {
                    data.level = level;
                    newpinyins.add(getFirstPinyin(data));
                }
            }
        });
        pinyins = newpinyins;
    }
    return result;
};
const db = indexed(require('../../database/yiGeDingLia.json'));

const handle = (input: string) => {
    const result = [];
    let data = db.word[input];
    while (data && data.level) {
        const { level } = data;
        result.push(data);
        if (level > 1) {
            const next = db.firstPinyin[getLastPinyin(data)];
            const filtered = next.filter((d) => d.level && d.level < level);
            data = filtered[Math.floor(Math.random() * filtered.length)];
        } else {
            result.push({ word: '一个顶俩', pinyin: 'yī gè dǐng liǎ' });
            return result;
        }
    }
    return result;
};

function _ygdl({ session }, args) {
    const d = handle(args);
    if (d.length) {
        const res = [];
        for (const i in d) res.push(d[i].word, ' ');
        return session.$send(res.join(''));
    }
}

export const apply = (app) => {
    app.command('成语接龙 <成语>', '成语接龙').action(_ygdl);
};
