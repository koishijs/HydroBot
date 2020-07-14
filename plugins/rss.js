const RssFeedEmitter = require('rss-feed-emitter');

const feeder = new RssFeedEmitter({ skipFirstLoad: true });
feeder.on('error', console.error);
let config = {};
let app = null;

exports.init = (item) => {
    app = item.app;
    config = item.config;
    for (const url in config) {
        feeder.add({ url });
    }
    feeder.on('new-item', (payload) => {
        console.log(payload);
        const source = payload.meta.link.toLowerCase();
        const message = `${payload.meta.title} (${payload.author})\n${payload.title}`;
        if (config[source]) {
            for (const groupId of config[source]) {
                app.sender.sendGroupMsgAsync(groupId, message);
            }
        }
    });
};

async function _add({ meta }, url) {
    if (!url) return meta.$send('缺少参数。');
    url = url.toLowerCase();
    if (config[url]) config[url].push(meta.groupId);
    else {
        config[url] = [meta.groupId];
        feeder.add({ url });
    }
    meta.$send(`Watching ${url}`);
}

async function _cancel({ meta }, url) {
    if (!url) return meta.$send('缺少参数。');
    url = url.toLowerCase();
    if (config[url]) {
        const index = config[url].indexOf(meta.groupId);
        if (index > -1) config[url].splice(index, 1);
    }
    meta.$send(`Cancelled ${url}`);
}

async function _info({ meta }) {
    return await meta.$send('Use rss -h for help.');
}

exports.apply = () => {
    app.command('rss', 'Rss').action(_info);
    app.command('rss.subscribe <repo>', 'Subscribe a rss url').action(_add);
    app.command('rss.cancel <repo>', 'Cancel').action(_cancel);
};
