/* eslint-disable no-await-in-loop */
import child from 'child_process';
import { inspect } from 'util';
import {
    Group, getTargetId, User, Context,
} from 'koishi-core';
import { Session } from 'koishi-core/dist/session';
import { Logger, CQCode, Time } from 'koishi-utils';
import { Collection, ObjectID } from 'mongodb';
import { Dictionary } from 'lodash';
import { GroupMemberInfo } from 'koishi-adapter-cqhttp';
import { text2png } from '../lib/graph';

declare module 'koishi-core/dist/database' {
    interface Group {
        disallowedCommands: string[]
    }
}

declare module 'koishi-core/dist/command' {
    interface CommandConfig {
        noRedirect?: boolean,
    }
}

interface Message {
    _id: ObjectID,
    time: Date,
    message: string,
    sender: number,
    group: number,
}

Group.extend(() => ({
    disallowedCommands: [],
}));

const groupMap: Record<number, [Promise<string>, number]> = {};
const userMap: Record<number, [string | Promise<string>, number]> = {};
const RE_REPLY = /\[CQ:reply,id=([0-9-]+)\]([\s\S]+)$/gmi;

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

declare module 'koishi-core/dist/database' {
    interface Group {
        welcomeMsg: string
    }
}

const checkGroupAdmin = (session: Session<'authority'>) => (
    (session.$user.authority >= 4 || ['admin', 'owner'].includes(session.sender.role))
        ? false
        : '仅管理员可执行该操作。'
);

interface Config {
    recordMessage?: boolean,
    timezoneOffset?: number,
}

export const apply = (ctx: Context, config: Config = {}) => {
    const logger = new Logger('busybox', true);
    Logger.levels.message = 3;

    Time.setTimezoneOffset(config.timezoneOffset ?? -480); // UTC +8
    config.recordMessage = config.recordMessage ?? true;

    ctx.command('help', { authority: 1, hidden: true });
    ctx.command('tex', { authority: 1 });
    ctx.command('_', '管理工具');

    ctx.command('_.echo <msg...>', 'echo', { noRedirect: true, authority: 3 })
        .action((_, msg) => msg.decode());

    ctx.command('_.eval <expr...>', { authority: 5, noRedirect: true })
        .option('i', 'Output as image')
        .action(async ({ options }, input) => {
            let res: any;
            const expr = `\
(async function f(){
    return ${input.decode()}
})()`;
            try {
                // eslint-disable-next-line no-eval
                res = await eval(expr);
            } catch (e) {
                res = e;
            }
            const output = inspect(res, false, 3);
            if (!options.i) return output;
            const page = await ctx.app.browser.newPage();
            const img = await text2png(page, output);
            page.close();
            return `[CQ:image,file=base64://${img}]`;
        });

    ctx.command('_.sh <command...>', '执行shell命令', { authority: 5, noRedirect: true })
        .option('i', 'Output as image')
        .action(async ({ options }, cmd) => {
            let p: string;
            try {
                p = await new Promise((resolve, reject) => {
                    child.exec(cmd.decode(), (err, stdout, stderr) => {
                        if (err) reject(err);
                        resolve(stdout + stderr);
                    });
                });
            } catch (e) {
                return `Error executing command: ${e}`;
            }
            if (!p.trim().length) return '(execute success)';
            if (!options.i) return p;
            const page = await ctx.app.browser.newPage();
            const img = await text2png(page, p);
            page.close();
            return `[CQ:image,file=base64://${img}]`;
        });

    ctx.command('_.shutdown', '关闭机器人', { authority: 5, noRedirect: true })
        .action(() => {
            setTimeout(() => {
                if (process.env.pm_id) child.exec(`pm2 stop ${process.env.pm_id}`);
                else process.exit(0);
            }, 3000);
            return 'Exiting in 3 secs...';
        });

    ctx.command('_.restart', '重启机器人', { authority: 5, noRedirect: true })
        .action(() => {
            if (!process.env.pm_id) return 'Cannot restart: not pm2 environment';
            setTimeout(() => {
                child.exec(`pm2 restart ${process.env.pm_id}`);
            }, 3000);
            return 'Restarting in 3 secs...';
        });

    ctx.command('_.leave', '退出该群', { noRedirect: true })
        .userFields(['authority'])
        .before(checkGroupAdmin)
        .action(async ({ session }) => {
            await session.$bot.setGroupLeave(session.groupId);
        });

    ctx.command('_.setPriv <userId> <authority>', '设置用户权限', { authority: 5, noRedirect: true })
        .action(async ({ session }, userId, authority) => {
            if (authority === 'null') {
                await ctx.database.setUser(getTargetId(userId), { flag: 1 });
                authority = '0';
            } else {
                await ctx.database.setUser(getTargetId(userId), { flag: 0 });
            }
            await session.$app.database.setUser(
                getTargetId(userId), { authority: parseInt(authority, 10) },
            );
            return `Set ${userId} to ${authority}`;
        });

    ctx.command('_.boardcast <message...>', '全服广播', { authority: 5, noRedirect: true })
        .option('forced', '-f 无视 silent 标签进行广播')
        .action(async ({ options, session }, message) => {
            if (!message) return '请输入要发送的文本。';
            let groups = await ctx.database.getAllGroups(['id', 'flag'], [session.selfId]);
            if (!options.forced) {
                groups = groups.filter((g) => !(g.flag & Group.Flag.silent));
            }
            groups.forEach((group) => {
                session.$bot.sendGroupMsg(group.id, message);
            });
        });

    ctx.command('contextify <command...>', '在特定上下文中触发指令', { authority: 4, noRedirect: true })
        .alias('ctxf')
        .userFields(['authority'])
        .option('user', '-u [id]  使用私聊上下文', { authority: 5 })
        .option('group', '-g [id]  使用群聊上下文', { authority: 5 })
        .option('member', '-m [id]  使用当前群/讨论组成员上下文')
        .option('type', '-t [type]  确定发送信息的子类型')
        .usage([
            '私聊的子类型包括 other（默认），friend，group。',
            '群聊的子类型包括 normal（默认），notice，anonymous。',
        ].join('\n'))
        .action(async ({ session, options }, message) => {
            if (!message) return '请输入要触发的指令。';
            if (options.member) {
                if (session.messageType === 'private') {
                    return '无法在私聊上下文使用 --member 选项。';
                }
                options.group = session.groupId;
                options.user = options.member;
            }
            if (!options.user && !options.group) return '请提供新的上下文。';
            const newSession = new Session(ctx.app, session);
            newSession.$send = session.$send.bind(session);
            newSession.$sendQueued = session.$sendQueued.bind(session);
            delete newSession.groupId;
            if (options.group) {
                newSession.groupId = +options.group;
                newSession.messageType = 'group';
                newSession.subType = options.type || 'normal';
                delete newSession.$group;
                await newSession.$observeGroup(Group.fields);
            } else {
                newSession.messageType = 'private';
                newSession.subType = options.type || 'other';
            }
            if (options.user) {
                const id = getTargetId(options.user);
                if (!id) return '未指定目标。';
                newSession.userId = id;
                newSession.sender.userId = id;
                delete newSession.$user;
                const user = await newSession.$observeUser(User.fields);
                if (session.$user.authority <= user.authority) return '权限不足。';
            }
            if (options.group) {
                const info = await session.$bot.getGroupMemberInfo(newSession.groupId, newSession.userId).catch(() => ({}));
                Object.assign(newSession.sender, info);
            } else if (options.user) {
                const info = await session.$bot.getStrangerInfo(newSession.userId).catch(() => ({}));
                Object.assign(newSession.sender, info);
            }
            return newSession.$execute(message);
        });

    ctx.command('_.deactivate', '在群内禁用', { noRedirect: true })
        .userFields(['authority'])
        .before(checkGroupAdmin)
        .groupFields(['flag'])
        .action(({ session }) => {
            session.$group.flag |= Group.Flag.ignore;
            return 'Deactivated';
        });

    ctx.command('_.activate', '在群内启用', { noRedirect: true })
        .userFields(['authority'])
        .before(checkGroupAdmin)
        .groupFields(['flag'])
        .action(({ session }) => {
            session.$group.flag &= ~Group.Flag.ignore;
            return 'Activated';
        });

    ctx.command('_.setWelcomeMsg <...msg>', '设置欢迎信息', { noRedirect: true })
        .userFields(['authority'])
        .before(checkGroupAdmin)
        .groupFields(['welcomeMsg'])
        .action(({ session }, welcomeMsg) => {
            session.$group.welcomeMsg = welcomeMsg;
            return 'Updated.';
        });

    ctx.command('_.switch <command>', '启用/停用命令', { noRedirect: true })
        .userFields(['authority'])
        .groupFields(['disallowedCommands'])
        .before(checkGroupAdmin)
        .action(({ session }, command) => {
            session.$group.disallowedCommands = session.$group.disallowedCommands || [];
            if (session.$group.disallowedCommands.includes(command)) {
                const set = new Set(session.$group.disallowedCommands);
                set.delete(command);
                session.$group.disallowedCommands = Array.from(set);
                return `${command} 命令为启用状态。`;
            }
            session.$group.disallowedCommands.push(command);
            return `${command} 命令为禁用状态。`;
        });

    ctx.command('_.mute <user> <periodSecs>', '禁言用户', { noRedirect: true })
        .userFields(['authority'])
        .before(checkGroupAdmin)
        .action(({ session }, user, secs = '600000') =>
            session.$bot.setGroupBan(session.groupId, getTargetId(user), parseInt(secs, 10)));

    ctx.on('message', async (session) => {
        const groupName = await getGroupName(session);
        const senderName = getSenderName(session);
        const message = await formatMessage(session);
        logger.info(`[${groupName}] ${senderName}: ${message}`);
        if (!session.groupId) return;
        if (session.message === '>_.activate') {
            const user = await ctx.database.getUser(session.userId);
            if (user.authority >= 4 || ['admin', 'owner'].includes(session.sender.role)) {
                const group = await ctx.database.getGroup(session.groupId);
                const flag = group.flag & (~Group.Flag.ignore);
                await ctx.database.setGroup(session.groupId, { flag });
                await session.$send('Activated');
            } else await session.$send('您没有权限执行该操作');
        }
        if (!session.message.includes('[CQ:reply,id=')) return;
        const res = RE_REPLY.exec(session.message);
        if (!res) return;
        const [, id, msg] = res;
        if (msg.includes('!!recall')) {
            const user = await ctx.database.getUser(session.userId, ['authority']);
            if (user.authority >= 4) return session.$bot.deleteMsg(parseInt(id, 10));
        }
    });

    ctx.on('group-ban', (session) => {
        // TODO handle auto-leave?
        if (session.userId === session.selfId) console.log(session);
    });

    ctx.on('group-increase', async (session) => {
        const data = await session.$app.database.getGroup(session.groupId);
        logger.info('Event.Group_Increase', session, data);
        if (data.welcomeMsg) {
            await session.$send(data.welcomeMsg.replace(/%@/gmi, `[CQ:at,qq=${session.userId}`));
        }
    });

    ctx.on('group-decrease', async (session) => {
        const udoc = await ctx.database.getUser(session.userId);
        logger.info('Event.Group_Decrease', session, udoc);
        session.$send(`${session.$username} 退出了群聊。`);
    });

    ctx.on('before-command', ({ session, command }) => {
        if (!session.$group) return;
        // @ts-ignore
        if ((session.$group.disallowedCommands || []).includes(command.name)) return '';
        const noRedirect = command.getConfig('noRedirect', session);
        if (noRedirect && session._redirected) return '不支持在插值中调用该命令。';
    });

    ctx.on('before-attach-group', (session, fields) => {
        fields.add('disallowedCommands');
    });

    ctx.on('request/group/invite', async (session) => {
        const udoc = await ctx.database.getUser(session.userId);
        if (udoc?.authority === 5) {
            logger.info('Approve Invite Request', session, udoc);
            session.$bot.setGroupAddRequest('Approved', session.subType, true);
        } else {
            logger.info('Denied Invite Request', session, udoc);
            session.$bot.setGroupAddRequest('Please contact admin.', session.subType, false);
        }
    });

    async function checkPerm() {
        logger.info('正在检查权限');
        for (const bot of ctx.bots) {
            const groups = await bot.getGroupList();
            for (const group of groups) {
                const users = await bot.getGroupMemberList(group.groupId);
                const udocs = await ctx.database.getUsers(users.map((user) => user.userId));
                if (!udocs.some((user) => user.authority === 5)) {
                    logger.info('已退出 %d(%s)：无授权者', group.groupId, group.groupName);
                    bot.sendGroupMsg(group.groupId, '未检测到有效的授权。即将自动退出。');
                    setTimeout(() => {
                        bot.setGroupLeave(group.groupId);
                    }, 5000);
                }
            }
        }
    }

    ctx.on('connect', async () => {
        const c: Collection<Message> = ctx.database.db.collection('message');

        logger.info('Ensuring index...');
        await c.createIndex({ time: -1, group: 1, user: 1 });
        logger.info('Done.');

        ctx.command('_.stat', 'stat')
            .option('total', 'Total')
            .action(async ({ session, options }) => {
                const time = options.total ? {} : { time: { $gt: new Date(new Date().getTime() - 24 * 3600 * 1000) } };
                const totalSendCount = await c.find({ ...time, sender: session.selfId }).count();
                const groupSendCount = await c.find({ ...time, group: session.groupId, sender: session.selfId }).count();
                const totalReceiveCount = await c.find({ ...time, sender: { $ne: session.selfId } }).count();
                const groupReceiveCount = await c.find({ ...time, group: session.groupId, sender: { $ne: session.selfId } }).count();
                return `统计信息${options.total ? '（总计）' : '（今日）'}
发送消息${totalSendCount}条，本群${groupSendCount}条。
收到消息${totalReceiveCount}条，本群${groupReceiveCount}条。`;
            });

        ctx.command('_.rank', 'rank')
            .option('total', 'Total')
            .action(async ({ session, options }) => {
                const $match = options.total
                    ? { group: session.groupId }
                    : { time: { $gt: new Date(new Date().getTime() - 24 * 3600 * 1000) }, group: session.groupId };
                const result = await c.aggregate([
                    { $match },
                    { $group: { _id: '$sender', count: { $sum: 1 } } },
                    { $sort: { count: -1 } },
                    { $limit: 10 },
                ]).toArray() as unknown as any;
                const udict: Dictionary<GroupMemberInfo> = {};
                for (const r of result) {
                    try {
                        udict[r._id] = await session.$bot.getGroupMemberInfo(session.groupId, r._id);
                    } catch (e) {
                        udict[r._id] = { card: r._id, nickname: '' } as unknown as GroupMemberInfo;
                    }
                }
                return `\
群成员发言排行${options.total ? '（共计）' : '（今日）'}
${result.map((r) => `${udict[r._id].card || udict[r._id].nickname} ${r.count}条`).join('\n')}`;
            });

        if (config.recordMessage) {
            ctx.on('message', async (session) => {
                if (!session.groupId) return;
                c.insertOne({
                    group: session.groupId,
                    message: session.message,
                    sender: session.userId,
                    time: new Date(),
                });
            });

            ctx.on('before-send', (session) => {
                if (!session.groupId) return;
                c.insertOne({
                    time: new Date(),
                    sender: session.$bot.selfId,
                    group: session.groupId,
                    message: session.message,
                });
            });
        }

        setTimeout(checkPerm, 10000);
        setInterval(checkPerm, 30 * 60 * 1000);
    });
};
