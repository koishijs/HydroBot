const { getPage } = require('../html2img');

function _url({ meta, options }, message) {
    const url = message.trim();
    console.log(url);
    if (!url) return meta.$send('请输入要打开的 URL。');
    const t = options.viewport.split('x');
    if (t.length !== 2) return meta.$send('Invalid vieport');
    return getPage(url, options.full, options.viewport)
        .catch((e) => meta.$send(`${e.toString()} at ${url}`))
        .then((image) => meta.$send(`[CQ:image,file=base64://${image}]`));
}

exports.apply = (app) => {
    app.command('page <url...>', 'Get page', { minInterval: 1000 })
        .option('--full', 'Full page')
        .option('--viewport <viewport>', '指定Viewport', { default: '1600x900' })
        .action(_url);
};
