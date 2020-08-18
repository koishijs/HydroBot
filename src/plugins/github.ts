/* eslint-disable no-empty-function */
import superagent from 'superagent';
import { App, Session } from 'koishi-core';
import { Collection } from 'mongodb';

declare module 'koishi-core/dist/database' {
    interface User {
        GithubToken: string
    }
}

const RE_REPLY = /\[CQ:reply,id=(-?[0-9]+)\]( ?\[CQ:at,qq=[0-9]+\])?(.*)$/gmi;

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
        // dependabot
        regex: /^(Bump [^ ]+ from [^ ]+ to [^ ]+)\n\nBumps /gmi,
        process: (result) => `${result[1]}`,
    },
    {
        // Issue-label-bot
        regex: /^Issue-Label Bot is automatically applying the label `(.*)` to this issue, with a confidence of (0\.[0-9]+)/gmi,
        process: (result) => `Tag: ${result[1]}\nConfidence: ${result[2]}`,
    },
];

function beautifyContent(content: string) {
    for (const rule of rules) {
        const result = rule.regex.exec(content);
        if (result) return rule.process(result, content);
    }
    return content;
}

// IsGroup? group/userId assignee
type Target = [boolean, number, number];

interface Subscription {
    _id: string,
    target: Target[],
}

interface EventHandler {
    hook?: (body: any) => Promise<[string?, NodeJS.Dict<any>?]>
    interact?: (message: string, session: Session, event: any, token: string) => Promise<[string?, NodeJS.Dict<any>?] | boolean>
}

function get(session: Session): Target {
    return [!!session.groupId, session.groupId || session.userId, session.selfId];
}

export const apply = (app: App, config: any) => {
    app.on('connect', () => {
        const coll: Collection<Subscription> = app.database.db.collection('github_watch');
        const collData: Collection<any> = app.database.db.collection('github_data');

        const events: NodeJS.Dict<EventHandler> = {
            push: {
                async hook(body) {
                    const ref = body.ref.split('/')[2];
                    const sender = body.head_commit ? body.head_commit.author.username : body.sender.login;
                    let resp = `Recent commit to ${body.repository.full_name}:${ref} by ${sender}`;
                    for (const commit of body.commits) {
                        const det = [];
                        if (commit.added.length) det.push(`${commit.added.length}+`);
                        if (commit.removed.length) det.push(`${commit.removed.length}-`);
                        if (commit.modified.length) det.push(`${commit.modified.length}M`);
                        resp += `\n${commit.id.substr(0, 6)} ${beautifyContent(commit.message).replace(/\n/g, '\r\n')} (${det.join(' ')})`;
                    }
                    return [resp, { link: body.compare }];
                },
                async interact(message, session, event) {
                    if (message.includes('!!link')) return [event.link];
                    return [];
                },
            },
            issues: {
                async hook(body) {
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
                    return [
                        resp,
                        {
                            link: body.issue.html_url,
                            reponame: body.repository.full_name,
                            issueId: body.issue.number,
                        },
                    ];
                },
                async interact(message, session, event, token) {
                    if (message.includes('!!link')) return [event.link];
                    if (!token) return true;
                    await superagent
                        .post(`https://api.github.com/repos/${event.reponame}/issues/${event.issueId}/comments`)
                        .set('Accept', 'application/vnd.github.v3+json')
                        .set('Authorization', `token ${token}`)
                        .set('User-Agent', 'HydroBot')
                        .send({ body: message });
                    return [];
                },
            },
            issue_comment: {
                async hook(body) {
                    let resp;
                    if (body.action === 'created') {
                        resp = `${body.comment.user.login} commented on ${body.repository.full_name}#${body.issue.number}\n`;
                        resp += beautifyContent(body.comment.body);
                    }
                    return [
                        resp,
                        {
                            link: body.issue.html_url,
                            reponame: body.repository.full_name,
                            issueId: body.issue.number,
                        },
                    ];
                },
                async interact(message, session, event, token) {
                    if (message.includes('!!link')) return [event.link];
                    if (!token) return true;
                    await superagent
                        .post(`https://api.github.com/repos/${event.reponame}/issues/${event.issueId}/comments`)
                        .set('Accept', 'application/vnd.github.v3+json')
                        .set('Authorization', `token ${token}`)
                        .set('User-Agent', 'HydroBot')
                        .send({ body: message });
                    return [];
                },
            },
            pull_request: {
                async hook(body) {
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
                    return [resp];
                },
                async interact() {
                    return [];
                },
            },
            star: {
                async hook(body) {
                    if (body.action === 'created') {
                        if (await collData.findOne({
                            user: body.sender.login, repo: body.repository.full_name,
                        })) return [];
                        return [
                            `${body.sender.login} starred ${body.repository.full_name} (total ${body.repository.stargazers_count} stargazers)`,
                            { user: body.sender.login, repo: body.repository.full_name },
                        ];
                    }
                    return [];
                },
            },
            watch: {},
            project_card: {},
            project_column: {},
            check_run: {},
            check_suite: {},
            repository_vulnerability_alert: {},
            status: {},
            label: {},
        };

        app.api.post('/github', async (ctx) => {
            try {
                const event = ctx.request.headers['x-github-event'];
                const _id = ctx.request.headers['x-github-delivery'];
                let body;
                if (typeof ctx.request.body.payload === 'string') body = JSON.parse(ctx.request.body.payload);
                else body = ctx.request.body;
                if (!events[event]) {
                    events[event] = {
                        hook: (b) => Promise.resolve([`${b.repository.full_name} triggered an unknown event: ${event}`]),
                    };
                }
                if (events[event].hook) {
                    // TODO organization webhook?
                    const reponame = body.repository.full_name;
                    const [message, inf] = await events[event].hook(body);
                    const res = await collData.findOne({ _id });
                    if (!res) {
                        let relativeIds = [];
                        if (message) {
                            const data = await coll.findOne({ _id: reponame.toLowerCase() });
                            if (data) {
                                for (const [isGroup, id, selfId] of data.target) {
                                    if (isGroup) {
                                        relativeIds.push(app.bots[selfId].sendGroupMsg(id, message));
                                    } else {
                                        relativeIds.push(app.bots[selfId].sendPrivateMsg(id, message));
                                    }
                                }
                            }
                            relativeIds = await Promise.all(relativeIds);
                            await collData.insertOne({
                                _id, type: event, relativeIds, ...inf,
                            });
                        }
                        ctx.body = `Pushed to ${relativeIds.length} group(s)`;
                    } else ctx.body = 'Duplicate event';
                } else ctx.body = 'Event ignored.';
            } catch (e) {
                console.log(e);
                ctx.body = e.toString();
            }
        });

        app.api.get('/github/authorize', async (ctx) => {
            const targetId = parseInt(ctx.query.state, 10);
            if (Number.isNaN(targetId)) throw new Error('Invalid targetId');
            const code = ctx.query.code;
            const result = await superagent.post('https://github.com/login/oauth/access_token')
                .send({
                    client_id: config.client_id,
                    client_secret: config.client_secret,
                    code,
                    redirect_uri: config.redirect_uri,
                    state: ctx.query.state,
                });
            if (result.body.access_token) {
                await app.database.setUser(targetId, { GithubToken: result.body.access_token });
                ctx.body = 'Done';
            } else {
                ctx.body = 'Error';
            }
        });

        app.on('message', async (session) => {
            if (!session.message.includes('[CQ:reply,id=')) return;
            const res = RE_REPLY.exec(session.message);
            if (!res) return;
            const [, id, , parsedMsg] = res;
            const replyTo = parseInt(id, 10);
            console.log(replyTo, parsedMsg);
            const [relativeEvent, user] = await Promise.all([
                collData.findOne({ relativeIds: { $elemMatch: { $eq: replyTo } } }),
                app.database.getUser(session.userId, ['GithubToken']),
            ]);
            console.log(relativeEvent);
            if (!relativeEvent) return;
            if (!events[relativeEvent.type].interact) return;
            const result = await events[relativeEvent.type].interact(parsedMsg.trim(), session, relativeEvent, user.GithubToken);
            console.log(result);
            if (typeof result === 'boolean') {
                return session.$send(`错误：您没有绑定Github账号。请点击下面的链接继续操作：
https://github.com/apps/hydrobot-github-integration/installations/new?state=${session.userId}`);
            }
            const [message, $set] = result;
            if (message) await session.$send(message);
            if ($set) await collData.updateOne({ _id: relativeEvent._id }, { $set });
        });

        app.command('github.listen <repo>', '监听一个Repository的事件')
            .action(async ({ session }, repo) => {
                repo = repo.toLowerCase();
                if (repo.split('/').length !== 2) return '无效地址';
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

    app.command('github', 'Github').action(() => 'Use github -h for help.');
};
