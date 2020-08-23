/* eslint-disable no-await-in-loop */
import child from 'child_process';
import {
    App, Group, getTargetId, Session, User,
} from 'koishi-core';
import { Logger, CQCode, Time } from 'koishi-utils';
import { text2png } from '../lib/graph';

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

declare module 'koishi-core/dist/database' {
    interface User {
        coin: number,
    }
    interface Group {
        welcomeMsg: string
    }
}

export const apply = (app: App) => {
    const logger = Logger.create('busybox', true);
    Logger.levels.message = 3;

    app.command('help', { authority: 1, hidden: true });
    app.command('tex', { authority: 1 });

    app.command('_', { authority: 5, hidden: true })
        .action(() => { });

    app.command('_.eval <expression...>', { authority: 5 })
        .action(async ({ session }, args) => {
            // eslint-disable-next-line no-eval
            let res = eval(args);
            if (res instanceof Promise) res = await res;
            if (typeof res === 'string' || res instanceof Array) return await session.$send(res.toString());
            if (typeof res === 'undefined') return session.$send('undefined');
            if (res instanceof Object) return session.$send(JSON.stringify(res));
            return session.$send(res.toString());
        });

    app.command('_.sh <command...>', '执行shell命令', { authority: 5 })
        .option('i', 'Output as image')
        .action(async ({ options }, cmd) => {
            let p: string;
            try {
                p = child.execSync(cmd.decode()).toString();
            } catch (e) {
                return `Error executing command: ${e}`;
            }
            if (!p.trim().length) return '(execute success)';
            if (!options.i) return p;
            const page = await app.browser.newPage();
            const img = await text2png(page, p);
            page.close();
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

    app.command('contextify <message...>', '在特定上下文中触发指令', { authority: 3 })
        .alias('ctxf')
        .userFields(['authority'])
        .before((session) => !session.$app.database)
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
            const newSession = new Session(app, session);
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

    app.command('_.setWelcomeMsg <...msg>', '设置欢迎信息', { authority: 4 })
        .groupFields(['welcomeMsg'])
        .action(({ session }, welcomeMsg) => {
            session.$group.welcomeMsg = welcomeMsg;
            return 'Updated.';
        });

    app.command('_.mute <user> <periodSecs>', '禁言用户', { authority: 4 })
        .action(({ session }, user, secs = '600000') =>
            session.$bot.setGroupBan(session.groupId, getTargetId(user), parseInt(secs, 10)));

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

    app.on('group-decrease', async (session) => {
        const udoc = await app.database.getUser(session.userId);
        if (udoc?.authority === 5) {
            session.$send('未检测到有效的授权。即将自动退出。');
            setTimeout(() => {
                session.$bot.setGroupLeave(session.groupId);
            }, 5000);
        }
    });

    app.on('request/group/invite', async (session) => {
        const udoc = await app.database.getUser(session.userId);
        if (udoc?.authority === 5) {
            session.$bot.setGroupAddRequest('Approved', session.subType, true);
        } else {
            session.$bot.setGroupAddRequest('Please contact admin.', session.subType, false);
        }
    });

    async function checkPerm() {
        for (const bot of app.bots) {
            const groups = await bot.getGroupList();
            for (const group of groups) {
                const users = await bot.getGroupMemberList(group.groupId);
                const udocs = await app.database.getUsers(users.map((user) => user.userId));
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

    app.on('connect', () => {
        setTimeout(checkPerm, 10000);
        setInterval(checkPerm, 30 * 60 * 1000);
    });
};
