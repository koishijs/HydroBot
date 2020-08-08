import child from 'child_process';
import { App, Group } from 'koishi';
import { getTargetId, Session } from 'koishi-core';
import { Logger, CQCode, Time } from 'koishi-utils';
import { text2png } from '../lib/graph';

const groupMap: Record<number, [Promise<string>, number]> = {};
const userMap: Record<number, [string | Promise<string>, number]> = {};

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
        } else output += `[${code.type}]`;
    }
    return output;
}

export const apply = (app: App) => {
    const logger = Logger.create('message', true);
    Logger.levels.message = 3;

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
        .action(async ({ session }, cmd) => {
            const p = child.execSync(cmd).toString();
            if (!p.trim().length) return session.$send('(execute success)');
            const img = await text2png(p);
            return session.$send(`[CQ:image,file=base64://${img}]`);
        });

    app.command('_.shutdown', '关闭机器人', { authority: 5 })
        .action(({ session }) => {
            setTimeout(() => {
                child.exec('pm2 stop robot');
                setTimeout(() => {
                    global.process.exit();
                }, 1000);
            }, 3000);
            return session.$send('Exiting in 3 secs...');
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
            await session.$app.database.setUser(
                getTargetId(userId), { authority: parseInt(authority, 10) },
            );
            return `Set ${userId} to ${authority}`;
        });

    app.command('_.boardcast <message...>', '全服广播', { authority: 5 })
        .before((session) => !session.$app.database)
        .option('-f, --forced', '无视 noEmit 标签进行广播')
        .action(async ({ options, session }, message) => {
            if (!message) return '请输入要发送的文本。';
            let groups = await app.database.getAllGroups(['id', 'flag'], [session.selfId]);
            if (!options.forced) {
                groups = groups.filter((g) => !(g.flag & Group.Flag.noEmit));
            }
            groups.forEach((group) => {
                session.$bot.sendGroupMsg(group.id, message);
            });
        });

    app.command('_.deactivate', '在群内禁用', { authority: 3 })
        .groupFields(['flag'])
        .action(({ session }) => {
            session.$group.flag |= Group.Flag.ignore;
            return 'Deactivated';
        });

    app.command('_.activate', '在群内启用', { authority: 3 })
        .groupFields(['flag'])
        .action(({ session }) => {
            session.$group.flag &= ~Group.Flag.ignore;
            return 'Activated';
        });

    app.command('_.mute <user> <periodSecs>', '禁言用户', { authority: 3 })
        .action(({ session }, user, secs = '600000') =>
            session.$bot.setGroupBan(session.groupId, getTargetId(user), parseInt(secs, 10)));

    app.on('message', async (session) => {
        const groupName = await getGroupName(session);
        const senderName = getSenderName(session);
        const message = await formatMessage(session);
        logger.debug(`[${groupName}] ${senderName}: ${message}`);
        if (!session.groupId) return;
        if (session.message === '>_.activate') {
            const user = await app.database.getUser(session.userId);
            if (user.authority >= 3) {
                const group = await app.database.getGroup(session.groupId);
                const flag = group.flag & (~Group.Flag.ignore);
                await app.database.setGroup(session.groupId, { flag });
                await session.$send('Activated');
            }
        }
    });

    app.on('connect', () => {
        Logger.lastTime = Date.now();
    });
};
