import { App, Session } from 'koishi-core';
import { Collection, ObjectID } from 'mongodb';
import moment from 'moment';

moment.locale('zh-cn');

interface Price {
    _id: number,
    price: number,
    expire: Date,
}

interface Stock {
    _id: ObjectID,
    userId: number,
    number: number,
    buyPrice: number,
    expire: Date,
}

interface Config {
    expireDays: number,
}

const defaultConfig = {
    expireDays: 7,
};

export const apply = (app: App, config: Config) => {
    config = { ...defaultConfig, ...config };

    app.on('connect', () => {
        const priceColl: Collection<Price> = app.database.db.collection('kabu.price');
        priceColl.createIndex('expire', { expireAfterSeconds: 0 });

        const stockColl: Collection<Stock> = app.database.db.collection('kabu.stock');
        stockColl.createIndex({ userId: 1, expire: 1 });
        stockColl.createIndex('expire', { expireAfterSeconds: 0 });

        async function priceToday(session: Session) {
            const res = await priceColl.findOne({ _id: session.userId });
            if (res) return res.price;
            const price = Math.floor(Math.random() < 0.5 ? 10 + Math.sqrt(Math.random() * 400) : 50 - Math.sqrt(Math.random() * 400));
            const expire = new Date();
            expire.setHours(23);
            expire.setMinutes(59);
            expire.setSeconds(59);
            await priceColl.insertOne({ _id: session.userId, price, expire });
            return price;
        }

        app.command('kabu.price', '查询今日大头菜价格')
            .shortcut('今日大头菜价格', { prefix: false })
            .action(async ({ session }) => {
                const price = await priceToday(session);
                return `现在的大头菜价格是每棵 ${price} 硬币！`;
            });

        app.command('kabu.query', '查询自己手上还没烂掉的大头菜')
            .shortcut('查询大头菜', { prefix: false })
            .userFields(['coin'])
            .action(async ({ session }) => {
                const [res, count] = await Promise.all([
                    stockColl.find({ userId: session.userId }).sort('expire', 1).limit(10).toArray(),
                    stockColl.find({ userId: session.userId }).count(),
                ]);
                if (res.length === 0) return '你现在手上还没有大头菜，要来买点吗？';
                let text = '';
                let sum = 0;
                for (const { number, buyPrice, expire } of res) {
                    sum += number;
                    text += `你有 ${number} 棵以 ${buyPrice} 个硬币每棵买入的大头菜，它们会在 ${moment(expire).toNow().replace('前', '后')} 烂掉。\n`;
                }
                if (count > res.length) text += `隐藏了 ${count - res.length} 个条目。`;
                if (!session.$user.coin) session.$user.coin = 0;
                text = `你现在共有 ${sum} 棵大头菜和 ${session.$user.coin} 个硬币。\n${text}`;
                return text;
            });

        app.command('kabu.buy [number]', '购买大头菜。若不指定数量则尽量多地购买。')
            .shortcut('购买大头菜', { prefix: false, fuzzy: true })
            .userFields(['coin'])
            .action(async ({ session }, arg) => {
                const price = await priceToday(session);
                if (!session.$user.coin) session.$user.coin = 0;
                const maxNumber = Math.floor(session.$user.coin / price);
                const number = +(arg ?? maxNumber);
                if (!Number.isInteger(number) || number <= 0 || number > maxNumber) {
                    return `购买数量需要是 1~${maxNumber} 之间的正整数。`;
                }
                const expire = moment();
                expire.add(config.expireDays, 'days');
                await stockColl.insertOne({
                    _id: new ObjectID(),
                    userId: session.userId,
                    number,
                    buyPrice: price,
                    expire: expire.toDate(),
                });
                session.$user.coin -= price * number;
                return `你花了 ${price * number} 个硬币以 ${price} 每棵的价格购买了 ${number} 棵大头菜。
要是你没有在 ${config.expireDays} 天内把大头菜卖掉，它们就会全部烂掉，害你大亏本！一定要注意这一点喔。`;
            });

        app.command('kabu.sell [number]', '卖出最早购买（最先烂掉）的大头菜。若不指定数量则全部卖出。')
            .shortcut('卖出大头菜', { prefix: false, fuzzy: true })
            .userFields(['coin'])
            .action(async ({ session }, arg) => {
                const sellNumber = +(arg ?? Infinity);
                if (!Number.isInteger(sellNumber) || sellNumber <= 0) return '卖出的数量需要是一个正整数';
                const res = await stockColl.find({ userId: session.userId }).sort({ expire: 1 }).toArray();
                let sum = 0;
                let update = null;
                const deleteIds = [];
                for (const item of res) {
                    if (sum + item.number <= sellNumber) {
                        sum += item.number;
                        deleteIds.push(item._id);
                    } else if (sum < sellNumber) {
                        update = { _id: item._id, newNumber: item.number - sellNumber - sum };
                        sum = sellNumber;
                        break;
                    }
                }
                if (sum === 0 || (sellNumber !== Infinity && sum !== sellNumber)) return '你没有足够多的大头菜来卖出！';
                const price = await priceToday(session);
                if (!session.$user.coin) session.$user.coin = 0;
                const gain = sum * price;
                session.$user.coin += gain;
                await Promise.all([
                    stockColl.deleteMany({ _id: { $in: deleteIds } }),
                    stockColl.updateOne(update._id, { $set: { number: update.newNumber } }),
                ]);
                return `你已成功卖出 ${sum} 棵大头菜，获得了 ${gain} 个硬币！`;
            });
    });

    app.command('kabu', '大头菜');
};
