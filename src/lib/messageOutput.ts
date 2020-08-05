import { CQCode } from 'koishi';

export default function messageOutput(msg: string) {
    const parsed = CQCode.parseAll(msg);
    let message = '';
    for (const i of parsed) {
        if (typeof i === 'string') message += i;
        else if (i.type === 'text') message += i.data.text;
        else if (i.type === 'image') message += `[image ${(i.data.url as string).split('?')[0]} ]`;
        else if (i.type === 'at') message += `@${i.data.qq}`;
        else if (i.type === 'face') message += `[face${i.data.id}]`;
        else message += JSON.stringify(i);
    }
    return message;
}
