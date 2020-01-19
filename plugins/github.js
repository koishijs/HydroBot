'use strict';
let config = { watch: [] };
let CQ = null;
function generate(body) {
    if (body.ref)
        return 'New commit to {0}\n {1} {2}'.translate()
            .format(body.repository.full_name, `${body.before.substr(0, 6)}->${body.after.substr(0, 6)}`, body.compare)
    else return 'Unknown event to {0}'.translate()
        .format(body.repository.full_name)
}
exports.init = function (item) {
    CQ = item.CQ;
    config = item.config;
    item.router.post('/github', async ctx => {
        try {
            let reponame = ctx.request.body.repository.full_name;
            let owner = ctx.request.body.repository.owner.login;
            for (let i of config.watch) {
                let hit = false
                    || i.fliter.type == 'repo' && (new RegExp(i.fliter.value.replace(/\*/i, '.*')).test(reponame))
                    || i.fliter.type == 'owner' && (new RegExp(i.fliter.value.replace(/\*/i, '.*')).test(owner));
                console.log(i, hit);
                if (hit) {
                    if (typeof i.target == 'string')
                        CQ('send_group_msg', { group_id: i.target, message: generate(ctx.request.body) })
                    else
                        for (let group_id of i.target)
                            CQ('send_group_msg', { group_id, message: generate(ctx.request.body) })
                }
                ctx.body = 'OK';
            }
        } catch (e) {
            console.log(e, ctx.request.body);
        }
    });
}
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
}
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
