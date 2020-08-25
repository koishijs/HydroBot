/* eslint-disable no-irregular-whitespace */
import { App } from 'koishi-core';
import { apply as KoishiPluginTeach, Config } from 'koishi-plugin-teach';

const cheatSheet = (p: string, authority: number) => `\
教学系统基本用法：
　添加问答：${p} 问题 回答
　搜索回答：${p}${p} 问题
　搜索问题：${p}${p} ~ 回答
　查看问答：${p}id
　修改问题：${p}id 问题
　修改回答：${p}id ~ 回答
　删除问答：${p}id -r${authority >= 2 ? `
　批量查看：${p}${p}id` : ''}
搜索选项：
　管道语法：　　　|
　结果页码：　　　/ page
　禁用递归查询：　-R${authority >= 3 ? `
　正则+合并结果：${p}${p}${p}` : ''}
上下文选项：
　允许本群：　　　-e
　禁止本群：　　　-d${authority >= 3 ? `
　全局允许：　　　-E
　全局禁止：　　　-D
　设置群号：　　　-g id
　无视上下文搜索：-G` : ''}
问答选项：${authority >= 3 ? `
　锁定问答：　　　-f/-F
　教学者代行：　　-s/-S` : ''}${authority >= 2 ? `
　设置问题作者：　-w uid
　设置为匿名：　　-W` : ''}
　忽略智能提示：　-i
　重定向：　　　　=>
匹配规则：${authority >= 3 ? `
　正则表达式：　　-x/-X` : ''}
　严格匹配权重：　-p prob
　称呼匹配权重：　-P prob
　设置起始时间：　-t time
　设置结束时间：　-T time
前置与后继：
　设置前置问题：　< id
　添加前置问题：　<< id
　设置后继问题：　> id
　添加后继问题：　>> id
　上下文触发后继：-c/-C
　前置生效时间：　-z secs
　创建新问答并作为后继：>#
回退功能：
　查看近期改动：　-v
　回退近期改动：　-V
　设置查看区间：　-l/-L
特殊语法：
　%%：一个普通的 % 字符
　%0：收到的原文本
　%n：分条发送
　%a：@说话人
　%m：@四季酱
　%s：说话人的名字
　%{}: 指令插值`;

export function apply(app: App, config: Config) {
    app.plugin(KoishiPluginTeach, config);

    const command = app.command('teach', { authority: 1 });

    command._options.remove.authority = 2;
    command._options.search.authority = 2;
    command._options.writer.authority = 2;
    command._options.frozen.authority = 4;
    command._options.disableGlobal.authority = 4;
    command._options.enableGlobal.authority = 4;
    command._options.groups.authority = 4;
    command
        .userFields(['authority'])
        .usage(({ $user }) => cheatSheet(config.prefix, $user.authority));
}
