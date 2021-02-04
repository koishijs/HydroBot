import { Context, Channel, User } from 'koishi-core';
import { apply as KoishiPluginEval, Config as KoishiPluginEvalConfig } from 'koishi-plugin-eval';
import { apply as KoishiPluginEvalAddons, Config as KoishiPluginEvalAddonsConfig } from 'koishi-plugin-eval-addons';
import { sleep } from 'koishi-utils';

interface Config {
    eval?: KoishiPluginEvalConfig,
    addons?: KoishiPluginEvalAddonsConfig,
}

export function apply(ctx: Context, config: Config) {
    ctx.plugin(KoishiPluginEval, config.eval);
    if (config.addons) ctx.plugin(KoishiPluginEvalAddons, config.addons);

    ctx.command('evaluate')
        .option('i', 'Output as image', { hidden: true })
        .userFields(User.fields)
        .channelFields(Channel.fields)
        .check(({ session }) => {
            if (!session._sudo) return;
            const cmd = session.$argv.args[0].replace('eval ', '');
            // @ts-expect-error
            if (session.$argv.options.i) session.execute(`_.eval -i ${cmd}`);
            session.execute(`_.eval ${cmd}`);
            return '';
        });

    ctx.command('#', 'utils', { hidden: true });

    ctx.command('#.silent <command:text>')
        .action(({ session }, command) => session.executeSilent(command));

    ctx.command('#.sleep <duration> <command:text>')
        .action(async ({ session }, _duration, command) => {
            let duration = Math.min(10000, +_duration);
            if (Number.isNaN(duration) || !duration) duration = 0;
            await sleep(duration);
            await session.execute(command);
        });
}
