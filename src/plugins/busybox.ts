/* eslint-disable no-shadow */
/* eslint-disable no-return-assign */
import { cpus, totalmem, freemem } from 'os';
import child from 'child_process';
import {
    App, Group, getTargetId, Session, extendDatabase,
} from 'koishi-core';
import { Logger, CQCode, Time } from 'koishi-utils';
import { text2png } from '../lib/graph';
import MongoDatabase from '../lib/plugin-mongo';

const groupMap: Record<number, [Promise<string>, number]> = {};
const userMap: Record<number, [string | Promise<string>, number]> = {};

const RE_REPLY = /\[CQ:reply,id=([0-9\-]+)\]([\s\S]+)$/gmi;

async function getGroupName(session: Session) {
    if (session.messageType === 'private') return '私聊';
    const { groupId: id, $bot } = session;
    const timestamp = Date.now();
    if (!groupMap[id] || timestamp - groupMap[id][1] >= Time.hour) {
        const promise = $bot.getGroupInfo(id).then((d) => d.groupName, () => `${id}`);
        groupMap[id] = [promise, timestamp];
    }
    let output = await groupMap[id][0];
    if (output !== `${id}`) output += ` (${id})`;
    return output;
}

function getSenderName({ anonymous, sender, userId }: Session) {
    // eslint-disable-next-line no-return-assign
    return anonymous ? anonymous.name : (userMap[userId] = [sender.nickname, Date.now()])[0];
}

async function formatMessage(session: Session) {
    const codes = CQCode.parseAll(session.message);
    let output = '';
    for (const code of codes) {
        if (typeof code === 'string') {
            output += code;
        } else if (code.type === 'at') {
            if (code.data.qq === 'all') {
                output += '@全体成员';
            } else {
                const id = +code.data.qq;
                const timestamp = Date.now();
                if (!userMap[id] || timestamp - userMap[id][1] >= Time.hour) {
                    const promise = session.$bot
                        .getGroupMemberInfo(session.groupId, id)
                        .then((d) => d.nickname, () => `${id}`);
                    userMap[id] = [promise, timestamp];
                }
                // eslint-disable-next-line no-await-in-loop
                output += `@${await userMap[id][0]}`;
            }
        } else if (code.type === 'face') {
            output += `[face ${code.data.id}]`;
        } else if (code.type === 'image') {
            output += `[image ${(code.data.url as string).split('?')[0]}]`;
        } else if (code.type === 'reply') {
            output += `[reply ${code.data.id}]`;
        } else output += `[${code.type}]`;
    }
    return output;
}

declare module 'koishi-core/dist/server' {
    interface BotOptions {
        label?: string
    }
    interface Bot {
        counter: number[]
    }
}

declare module 'koishi-core/dist/database' {
    interface User {
        lastCall: Date
        coin: number,
    }
    interface Group {
        welcomeMsg: string
    }
    interface Database {
        getActiveData(): Promise<ActiveData>
    }
}

export interface ActiveData {
    activeUsers: number
    activeGroups: number
}

extendDatabase<typeof MongoDatabase>(MongoDatabase, {
    async getActiveData() {
        const $gt = new Date(new Date().getTime() - 1000 * 3600 * 24);
        const [activeGroups, activeUsers] = await Promise.all([
            this.group.find({ assignee: { $ne: null } }).count(),
            this.user.find({ lastCall: { $gt } }).count(),
        ]);
        return { activeGroups, activeUsers };
    },
});

function memoryRate() {
    const totalMemory = totalmem();
    return {
        app: process.memoryUsage().rss / totalMemory,
        total: 1 - freemem() / totalMemory,
    };
}

function getCpuUsage() {
    let totalIdle = 0;
    let totalTick = 0;
    const cpuInfo = cpus();
    const usage = process.cpuUsage().user;
    for (const cpu of cpuInfo) {
        for (const type in cpu.times) totalTick += cpu.times[type];
        totalIdle += cpu.times.idle;
    }
    return {
        app: usage / 1000,
        used: (totalTick - totalIdle) / cpuInfo.length,
        total: totalTick / cpuInfo.length,
    };
}

let usage = getCpuUsage();
let appRate: number;
let usedRate: number;

function updateCpuUsage() {
    const newUsage = getCpuUsage();
    const totalDifference = newUsage.total - usage.total;
    appRate = (newUsage.app - usage.app) / totalDifference;
    usedRate = (newUsage.used - usage.used) / totalDifference;
    usage = newUsage;
}

export interface Rate {
    app: number
    total: number
}

export interface Status extends ActiveData {
    bots: BotStatus[]
    memory: Rate
    cpu: Rate
    timestamp: number
}

export interface BotStatus {
    label?: string
    selfId: number
    code: number
    rate?: number
}

export enum StatusCode {
    GOOD,
    IDLE,
    CQ_ERROR,
    NET_ERROR,
}

let timer: NodeJS.Timeout;

export const apply = (app: App) => {
    const logger = Logger.create('message', true);
    Logger.levels.message = 3;

    let cachedStatus: Promise<Status>;
    let timestamp: number;

    async function _getStatus() {
        const [data, bots] = await Promise.all([
            app.database.getActiveData(),
            Promise.all(app.bots.map(async (bot): Promise<BotStatus> => ({
                selfId: bot.selfId,
                label: bot.label,
                code: await bot.getStatus(),
                rate: bot.counter.slice(1).reduce((prev, curr) => prev + curr, 0),
            }))),
        ]);
        const memory = memoryRate();
        const cpu = { app: appRate, total: usedRate };
        const status: Status = {
            ...data, bots, memory, cpu, timestamp,
        };
        return status;
    }

    async function getStatus(): Promise<Status> {
        const now = Date.now();
        if (now - timestamp < 60000) return cachedStatus;
        timestamp = now;
        return cachedStatus = _getStatus();
    }

    app.command('_', '', { authority: 5, hidden: true })
        .action(() => { });

    app.command('_.eval <expression...>', 'eval', { authority: 5 })
        .action(async ({ session }, args) => {
            // eslint-disable-next-line no-eval
            let res = eval(args);
            if (res instanceof Promise) res = await res;
            if (typeof res === 'string' || res instanceof Array) return await session.$send(res.toString());
            if (typeof res === 'object') return session.$send(JSON.stringify(res));
            if (typeof res === 'undefined') return session.$send('undefined');
            return session.$send(res.toString());
        });

    app.command('_.sh <command...>', '执行shell命令', { authority: 5 })
        .option('i', 'Output as image')
        .action(async ({ options }, cmd) => {
            let p: string;
            try {
                p = child.execSync(cmd).toString();
            } catch (e) {
                return `Error executing command: ${e}`;
            }
            if (!p.trim().length) return '(execute success)';
            if (!options.i) return p;
            const page = await app.getPage();
            const img = await text2png(page, p);
            app.freePage(page);
            return `[CQ:image,file=base64://${img}]`;
        });

    app.command('_.shutdown', '关闭机器人', { authority: 5 })
        .action(() => {
            setTimeout(() => {
                child.exec('pm2 stop robot');
                setTimeout(() => {
                    global.process.exit();
                }, 1000);
            }, 3000);
            return 'Exiting in 3 secs...';
        });

    app.command('_.restart', '重启机器人', { authority: 5 })
        .action(({ session }) => {
            setTimeout(() => {
                child.exec('pm2 restart robot');
            }, 3000);
            return session.$send('Restarting in 3 secs...');
        });

    app.command('_.leave', '退出该群', { authority: 5 })
        .action(({ session }) => session.$bot.setGroupLeave(session.groupId));

    app.command('_.setPriv <userId> <authority>', '设置用户权限', { authority: 5 })
        .action(async ({ session }, userId: string, authority: string) => {
            if (authority === 'null') {
                await app.database.setUser(getTargetId(userId), { flag: 1 });
                authority = '0';
            } else {
                await app.database.setUser(getTargetId(userId), { flag: 0 });
            }
            await session.$app.database.setUser(
                getTargetId(userId), { authority: parseInt(authority, 10) },
            );
            return `Set ${userId} to ${authority}`;
        });

    app.command('_.boardcast <message...>', '全服广播', { authority: 5 })
        .before((session) => !session.$app.database)
        .option('forced', '-f 无视 silent 标签进行广播', { value: false })
        .action(async ({ options, session }, message) => {
            if (!message) return '请输入要发送的文本。';
            let groups = await app.database.getAllGroups(['id', 'flag'], [session.selfId]);
            if (!options.forced) {
                groups = groups.filter((g) => !(g.flag & Group.Flag.silent));
            }
            groups.forEach((group) => {
                session.$bot.sendGroupMsg(group.id, message);
            });
        });

    app.command('_.deactivate', '在群内禁用', { authority: 4 })
        .groupFields(['flag'])
        .action(({ session }) => {
            session.$group.flag |= Group.Flag.ignore;
            return 'Deactivated';
        });

    app.command('_.activate', '在群内启用', { authority: 4 })
        .groupFields(['flag'])
        .action(({ session }) => {
            session.$group.flag &= ~Group.Flag.ignore;
            return 'Activated';
        });

    app.command('_.setWelcomeMsg <msg>', '设置欢迎信息', { authority: 4 })
        .action(({ session }, welcomeMsg) => {
            app.database.setGroup(session.groupId, { welcomeMsg });
            return 'Updated.';
        });

    app.command('_.mute <user> <periodSecs>', '禁言用户', { authority: 4 })
        .action(({ session }, user, secs = '600000') =>
            session.$bot.setGroupBan(session.groupId, getTargetId(user), parseInt(secs, 10)));

    app.command('status', '查看机器人运行状态', { hidden: true })
        .shortcut('你的状态', { prefix: true })
        .shortcut('你的状况', { prefix: true })
        .shortcut('运行情况', { prefix: true })
        .shortcut('运行状态', { prefix: true })
        .action(async () => {
            const {
                bots: apps, cpu, memory, activeUsers, activeGroups,
            } = await getStatus();
            const output = apps.map(({
                label, selfId, code, rate,
            }) => `${label || selfId}：${code ? '无法连接' : `工作中（${rate}/min）`}`);
            output.push('==========');
            output.push(
                `活跃用户数量：${activeUsers}`,
                `活跃群数量：${activeGroups}`,
                `CPU 使用率：${(cpu.app * 100).toFixed()}% / ${(cpu.total * 100).toFixed()}%`,
                `内存使用率：${(memory.app * 100).toFixed()}% / ${(memory.total * 100).toFixed()}%`,
            );
            return output.join('\n');
        });

    app.command('checkin', '签到', { maxUsage: 1 })
        .shortcut('签到', { prefix: true })
        .userFields(['coin'])
        .action(async ({ session }) => {
            const add = Math.floor(Math.random() * 10);
            if (!session.$user.coin) session.$user.coin = 0;
            session.$user.coin += add;
            return `签到成功，获得${add}个硬币（共有${session.$user.coin}个）`;
        });

    app.on('message', async (session) => {
        const groupName = await getGroupName(session);
        const senderName = getSenderName(session);
        const message = await formatMessage(session);
        logger.debug(`[${groupName}] ${senderName}: ${message}`);
        if (!session.groupId) return;
        if (session.message === '>_.activate') {
            const user = await app.database.getUser(session.userId);
            if (user.authority >= 4) {
                const group = await app.database.getGroup(session.groupId);
                const flag = group.flag & (~Group.Flag.ignore);
                await app.database.setGroup(session.groupId, { flag });
                await session.$send('Activated');
            }
        }
        if (!session.message.includes('[CQ:reply,id=')) return;
        const res = RE_REPLY.exec(session.message);
        if (!res) return;
        const [, id, msg] = res;
        if (msg.includes('!!recall')) {
            const user = await app.database.getUser(session.userId, ['authority']);
            if (user.authority >= 4) return session.$bot.deleteMsg(parseInt(id, 10));
        }
    });

    app.on('group-increase', async (session) => {
        const data = await session.$app.database.getGroup(session.groupId);
        console.log('Event.Group_Increase', data);
        if (data.welcomeMsg) {
            await session.$send(data.welcomeMsg.replace(/%@/gmi, `[CQ:at,qq=${session.userId}`));
        }
    });

    app.on('before-command', ({ session }) => {
        // @ts-expect-error
        session.$user.lastCall = new Date();
    });

    app.on('before-send', (session) => {
        const { counter } = app.bots[session.selfId];
        counter[0]++;
    });

    app.on('before-disconnect', () => {
        clearInterval(timer);
    });

    app.on('connect', async () => {
        Logger.lastTime = Date.now();
        await app.getSelfIds();
        app.bots.forEach((bot) => {
            bot.label = bot.label || `${bot.selfId}`;
            bot.counter = new Array(61).fill(0);
        });
        timer = setInterval(() => {
            updateCpuUsage();
            app.bots.forEach(({ counter }) => {
                counter.unshift(0);
                counter.splice(-1, 1);
            });
        }, 1000);
        app.api.get('/status', async (ctx) => {
            const status = await getStatus().catch<Status>((error) => {
                app.logger('status').warn(error);
                return null;
            });
            if (!status) return ctx.status = 500;
            ctx.set('Content-Type', 'application/json');
            ctx.set('Access-Control-Allow-Origin', '*');
            ctx.body = status;
        });
    });
};
