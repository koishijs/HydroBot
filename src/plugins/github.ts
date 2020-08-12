/* eslint-disable no-empty-function */
import { App, Session } from 'koishi-core';
import { Collection } from 'mongodb';

interface BeautifyRule {
    regex: RegExp,
    process: (result: string[], content: string) => string,
}

const rules: BeautifyRule[] = [
    {
        // lgtm
        regex: /^(This pull request .*?)when merging .*? - \[view on LGTM\.com\]\((.*?)\)\n\n.*\n([\s\S]*)$/gmi,
        process: (result) => `${result[1]}${result[2]}${result[3]}`,
    },
    {
        regex: /^(Bump [^ ]+ from [^ ]+ to [^ ]+)\n\nBumps /gmi,
        process: (result) => `${result[1]}`,
    },
];

function beautifyContent(content: string) {
    for (const rule of rules) {
        const result = rule.regex.exec(content);
        console.log(rule, result);
        if (result) return rule.process(result, content);
    }
    return content;
}

const events = {
    async push(body) {
        const ref = body.ref.split('/')[2];
        let resp = `Recent commit to ${body.repository.full_name}:${ref} by ${body.head_commit.author.username}`;
        for (const commit of body.commits) {
            const det = [];
            if (commit.added.length) det.push(`${commit.added.length}+`);
            if (commit.removed.length) det.push(`${commit.removed.length}-`);
            if (commit.modified.length) det.push(`${commit.modified.length}M`);
            resp += `\n${commit.id.substr(0, 6)} ${beautifyContent(commit.message).replace(/\n/g, '\r\n')} (${det.join(' ')})`;
        }
        return resp;
    },
    async issues(body) {
        let resp;
        if (body.action === 'opened') {
            resp = `${body.issue.user.login} opened an issue for ${body.repository.full_name}#${body.issue.number}`;
            resp = `${resp}\n${body.issue.title}`;
        } else if (body.action === 'created') {
            resp = `${body.comment.user.login} commented on ${body.repository.full_name}#${body.issue.number}`;
            resp += `\n${body.comment.body}`;
        } else if (body.action === 'assigned') {
            resp = `${body.repository.full_name}#${body.issue.number}: Assigned ${body.assignee.login}`;
        } else if (body.action === 'unassigned') {
            resp = `${body.repository.full_name}#${body.issue.number}: Unassigned ${body.assignee.login}`;
        } else if (body.action === 'closed') {
            resp = `${body.sender.login} closed ${body.repository.full_name}#${body.issue.number}.`;
        } else if (['reopened', 'locked', 'unlocked'].includes(body.action)) {
            resp = `${body.sender.login} ${body.action} Issue:${body.repository.full_name}#${body.issue.number}`;
        } else if (body.action === 'labled') {
            resp = `${body.sender.login} labled ${body.repository.full_name}#${body.issue.number} ${body.lable.name}`;
        } else resp = `Unknwon issue action: ${body.action}`;
        return resp;
    },
    async issue_comment(body) {
        let resp;
        if (body.action === 'created') {
            resp = `${body.comment.user.login} commented on ${body.repository.full_name}#${body.issue.number}\n`;
            resp += beautifyContent(body.comment.body);
        }
        return resp;
    },
    async pull_request(body) {
        let resp;
        if (body.action === 'opened') {
            resp = `${body.issue.user.login} opened an pull request for ${body.repository.full_name}#${body.issue.number}`;
            resp = `${resp}\n${body.issue.title}`;
        } else if (body.action === 'created') {
            resp = `${body.comment.user.login} commented on ${body.repository.full_name}#${body.issue.number}`;
            resp += `\n${body.comment.body}`;
        } else if (body.action === 'assigned') {
            resp = `${body.repository.full_name}#${body.issue.number}: Assigned ${body.assignee.login}`;
        } else if (body.action === 'unassigned') {
            resp = `${body.repository.full_name}#${body.issue.number}: Unassigned ${body.assignee.login}`;
        } else if (body.action === 'review_requested') {
            resp = `${body.repository.full_name}#${body.issue.number}: Request a review.`;
        } else if (body.action === 'closed' && !body.merged) {
            resp = `${body.sender.login} closed ${body.repository.full_name}#${body.issue.number}.`;
        } else if (['reopened', 'locked', 'unlocked'].includes(body.action)) {
            resp = `${body.sender.login} ${body.action} PR:${body.repository.full_name}#${body.issue.number}`;
        } else if (['synchronize'].includes(body.action)) {
            return;
        } else resp = `Unknwon pull request action: ${body.action}`;
        return resp;
    },
    async star(body, db) {
        if (body.action === 'created') {
            if (db) {
                const collStar = db.collection('github_event_star');
                if (await collStar.findOne({
                    user: body.sender.login, repo: body.repository.full_name,
                })) return null;
                await collStar.insertOne({
                    user: body.sender.login, repo: body.repository.full_name,
                });
            }
            return `${body.sender.login} starred ${body.repository.full_name} (total ${body.repository.stargazers_count} stargazers)`;
        }
        return null;
    },
    async watch() { },
    async project_card() { },
    async project_column() { },
    async check_run() { },
    async check_suite() { },
    async repository_vulnerability_alert() { },
    async status() { },
};

// IsGroup? group/userId assignee
type Target = [boolean, number, number];

interface Subscription {
    _id: string,
    target: Target[],
}

function get(session: Session): Target {
    return [!!session.groupId, session.groupId || session.userId, session.selfId];
}

export const apply = (app: App) => {
    app.on('connect', () => {
        const coll: Collection<Subscription> = app.database.db.collection('github_watch');

        app.api.post('/github', async (ctx) => {
            try {
                const event = ctx.request.headers['x-github-event'];
                let body;
                if (typeof ctx.request.body.payload === 'string') body = JSON.parse(ctx.request.body.payload);
                else body = ctx.request.body;
                if (!events[event]) events[event] = (b) => `${b.repository.full_name} triggered an unknown event: ${event}`;
                const reponame = body.repository.full_name;
                const message = await events[event](body, app.database.db);
                let cnt = 0;
                if (message) {
                    const data = await coll.findOne({ _id: reponame.toLowerCase() });
                    if (data) {
                        for (const [isGroup, id, selfId] of data.target) {
                            if (isGroup) app.bots[selfId].sendGroupMsg(id, message);
                            else app.bots[selfId].sendPrivateMsg(id, message);
                            cnt++;
                        }
                    }
                }
                ctx.body = `Pushed to ${cnt} group(s)`;
            } catch (e) {
                console.log(e);
                ctx.body = e.toString();
            }
        });

        app.command('github.listen <repo>', '监听一个Repository的事件')
            .action(async ({ session }, repo) => {
                if (!repo) return session.$send('缺少参数。');
                repo = repo.toLowerCase();
                const current = await coll.findOne({ _id: repo });
                if (current) {
                    await coll.updateOne(
                        { _id: repo },
                        {
                            $addToSet: {
                                target: get(session),
                            },
                        },
                        { upsert: true },
                    );
                    return `Watching ${repo}`;
                }
                await coll.insertOne(
                    {
                        _id: repo,
                        target: [get(session)],
                    },
                );
                return `Watching ${repo}
(请创建 webhook 投递至 http://2.masnn.io:6701/github ，格式 application/json )`;
            });

        app.command('github.list', 'List repos')
            .action(async ({ session }) => {
                const docs = await coll.find({ target: { $elemMatch: { $eq: get(session) } } })
                    .toArray();
                return docs.map((doc) => doc._id).join('\n');
            });

        app.command('github.cancel <repo>', '取消一个Repository的事件')
            .action(async ({ session }, repo) => {
                await coll.updateOne(
                    { _id: repo },
                    { $pull: { target: get(session) } },
                );
                return `Cancelled ${repo}.`;
            });
    });

    app.command('github', 'Github')
        .action(({ session }) => session.$send('Use github -h for help.'));
};
