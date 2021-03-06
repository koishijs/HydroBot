/* eslint-disable no-await-in-loop */
import child from 'child_process';
import { inspect } from 'util';
import {
    Channel, User, Context, GroupMemberInfo, Session, Logger, Time, segment,
} from 'koishi-core';
import { apply as KoishiPluginCommon } from 'koishi-plugin-common';
import { ObjectID } from 'mongodb';
import moment from 'moment';
import { CQBot } from 'koishi-adapter-onebot';
import { text2png } from '../lib/graph';

interface Message {
    _id: ObjectID,
    time: Date,
    message: string,
    sender: number,
    group: string,
    id: string,
}
interface Config {
    recordMessage?: boolean,
    timezoneOffset?: number,
    public?: string[],
}
declare module 'koishi-core' {
    interface Channel {
        disallowedCommands: string[],
        welcomeMsg: string,
    }
    interface Tables {
        message: Message,
    }
}
Channel.extend(() => ({
    disallowedCommands: [],
}));
const groupMap: Record<number, [Promise<string>, number]> = {};
const userMap: Record<number, [string | Promise<string>, number]> = {};

async function getGroupName(session: Session) {
    if (session.subtype === 'private') return '私聊';
    const timestamp = Date.now();
    const id = session.channelId;
    if (!groupMap[id] || timestamp - groupMap[id][1] >= Time.hour) {
        const promise = (session.bot as CQBot).getGroup(id).then((d) => d.groupName, () => id);
        groupMap[id] = [promise, timestamp];
    }
    let output = await groupMap[id][0];
    if (output !== `${id}`) output += ` (${id})`;
    return output;
}
async function formatMessage(session: Session) {
    const codes = segment.parse(session.content);
    let output = '';
    for (const code of codes) {
        if (typeof code === 'string') output += code;
        else if (code.type === 'text') output += code.data.content;
        else if (code.type === 'at') {
            if (code.data.qq === 'all') output += '@全体成员';
            else {
                const id = code.data.qq;
                const timestamp = Date.now();
                if (!userMap[id] || timestamp - userMap[id][1] >= Time.hour) {
                    const promise = session.bot
                        .getGroupMember(session.groupId, id)
                        .then((d) => d.nickname || d.username, () => id);
                    userMap[id] = [promise, timestamp];
                }
                output += `@${await userMap[id][0]}`;
            }
        } else if (code.type === 'face') output += `[face ${code.data.id}]`;
        else if (code.type === 'image') {
            output += `[image ${(code.data.url as string || '').split('?')[0]}]`;
        } else if (code.type === 'reply') output += `[reply ${code.data.id}]`;
        else output += `[${code.type}]`;
    }
    return output;
}
const checkGroupAdmin = ({ session }) => (
    (session.user.authority >= 4 || session.author.roles.includes('admin') || session.author.roles.includes('owner'))
        ? null
        : '仅管理员可执行该操作。'
);

export const apply = (ctx: Context, config: Config = {}) => {
    const logger = new Logger('busybox');
    Logger.levels.message = 3;
    Time.setTimezoneOffset(config.timezoneOffset ?? -480); // UTC +8
    config.recordMessage = config.recordMessage ?? true;
    ctx.plugin(KoishiPluginCommon, {});

    ctx.command('help', { authority: 1, hidden: true });
    ctx.command('tex', { authority: 1 });
    ctx.command('_', '管理工具');

    ctx.select('groupId').command('_.assign', 'assign', { authority: 4 })
        .channelFields(['assignee'])
        .action(async ({ session }) => {
            session.channel.assignee = session.selfId.toString();
        });

    ctx.command('_.echo <msg:text>', 'echo', { noRedirect: true, authority: 3 })
        .action((_, msg) => msg.decode());

    ctx.command('_.eval <expr:text>', { authority: 5, noRedirect: true, hidden: true })
        .option('i', 'Output as image')
        .userFields(User.fields)
        .channelFields(Channel.fields)
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        .action(async ({ session, options }, input) => {
            let res: any;
            const expr = `\
        (async function f() {
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
            return `[CQ: image, file = base64://${img}]`;
        });

    ctx.command('_.sh <command:text>', '执行shell命令', { authority: 5, noRedirect: true })
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

    ctx.select('platform').command('_.leave', '退出该群', { noRedirect: true })
        .userFields(['authority'])
        .check(checkGroupAdmin)
        .action(async ({ session }) => {
            await (session.bot as CQBot).$setGroupLeave(session.groupId);
        });

    ctx.command('_.setPriv <userId> <authority>', '设置用户权限', { authority: 5, noRedirect: true })
        .action(async ({ session }, userId, authority) => {
            if (authority === 'null') {
                await ctx.database.setUser(session.platform, userId, { flag: User.Flag.ignore });
                authority = '0';
            } else {
                await ctx.database.setUser(session.platform, userId, { flag: 0 });
            }
            await session.app.database.setUser(
                session.platform, userId, { authority: +authority },
            );
            return `Set ${session.platform}:${userId} to ${authority}`;
        });

    ctx.command('_.boardcast <message:text>', '全服广播', { authority: 5, noRedirect: true })
        .option('forced', '-f 无视 silent 标签进行广播')
        .action(async ({ options, session }, message) => {
            if (!message) return '请输入要发送的文本。';
            let groups = await ctx.database.getAssignedChannels(['id', 'flag']);
            if (!options.forced) {
                groups = groups.filter((g) => !(g.flag & Channel.Flag.silent));
            }
            groups.forEach((group) => {
                session.bot.sendMessage(group.id, message);
            });
        });

    ctx.command('contextify <command:text>', '在特定上下文中触发指令', { authority: 4, noRedirect: true });

    ctx.command('_.deactivate', '在群内禁用', { noRedirect: true })
        .userFields(['authority'])
        .check(checkGroupAdmin)
        .channelFields(['flag'])
        .action(({ session }) => {
            session.channel.flag |= Channel.Flag.ignore;
            return 'Deactivated';
        });

    ctx.command('_.activate', '在群内启用', { noRedirect: true })
        .userFields(['authority'])
        .check(checkGroupAdmin)
        .channelFields(['flag'])
        .action(({ session }) => {
            session.channel.flag &= ~Channel.Flag.ignore;
            return 'Activated';
        });

    ctx.command('_.switch <command>', '启用/停用命令', { noRedirect: true })
        .userFields(['authority'])
        .channelFields(['disallowedCommands'])
        .check(checkGroupAdmin)
        .action(({ session }, command) => {
            session.channel.disallowedCommands = session.channel.disallowedCommands || [];
            if (session.channel.disallowedCommands.includes(command)) {
                const set = new Set(session.channel.disallowedCommands);
                set.delete(command);
                session.channel.disallowedCommands = Array.from(set);
                return `${command} 命令为启用状态。`;
            }
            session.channel.disallowedCommands.push(command);
            return `${command} 命令为禁用状态。`;
        });

    ctx.command('_.mute <user> <periodSecs>', '禁言用户', { noRedirect: true })
        .userFields(['authority'])
        .check(checkGroupAdmin)
        .action(({ session }, user, secs = '600000') =>
            (session.bot as CQBot).$setGroupBan(session.groupId, user, parseInt(secs, 10)));

    ctx.on('message', async (session) => {
        const groupName = await getGroupName(session);
        const senderName = `${session.$username}(${session.userId})`;
        const message = await formatMessage(session);
        logger.info(`[${groupName}] ${senderName}: ${message}`);
        if (!session.groupId) return;
        if (session.content === '>_.activate') {
            const user = await ctx.database.getUser(session.platform, session.userId);
            if (user.authority >= 4 || session.author.roles.includes('admin') || session.author.roles.includes('owner')) {
                const group = await ctx.database.getChannel(session.platform, session.groupId);
                const flag = group.flag & (~Channel.Flag.ignore);
                await ctx.database.setChannel(session.platform, session.groupId, { flag });
                await session.send('Activated');
            } else await session.send('您没有权限执行该操作');
        }
    });

    ctx.on('before-send', (session) => {
        Promise.all([
            getGroupName(session),
            formatMessage(session),
        ]).then(
            ([groupName, message]) => logger.info(`send [${groupName}] ${session.selfId}: ${message}`),
        );
    });

    ctx.on('group-member/ban', (session) => {
        // TODO handle auto-leave?
        if (session.userId.toString() === session.selfId.toString()) console.log(session);
    });

    ctx.on('group-member-added', async (session) => {
        const data = await session.app.database.getChannel(session.platform, session.groupId);
        logger.info('Event.Group_Increase', session, data);
        if (data.welcomeMsg) {
            await session.send(data.welcomeMsg.replace(/%@/gmi, `[CQ:at,qq=${session.userId}`));
        }
    });

    ctx.on('group-member-deleted', async (session) => {
        const udoc = await ctx.database.getUser(session.platform, session.userId);
        logger.info('Event.Group_Decrease', session, udoc);
        session.send(`${session.$username} 退出了群聊。`);
    });

    ctx.on('before-command', ({ session, command }) => {
        if (!session.channel) return;
        // @ts-ignore
        if ((session.channel.disallowedCommands || []).includes(command.name)) return '';
    });

    ctx.on('before-attach-user', (session, fields) => {
        fields.add('id');
    });

    ctx.on('before-attach-channel', (session, fields) => {
        fields.add('disallowedCommands');
    });

    ctx.app.on('friend-request', (session: any) => session.bot.setFriendAddRequest(session.flag, true));
    ctx.app.on('group-request', async (session: any) => {
        const udoc = await ctx.database.getUser(session.platform, session.userId);
        if ((config.public || []).includes(`${session.platform}:${session.selfId}`) || udoc?.authority === 5) {
            logger.info('Approve Invite Request', session, udoc);
            session.bot.setGroupAddRequest(session.flag, session.subtype, true);
        } else {
            logger.info('Denied Invite Request', session, udoc);
            session.bot.setGroupAddRequest(session.flag, session.subtype, '此账号不对外开放，请使用其他账号。');
        }
    });

    ctx.on('connect', async () => {
        const c = ctx.database.collection('message');

        logger.info('Ensuring index...');
        await c.createIndex({ time: -1, group: 1, user: 1 });
        logger.info('Done.');

        ctx.command('_.recall', '撤回消息')
            .userFields(['authority'])
            .check(checkGroupAdmin)
            .option('count', '-c <count> 数量', { fallback: 1 })
            .action(async ({ session, options }) => {
                const self = await session.app.database.getUser(session.platform, session.selfId.toString());
                const msgs = await c.find({ group: session.groupId, sender: self.id }).sort({ time: -1 }).limit(options.count).toArray();
                logger.info('deleting message: %o', msgs);
                for (const msg of msgs) await session.bot.deleteMessage(session.groupId, msg.id);
            });

        ctx.command('_.stat [duration]', 'stat')
            .option('total', '-t Total')
            .action(async ({ session, options }, duration = '1day') => {
                const [, n = '1', a] = /(\d+)?(\w+)/.exec(duration);
                const group = `${session.platform}:${session.groupId}`;
                const self = await session.app.database.getUser(session.platform, session.selfId.toString());
                const time = options.total ? {} : { time: { $gt: moment().add(-n, a as any).toDate() } };
                const totalSendCount = await c.find({ ...time, sender: self.id }).count();
                const groupSendCount = await c.find({ ...time, group, sender: self.id }).count();
                const totalReceiveCount = await c.find({ ...time, sender: { $ne: self.id } }).count();
                const groupReceiveCount = await c.find({ ...time, group, sender: { $ne: self.id } }).count();
                return `统计信息${options.total ? '（总计）' : `（${duration}）`}
发送消息${totalSendCount}条，本群${groupSendCount}条。
收到消息${totalReceiveCount}条，本群${groupReceiveCount}条。`;
            });

        ctx.command('_.rank [duration]', 'rank')
            .option('total', 'Total')
            .action(async ({ session, options }, duration = '1day') => {
                const [, n = '1', a] = /(\d+)?(\w+)/.exec(duration);
                const group = `${session.platform}:${session.groupId}`;
                const $match = options.total
                    ? { group }
                    : { time: { $gt: moment().add(-n, a as any).toDate() }, group };
                const result = await c.aggregate([
                    { $match },
                    { $group: { _id: '$sender', count: { $sum: 1 } } },
                    { $sort: { count: -1 } },
                    { $limit: 10 },
                ]).toArray() as unknown as any;
                const udocs = await session.app.database.getUser('id', result.map((r) => r._id), [session.platform, 'name']);
                const udict: Record<number, Pick<GroupMemberInfo, 'nickname' | 'username'>> = {};
                for (let i = 0; i < result.length; i++) {
                    const r = result[i];
                    try {
                        udict[r._id] = await session.bot.getGroupMember(session.groupId, udocs[i][session.platform]);
                    } catch (e) {
                        udict[r._id] = { username: udocs[i]?.name || r._id, nickname: '' };
                    }
                }
                return `\
群成员发言排行${options.total ? '（共计）' : `（${duration}）`}
${result.map((r) => `${udict[r._id].nickname || udict[r._id].username} ${r.count}条`).join('\n')}`;
            });

        if (config.recordMessage) {
            ctx.middleware((session, next) => {
                if (!session.groupId) return next();
                const group = `${session.platform}:${session.groupId}`;
                c.insertOne({
                    group,
                    message: session.content,
                    // @ts-ignore
                    sender: session.user.id,
                    time: new Date(),
                    id: session.messageId,
                });
            });

            ctx.on('send', async (session) => {
                if (!session.groupId) return;
                const group = `${session.platform}:${session.groupId}`;
                const udoc = await session.app.database.getUser(session.platform, session.selfId.toString(), ['id']);
                c.insertOne({
                    time: new Date(),
                    sender: udoc.id,
                    group,
                    message: session.content,
                    id: session.messageId,
                });
            });
        }
    });
};
