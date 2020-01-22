'use strict';
let config = { watch: [] };
let CQ = null;
const events = {
    push(body) {
        let resp = 'Recent commit to {0} by {1}'.translate().format(body.repository.full_name, body.pusher.name);
        for (let commit of body.commits) {
            let det = [];
            if (commit.added.length) det.push(`${commit.added.length}+`);
            if (commit.removed.length) det.push(`${commit.removed.length}-`);
            if (commit.modified.length) det.push(`${commit.modified.length}M`);
            resp += `\n${commit.id.substr(0, 6)} ${commit.message.replace(/\n/g, ' ')} (${det.join(' ')})`;
        }
        return resp;
    },
    issues(body) {
        let resp;
        if (body.action == 'opened') {
            resp = '{0} opened an issue for {1}#{2}'.translate().format(body.issue.user.login, body.repository.full_name, body.issue.id);
            resp = resp + '\n' + body.issue.title;
        } else if (body.action == 'created') {
            resp = '{0} commented on {1}#{2}'.translate().format(body.comment.user.login, body.repository.full_name, body.issue.id);
            resp += '\n' + body.comment.body;
        } else if (body.action == 'assigned') {
            resp = '{0}#{1}: Assigned {2}'.translate().format(body.repository.full_name, body.issue.id, body.assignee.login);
        } else if (body.action == 'unassigned') {
            resp = '{0}#{1}: Unassigned {2}'.translate().format(body.repository.full_name, body.issue.id, body.assignee.login);
        } else if (body.action == 'closed') {
            resp = '{0} closed {1}#{2}.'.translate().format(body.sender.login, body.repository.full_name, body.issue.id);
        } else resp = 'Unknwon issue action: {0}'.translate().format(body.action);
        return resp;
    },
    check_run(body) {
    },
    check_suite(body) {
    }
};
exports.init = function (item) {
    CQ = item.CQ;
    config = item.config;
    item.router.post('/github', async ctx => {
        try {
            let event = ctx.request.headers['x-github-event'];
            if (!events[event])
                events[event] = body => `${body.repository.full_name} triggered an unknown event: ${event}`;
            let reponame = ctx.request.body.repository.full_name;
            let owner = ctx.request.body.repository.owner.login;
            let cnt = 0;
            let message = events[event](ctx.request.body);
            if (message)
                for (let i of config.watch) {
                    let hit = false
                        || i.fliter.type == 'repo' && (new RegExp(i.fliter.value.replace(/\*/i, '.*')).test(reponame))
                        || i.fliter.type == 'owner' && (new RegExp(i.fliter.value.replace(/\*/i, '.*')).test(owner));
                    if (hit) {
                        if (typeof i.target == 'string' || typeof i.target == 'number') {
                            CQ('send_group_msg', { group_id: i.target, message });
                            cnt++;
                        } else
                            for (let group_id of i.target) {
                                CQ('send_group_msg', { group_id, message });
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
exports.message = (e, context) => {
    try {
        if (context.raw_message.startsWith('/repo add')) {
            let result = context.raw_message.split(' ');
            result.shift();
            result.shift();
            let [reponame] = result;
            config.watch.push({ fliter: { type: 'repo', value: reponame }, target: context.group_id });
            return `Watching ${reponame}
            (You have to create a webhook to http://2.masnn.io:6701/github for your repo.)`;
        }
    } catch (e) {
        console.log(e);
    }
};
exports.info = {
    id: 'github',
    author: 'masnn',
    hidden: false,
    contacts: {
        email: 'masnn0@outlook.com',
        github: 'https://github.com/masnn/'
    },
    description: 'Github',
    usage: ''
};
