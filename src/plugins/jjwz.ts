import { Context } from 'koishi-core';

declare module 'koishi-core' {
    interface Channel {
        jjwz: [number, string][]
    }
}

export function apply(ctx: Context) {
    ctx.command('jjwz', '绝句文章');
    ctx.command('jjwz.add <content:text>', '创建/添加')
        .channelFields(['jjwz'])
        .userFields(['id'])
        .action(async ({ session }, content) => {
            if (content.length > 7) return '你怎么写这么长';
            if (!session.channel.jjwz) session.channel.jjwz = [];
            else if ((session.channel.jjwz[session.channel.jjwz.length - 1] || [])[0] === session.user.id) return '你不能连续添加';
            session.channel.jjwz.push([session.user.id, content]);
            return `${session.channel.jjwz.map((i) => i[1]).join('')}...`;
        });

    ctx.command('jjwz.end', '结束')
        .channelFields(['jjwz'])
        .userFields(['id'])
        .action(async ({ session }) => {
            if (!session.channel.jjwz) return '还未开始';
            session.channel.jjwz = null;
            return session.channel.jjwz.map((i) => i[1]).join('');
        });

    ctx.command('jjwz.edit <content:text>', '编辑')
        .channelFields(['jjwz'])
        .userFields(['id'])
        .action(async ({ session }, content) => {
            if (!session.channel.jjwz) return '还未开始'; if (content.length > 7) return '你怎么写这么长';
            if (session.channel.jjwz[session.channel.jjwz.length - 1][0] !== session.user.id) return '上一条不是你所编辑';
            session.channel.jjwz[session.channel.jjwz.length - 1][1] = content;
            return `${session.channel.jjwz.map((i) => i[1]).join('')}...`;
        });

    ctx.command('jjwz.del', '删除')
        .channelFields(['jjwz'])
        .userFields(['id'])
        .action(async ({ session }) => {
            if (!session.channel.jjwz) return '还未开始';
            if (session.channel.jjwz[session.channel.jjwz.length - 1][0] !== session.user.id) return '上一条不是你所编辑';
            session.channel.jjwz.pop();
            return `${session.channel.jjwz.map((i) => i[1]).join('')}...`;
        });
}
