import { Context } from 'koishi-core';
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
        .before((session) => {
            if (!session._sudo) return false;
            if (session.$argv.options.i) session.$execute(`sudo _.eval -i ${session.$argv.args[0]}`);
            session.$execute(`sudo _.eval ${session.$argv.args[0]}`);
        });

    ctx.command('#.silent <command...>')
        .action(async ({ session }, command) => {
            await session.$executeSilent(command);
        });

    ctx.command('#.sleep <duration> <command...>')
        .action(async ({ session }, _duration, command) => {
            let duration = Math.min(10000, +_duration);
            if (Number.isNaN(duration) || !duration) duration = 0;
            await sleep(duration);
            await session.$execute(command);
        });
}
