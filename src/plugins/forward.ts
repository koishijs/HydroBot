import { App } from 'koishi-core';

export function apply(app: App) {
    app.once('connect', async () => {
        const c = app.database.db.collection('forward');
        await c.createIndex({ from: 1 });
        await c.createIndex({ to: 1 });

        app.on('message', async (session) => {
            const targets = await c.find({
                $or: [
                    { from: session.groupId, out: true }, { to: session.groupId, in: true },
                ],
            }).toArray();
            for (const target of targets) {
                if (target.from === session.groupId) session.$bot.sendGroupMsg(target.to, session.message);
                else session.$bot.sendGroupMsg(target.from, session.message);
            }
        });

        app.command('link <target>', 'Create link', { authority: 4 })
            .option('in', '-i, --in')
            .option('out', '-o, --out')
            .action(async ({ session, options }, target) => {
                let _target;
                if (!Number.isNaN(+target)) _target = +target;
                else _target = target;
                const i = await c.findOne({ from: session.groupId, to: _target });
                if (i) {
                    await c.updateOne(
                        { from: session.groupId, to: _target },
                        { $set: { in: !!options.out, out: !!options.in } },
                    );
                } else {
                    await c.updateOne(
                        { from: _target, to: session.groupId },
                        { $set: { in: !!options.in, out: !!options.out } },
                        { upsert: true },
                    );
                }
                return 'Done.';
            });
    });
}
