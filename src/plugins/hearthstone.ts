/* eslint-disable global-require */
import path from 'path';
import superagent from 'superagent';
import { writeFile } from 'fs-extra';
import { App } from 'koishi-core';

const db = {};

try {
    // eslint-disable-next-line import/no-unresolved
    const c = require('../../.cache/hs_card_zhCN.json');
    for (const card of c) {
        db[card.id] = card.id;
        db[card.name] = card.id;
    }
} catch (e) {
    // Ignore
}

try {
    // eslint-disable-next-line import/no-unresolved
    const c = require('../../.cache/hs_card_enUS.json');
    for (const card of c) {
        db[card.name] = card.id;
    }
} catch (e) {
    // Ignore
}

async function _card({ session }, id) {
    const url = id.trim();
    if (!url) return await session.$send('请输入要查看的Card ID/Name');
    if (!Object.keys(db).length) {
        // Load CN
        const res = await superagent.get('https://api.hearthstonejson.com/v1/latest/zhCN/cards.collectible.json');
        await writeFile(path.resolve(__dirname, '..', '..', '.cache', 'hs_card_zhCN.json'), JSON.stringify(res.body));
        for (const card of res.body) {
            db[card.id] = card.id;
            db[card.name] = card.id;
        }
        // Load EN
        const re = await superagent.get('https://api.hearthstonejson.com/v1/latest/enUS/cards.collectible.json');
        await writeFile(path.resolve(__dirname, '..', '..', '.cache', 'hs_card_enUS.json'), JSON.stringify(re.body));
        for (const card of re.body) {
            db[card.name] = card.id;
        }
    }
    if (!db[id]) return await session.$send('NotFound');
    return session.$send(`[CQ:image,file=https://art.hearthstonejson.com/v1/render/latest/zhCN/512x/${db[id]}.png]`);
}

export const apply = (app: App) => {
    app.command('card <name/id...>', 'Get a card').action(_card);
};
