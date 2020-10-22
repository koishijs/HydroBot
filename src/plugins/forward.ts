import { App } from 'koishi-core';

export function apply(app: App) {
    app.on('connect', async () => {
        const c = app.database.db.collection('forward');
        await c.createIndex({ from: 1 });
        await c.createIndex({ to: 1 });

        app.on('message', async (session) => {
            const currentSession = `${session.$bot.selfId}/${session.groupId}`;
            const targets = await c.find({
                $or: [
                    { from: currentSession, in: true }, { to: currentSession, out: true },
                ],
            }).toArray();
            const username = session.sender.card || session.sender.nickname;
            const message = `${username}: ${session.message}`;
            for (const target of targets) {
                // eslint-disable-next-line prefer-const
                let [assignee, chatId] = (target.from === currentSession ? target.to : target.from).split('/');
                if (!Number.isNaN(parseInt(chatId, 10))) chatId = parseInt(chatId, 10);
                session.$app.bots[assignee].sendGroupMsg(chatId, message);
            }
        });

        app.command('link <target>', 'Create link', { authority: 4 })
            .option('in', '-i, --in')
            .option('out', '-o, --out')
            .action(async ({ session, options }, to) => {
                const from = `${session.$bot.selfId}/${session.groupId}`;
                const i = await c.findOne({ from, to });
                if (i) {
                    await c.updateOne(
                        { from, to },
                        { $set: { in: !!options.out, out: !!options.in } },
                    );
                } else {
                    await c.updateOne(
                        { from: to, to: from },
                        { $set: { in: !!options.in, out: !!options.out } },
                        { upsert: true },
                    );
                }
                return 'Done.';
            });
    });
}
