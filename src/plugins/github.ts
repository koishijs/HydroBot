/* eslint-disable no-empty-function */
// @ts-nocheck
import crypto from 'crypto';
import * as superagent from 'superagent';
import proxy from 'superagent-proxy';
import { App, Session } from 'koishi-core';
import { Logger } from 'koishi-utils';

proxy(superagent);
const logger = new Logger('github');
class InvalidTokenError extends Error { }
interface Token {
    access_token: string,
    refresh_token: string,
}
interface Subscription {
    _id: string,
    target: string[],
}
interface EventHandler {
    hook?: (body: any) => Promise<[string?, Record<string, any>?]>
    interact?: (message: string, session: Session, event: any, getToken: () => Promise<string>) => Promise<[string?, Record<string, any>?] | boolean>
}
interface BeautifyRule {
    regex: RegExp,
    process: (result: string[], content: string) => string,
}
declare module 'koishi-core' {
    interface User {
        GithubToken: Token
    }
    interface Tables {
        github_watch: Subscription,
        github_data: any
    }
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
    {
        // Codecov
        // eslint-disable-next-line max-len
        regex: /^# \[Codecov\][^\n]+\n> Merging [\s\S]+ will (.*)\n> The diff coverage is `(.*)`.\n\n\[!\[Impacted file tree graph\]\((.*)\)\]\((.*)\)/gmi,
        process: (result) => `Merging will ${result[1].replace(/\*\*/gmi, '')}\nThe diff coverage is ${result[3]}\n${result[5]}`,
    },
    {
        regex: /\[ImgBot\] Optimize images (#[0-9]+)\n*([\s\S]+)\nSigned-off-by/gmi,
        process: (result) => `[ImgBot]\n${result[2]}`,
    },
];

function beautifyContent(content: string) {
    for (const rule of rules) {
        const result = rule.regex.exec(content);
        if (result) return rule.process(result, content);
    }
    return content.replace(/(\r?\n *)+/gmi, '\n');
}
function sha256(str: string): string {
    return crypto.createHash('sha256')
        .update(str)
        .digest('hex');
}

export const apply = (app: App, config: any) => {
    function Get(url: string) {
        return superagent
            .get(url)
            .proxy(config.proxy)
            .set('Accept', 'application/vnd.github.v3+json')
            .set('User-Agent', 'HydroBot');
    }

    function Post(url: string) {
        return superagent
            .post(url)
            .proxy(config.proxy)
            .set('Accept', 'application/vnd.github.v3+json')
            .set('User-Agent', 'HydroBot');
    }

    function Put(url: string) {
        return superagent
            .put(url)
            .proxy(config.proxy)
            .set('Accept', 'application/vnd.github.v3+json')
            .set('User-Agent', 'HydroBot');
    }

    app.on('connect', () => {
        const coll = app.database.db.collection('github_watch');
        const collData = app.database.db.collection('github_data');

        const events: Record<string, EventHandler> = {
            push: {
                async hook(body) {
                    const ref = body.ref.split('/')[2];
                    const sender = body.head_commit ? body.head_commit.author.username : body.sender.login;
                    let added = 0;
                    let removed = 0;
                    let modified = 0;
                    let resp = `Recent commit to ${body.repository.full_name}${ref === 'master' ? '' : `:${ref}`} by ${sender}`;
                    if (config.sourcegraph) {
                        const result = await superagent.post('https://sourcegraph.com/.api/graphql')
                            .set('Authorization', `token ${config.sourcegraph}`)
                            .send({
                                query: `query{
repository(name:"github.com/${body.repository.full_name}"){
  comparison(base:"${body.before}",head:"${body.after}"){
    fileDiffs{nodes{stat{added changed deleted}}}
  }
}
}`,
                            });
                        const changes = result.body.data.repository.comparison.fileDiffs.nodes;
                        for (const change of changes) {
                            added += change.stat.added;
                            removed += change.stat.removed;
                            modified += change.stat.modified;
                        }
                    }
                    if (added || removed || modified) resp += `${added}+ ${removed}- ${modified}M`;
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
                    } else resp = `Unknown issue action: ${body.action}`;
                    return [
                        resp,
                        {
                            link: body.issue.html_url,
                            reponame: body.repository.full_name,
                            issueId: body.issue.number,
                        },
                    ];
                },
                async interact(message, session, event, getToken) {
                    if (message.includes('!!link')) return [event.link];
                    const token = await getToken();
                    await Get(`https://api.github.com/repos/${event.reponame}/issues/${event.issueId}/comments`)
                        .set('Authorization', `token ${token}`)
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
                async interact(message, session, event, getToken) {
                    if (message.includes('!!link')) return [event.link];
                    const token = await getToken();
                    if (message.includes('!!merge')) {
                        const commitMsg = message.split('!!merge')[1];
                        await Put(`https://api.github.com/repos/${event.reponame}/pulls/${event.issueId}/merge`)
                            .set('Authorization', `token ${token}`)
                            .send({ commit_title: commitMsg });
                        return [];
                    }
                    if (message.includes('!!approve')) {
                        await Post(`https://api.github.com/repos/${event.reponame}/pulls/${event.issueId}/reviews`)
                            .set('Authorization', `token ${token}`)
                            .send({ event: 'APPROVE' });
                        return [];
                    }
                    await Post(`https://api.github.com/repos/${event.reponame}/issues/${event.issueId}/comments`)
                        .set('Authorization', `token ${token}`)
                        .send({ body: message });
                    return [];
                },
            },
            pull_request: {
                async hook(body) {
                    let resp;
                    const { full_name, owner } = body.repository;
                    const {
                        user, html_url, title, base, head, number, merged,
                    } = body.pull_request;
                    const prefix = new RegExp(`^${owner.login}:`);
                    const baseLabel = base.label.replace(prefix, '');
                    const headLabel = head.label.replace(prefix, '');
                    if (user.type === 'Bot') return;
                    if (body.action === 'opened') {
                        resp = `${user.login} opened an pull request for ${full_name}#${number}(${baseLabel}<${headLabel})`;
                        resp += `\n${title}`;
                        if (body.pull_request.body) resp += `\n${body.pull_request.body}`;
                    } else if (body.action === 'created') {
                        resp = `${user.login} commented on ${full_name}#${number}(${baseLabel}<${headLabel})`;
                        resp += `\n${body.comment.body}`;
                    } else if (body.action === 'assigned') {
                        resp = `${full_name}#${number}: Assigned ${body.assignee.login}`;
                    } else if (body.action === 'unassigned') {
                        resp = `${full_name}#${number}: Unassigned ${body.assignee.login}`;
                    } else if (body.action === 'review_requested') {
                        resp = `${full_name}#${number}: Request a review.`;
                    } else if (body.action === 'closed') {
                        const type = merged ? 'merged' : 'closed';
                        resp = `${body.sender.login} ${type} ${full_name}#${number}(${baseLabel}<${headLabel})`;
                    } else if (['reopened', 'locked', 'unlocked'].includes(body.action)) {
                        resp = `${body.sender.login} ${body.action} PR:${full_name}#${number}`;
                    } else if (['synchronize'].includes(body.action)) {
                        resp = '';
                    } else if (body.action === 'ready_for_review') {
                        resp = `${full_name}#${number} is ready for review.`;
                    } else resp = `Unknown pull request action: ${body.action}`;
                    return [
                        resp,
                        {
                            link: html_url,
                            reponame: full_name,
                            issueId: number,
                        },
                    ];
                },
                async interact(message, session, event, getToken) {
                    if (message.includes('!!link')) return [event.link];
                    const token = await getToken();
                    if (message.includes('!!merge')) {
                        const commitMsg = message.split('!!merge')[1];
                        await Put(`https://api.github.com/repos/${event.reponame}/pulls/${event.issueId}/merge`)
                            .set('Authorization', `token ${token}`)
                            .send({ commit_title: commitMsg });
                    } else if (message.includes('!!approve')) {
                        await Post(`https://api.github.com/repos/${event.reponame}/pulls/${event.issueId}/reviews`)
                            .set('Authorization', `token ${token}`)
                            .send({ event: 'APPROVE' });
                    } else {
                        await Post(`https://api.github.com/repos/${event.reponame}/issues/${event.issueId}/comments`)
                            .set('Authorization', `token ${token}`)
                            .send({ body: message });
                    }
                    return [];
                },
            },
            pull_request_review: {
                async hook(body) {
                    if (body.review.state === 'commented') return [];
                    if (body.review.state === 'approved') {
                        return [`${body.sender.login} approved ${body.repository.full_name}#${body.pull_request.number}`];
                    }
                    return [];
                },
            },
            pull_request_review_comment: {
                async hook(body) {
                    let resp = '';
                    if (body.action === 'created') {
                        resp = `${body.comment.user.login} commented on ${body.repository.full_name}#${body.pull_request.number}\n`;
                        resp += beautifyContent(body.comment.body);
                    }
                    return [
                        resp,
                        {
                            link: body.pull_request.html_url,
                            reponame: body.repository.full_name,
                            issueId: body.pull_request.number,
                        },
                    ];
                },
                async interact(message, session, event, getToken) {
                    if (message.includes('!!link')) return [event.link];
                    const token = await getToken();
                    await Post(`https://api.github.com/repos/${event.reponame}/issues/${event.issueId}/comments`)
                        .set('Authorization', `token ${token}`)
                        .send({ body: message });
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

        app.router.post('/github', async (ctx) => {
            try {
                const event = ctx.request.headers['x-github-event'];
                let body;
                if (typeof ctx.request.body.payload === 'string') body = JSON.parse(ctx.request.body.payload);
                else body = ctx.request.body;
                const _id = sha256(JSON.stringify(body));
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
                                for (const id of data.target) {
                                    const [platform, gid] = id.split(':');
                                    // eslint-disable-next-line no-await-in-loop
                                    const gdoc = await app.database.getChannel(platform, gid, ['assignee']);
                                    if (gdoc.assignee && app.bots[`${platform}:${gdoc.assignee}`]) {
                                        relativeIds.push(app.bots[`${platform}:${gdoc.assignee}`].sendMessage(gid, message));
                                    } else logger.warn('Cannot send message to %s:%d with assignee %d', platform, id, gdoc.assignee);
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

        app.router.get('/github/authorize', async (ctx) => {
            const [platform, id] = ctx.query.state.split(':');
            const code = ctx.query.code;
            const result = await superagent.post('https://github.com/login/oauth/access_token')
                .proxy(config.proxy)
                .send({
                    client_id: config.client_id,
                    client_secret: config.client_secret,
                    code,
                    redirect_uri: config.redirect_uri,
                    state: ctx.query.state,
                });
            if (result.body.access_token) {
                await app.database.setUser(platform, id, { GithubToken: result.body });
                ctx.body = 'Done';
            } else {
                ctx.body = 'Error';
            }
        });

        app.middleware(async (session, next) => {
            const replyTo = session.quote?.messageId;
            const parsedMsg = session.content.replace(/\[CQ:at,qq=\d+\]/, '').trim();
            if (!replyTo || !parsedMsg) return next();
            const [relativeEvent, user] = await Promise.all([
                collData.findOne({ relativeIds: replyTo }),
                app.database.getUser(session.platform, session.userId, ['GithubToken']),
            ]);
            if (!relativeEvent || !events[relativeEvent.type].interact) return;
            logger.info(replyTo, parsedMsg);
            logger.info('Reply: %s', relativeEvent);
            if (parsedMsg.startsWith('//')) return next();
            try {
                async function getToken() {
                    if (!user.GithubToken?.access_token) throw new InvalidTokenError();
                    const result = await superagent.get('https://api.github.com/')
                        .proxy(config.proxy)
                        .set('Authorization', `token ${user.GithubToken.access_token}`)
                        .set('User-Agent', 'HydroBot');
                    if (result.status !== 200) {
                        if (!user.GithubToken.refresh_token) throw new InvalidTokenError();
                        const r = await superagent.post('https://github.com/login/oauth/access_token')
                            .proxy(config.proxy)
                            .set('User-Agent', 'HydroBot')
                            .send({
                                grant_type: 'refresh_token',
                                client_id: config.client_id,
                                client_secret: config.client_secret,
                                refresh_token: user.GithubToken.refresh_token,
                            });
                        if (!r.body.access_token) throw new InvalidTokenError();
                        await app.database.setUser(session.platform, session.userId, { GithubToken: r.body });
                        return r.body.access_token;
                    }
                    return user.GithubToken.access_token;
                }
                let result;
                try {
                    result = await events[relativeEvent.type].interact(parsedMsg.trim(), session, relativeEvent, getToken);
                    console.log(result);
                } catch (e) {
                    console.log('catch', e);
                    if (e instanceof InvalidTokenError) {
                        session.send('请输入Github用户名');
                        const login = await session.prompt(60000);
                        if (!login) return session.send('输入超时');
                        return session.send(`请点击下面的链接继续操作：
https://github.com/login/oauth/authorize?client_id=${config.client_id}&state=${session.platform}:${session.userId}&redirect_url=${config.redirect_uri}&scope=admin%3Arepo_hook%2Crepo&login=${login}`); // eslint-disable-line max-len
                    }
                    throw e;
                }
                const [message, $set] = result;
                if (message) await session.send(message);
                if ($set) await collData.updateOne({ _id: relativeEvent._id }, { $set });
            } catch (e) { session.send(e.message); }
            return next();
        });

        app.select('groupId').command('github.listen <repo>', '监听一个Repository的事件')
            .action(async ({ session }, repo) => {
                repo = repo.toLowerCase();
                if (repo.split('/').length !== 2) return '无效地址';
                const current = await coll.findOne({ _id: repo });
                if (current) {
                    await coll.updateOne(
                        { _id: repo },
                        { $addToSet: { target: `${session.platform}:${session.groupId}` } },
                        { upsert: true },
                    );
                    return `Watching ${repo}`;
                }
                await coll.insertOne({ _id: repo, target: [`${session.platform}:${session.groupId}`] });
                return `Watching ${repo}
(请创建 webhook 投递至 https://github.undefined.moe/webhook ，格式 application/json )`;
            });

        app.select('groupId').command('github.list', 'List repos')
            .action(async ({ session }) => {
                const repos = await coll.find({ target: `${session.platform}:${session.groupId}` }).project({ _id: 1 }).toArray();
                return repos.map((doc) => doc._id).join('\n');
            });

        app.select('groupId').command('github.cancel <repo>', '取消一个Repository的事件')
            .action(async ({ session }, repo) => {
                await coll.updateOne(
                    { _id: repo.toLowerCase() },
                    { $pull: { target: `${session.platform}:${session.groupId}` } },
                );
                return `Cancelled ${repo}.`;
            });
    });
};
