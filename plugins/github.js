let config = { watch: [] };
let app = null;
let collStar;

const events = {
    async push(body) {
        let resp = `Recent commit to ${body.repository.full_name}${
            body.ref === 'refs/heads/master' ? '' : `: ${body.ref}`} by ${body.pusher.name}`;
        for (const commit of body.commits) {
            const det = [];
            if (commit.added.length) det.push(`${commit.added.length}+`);
            if (commit.removed.length) det.push(`${commit.removed.length}-`);
            if (commit.modified.length) det.push(`${commit.modified.length}M`);
            resp += `\n${commit.id.substr(0, 6)} ${commit.message.replace(/\n/g, '\r\n')} (${det.join(' ')})`;
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
            resp = `${body.comment.user.login} commented on ${body.repository.full_name}#${body.issue.number}`;
            resp += `\n${body.comment.body}`;
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
        } else resp = `Unknwon pull request action: ${body.action}`;
        return resp;
    },
    async watch() { },
    async project_card() { },
    async project_column() { },
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
            return `${body.sender.login} starred ${body.repository.full_name} (total ${body.repository.stargazers_count} stargazers)`;
        }
    },
    async check_run() { },
    async check_suite() { },
    async repository_vulnerability_alert() { },
    async status() { },
};
exports.init = (item) => {
    app = item.app;
    config = item.config;
    if (item.db) collStar = item.db.collection('github_event_star');
    else console.warn('Use MongoDB for full features');
    item.router.post('/github', async (ctx) => {
        try {
            const event = ctx.request.headers['x-github-event'];
            let body;
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
async function _cancel({ meta }, repo) {
    if (!repo) return meta.$send('缺少参数。');
    repo = repo.toLowerCase();
    if (config.watch[repo]) {
        const index = config.watch[repo].indexOf(meta.groupId);
        if (index > -1) config.watch[repo].splice(index, 1);
    }
    meta.$send(`Cancelled ${repo}`);
}
async function _info({ meta }) {
    return await meta.$send('Use github -h for help.');
}
exports.apply = () => {
    app.command('github', 'Github').action(_info);
    app.command('github.listen <repo>', '监听一个Repository的事件').action(_add);
    app.command('github.cancel <repo>', '取消一个Repository的事件').action(_cancel);
};
