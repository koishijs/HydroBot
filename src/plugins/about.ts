import { App } from 'koishi';

export async function apply(app: App) {
    app.command('about', 'About this bot')
        .action(() => `地址： https://github.com/masnn/qqbot
打钱：[CQ:image,file=https://img.masnn.io:38443/images/2019/03/15/alipay.png]`);
}
