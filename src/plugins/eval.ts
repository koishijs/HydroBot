import { Context } from 'koishi-core';
import { apply as KoishiPluginEval, Config as KoishiPluginEvalConfig } from 'koishi-plugin-eval';
import { apply as KoishiPluginEvalAddons, Config as KoishiPluginEvalAddonsConfig } from 'koishi-plugin-eval-addons';

interface Config {
    eval?: KoishiPluginEvalConfig,
    addons?: KoishiPluginEvalAddonsConfig,
}

export function apply(ctx: Context, config: Config) {
    ctx.plugin(KoishiPluginEval, config.eval);
    if (config.addons) ctx.plugin(KoishiPluginEvalAddons, config.addons);
}
