const { getPage } = require('../html2img');

function _url({ meta }, message) {
    const url = message.trim();
    console.log(url);
    if (!url) return meta.$send('请输入要打开的 URL。');
    return getPage(url)
        .catch((e) => meta.$send(`${url}\n${e.toString()}`))
        .then((image) => meta.$send(`[CQ:image,file=base64://${image}]`));
}

exports.register = ({ app }) => {
    app.command('page <url...>', 'Get page')
        .action(_url);
};
