let config = { watch: [] };
let app = null;
let collStar;
const events = {
    async push(body) {
        let resp = 'Recent commit to {0}{1} by {2}'.translate().format(
            body.repository.full_name, body.ref === 'refs/heads/master' ? '' : `:${body.ref}`, body.pusher.name,
        );
        for (const commit of body.commits) {
            const det = [];
            if (commit.added.length) det.push(`${commit.added.length}+`);
            if (commit.removed.length) det.push(`${commit.removed.length}-`);
            if (commit.modified.length) det.push(`${commit.modified.length}M`);
            resp += `\n${commit.id.substr(0, 6)} ${commit.message.replace(/\n/g, ' ')} (${det.join(' ')})`;
        }
        return resp;
    },
    async issues(body) {
        let resp;
        if (body.action === 'opened') {
            resp = '{0} opened an issue for {1}#{2}'.translate().format(body.issue.user.login, body.repository.full_name, body.issue.number);
            resp = `${resp}\n${body.issue.title}`;
        } else if (body.action === 'created') {
            resp = '{0} commented on {1}#{2}'.translate().format(body.comment.user.login, body.repository.full_name, body.issue.number);
            resp += `\n${body.comment.body}`;
        } else if (body.action === 'assigned') {
            resp = '{0}#{1}: Assigned {2}'.translate().format(body.repository.full_name, body.issue.number, body.assignee.login);
        } else if (body.action === 'unassigned') {
            resp = '{0}#{1}: Unassigned {2}'.translate().format(body.repository.full_name, body.issue.number, body.assignee.login);
        } else if (body.action === 'closed') {
            resp = '{0} closed {1}#{2}.'.translate().format(body.sender.login, body.repository.full_name, body.issue.number);
        } else if (['reopened', 'locked', 'unlocked'].includes(body.action)) {
            resp = '{0} {1} Issue:{2}#{3}'.translate().format(body.sender.login, body.action, body.repository.full_name, body.issue.number);
        } else if (body.action === 'labled') {
            resp = '{0} labled {1}#{2} {3}'.translate().format(body.sender.login, body.repository.full_name, body.issue.number, body.lable.name);
        } else resp = 'Unknwon issue action: {0}'.translate().format(body.action);
        return resp;
    },
    async issue_comment(body) {
        let resp;
        if (body.action === 'created') {
            resp = '{0} commented on {1}#{2}'.translate().format(body.comment.user.login, body.repository.full_name, body.issue.number);
            resp += `\n${body.comment.body}`;
        }
        return resp;
    },
    async pull_request(body) {
        let resp;
        if (body.action === 'opened') {
            resp = '{0} opened an pull request for {1}#{2}'.translate().format(body.issue.user.login, body.repository.full_name, body.issue.number);
            resp = `${resp}\n${body.issue.title}`;
        } else if (body.action === 'created') {
            resp = '{0} commented on {1}#{2}'.translate().format(body.comment.user.login, body.repository.full_name, body.issue.number);
            resp += `\n${body.comment.body}`;
        } else if (body.action === 'assigned') {
            resp = '{0}#{1}: Assigned {2}'.translate().format(body.repository.full_name, body.issue.number, body.assignee.login);
        } else if (body.action === 'unassigned') {
            resp = '{0}#{1}: Unassigned {2}'.translate().format(body.repository.full_name, body.issue.number, body.assignee.login);
        } else if (body.action === 'review_requested') {
            resp = '{0}#{1}: Request a review'.translate().format(body.repository.full_name, body.issue.number);
        } else if (body.action === 'closed' && !body.merged) {
            resp = '{0} closed {1}#{2}.'.translate().format(body.sender.login, body.repository.full_name, body.issue.number);
        } else if (['reopened', 'locked', 'unlocked'].includes(body.action)) {
            resp = '{0} {1} PR:{2}#{3}'.translate().format(body.sender.login, body.action, body.repository.full_name, body.issue.number);
        } else resp = 'Unknwon pull request action: {0}'.translate().format(body.action);
        return resp;
    },
    async watch() { },
    async star(body) {
        if (body.action === 'created') {
            if (collStar) {
                if (await collStar.findOne({
                    user: body.sender.login, repo: body.repository.full_name,
                })) return;
                await collStar.insertOne({
                    user: body.sender.login, repo: body.repository.full_name,
                });
            }
            return '{0} starred {1} (total {2} stargazers)'
                .translate().format(
                    body.sender.login, body.repository.full_name, body.repository.stargazers_count,
                );
        }
    },
    async check_run() { },
    async check_suite() { },
    async repository_vulnerability_alert() { },
    async status(body) {
        return;
        const resp = '{0}:{1} {2}'.translate().format(body.context, body.state, body.repository.full_name);
        return `${resp}\n${body.description}`;
    },
};
exports.init = (item) => {
    app = item.app;
    config = item.config;
    if (item.db) collStar = item.db.collection('github_event_star');
    else console.warn('Use MongoDB for full features');
    item.router.post('/github', async (ctx) => {
        try {
            const event = ctx.request.headers['x-github-event']; let
                body;
            if (typeof ctx.request.body.payload === 'string') body = JSON.parse(ctx.request.body.payload);
            else body = ctx.request.body;
            if (!events[event]) events[event] = (b) => `${b.repository.full_name} triggered an unknown event: ${event}`;
            const reponame = body.repository.full_name;
            let cnt = 0;
            const message = await events[event](body);
            if (message) {
                if (config.watch[reponame.toLowerCase()]) {
                    for (const groupId of config.watch[reponame.toLowerCase()]) {
                        app.sender.sendGroupMsgAsync(groupId, message);
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
};
async function _add({ meta }, repo) {
    if (!repo) return meta.$send('缺少参数。');
    repo = repo.toLowerCase();
    if (config.watch[repo]) config.watch[repo].push(meta.groupId);
    else config.watch[repo] = [meta.groupId];
    meta.$send(`Watching ${repo}
(请创建 webhook 投递至 http://2.masnn.io:6701/github ，格式 application/json )`);
}
async function _info({ meta }) {
    return await meta.$send('Use github -h for help.');
}
exports.apply = () => {
    app.command('github', 'Github').action(_info);
    app.command('github.listen <repo>', '监听一个Repository的事件').action(_add);
};
