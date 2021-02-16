import { existsSync, readFileSync, writeFileSync } from 'fs-extra';
import { sep } from 'path';

const tasks: [string, number | string, ...string[][]][] = [
    [
        'koishi-core', 2,
        [
            'append', 'throw error2;',
            `if (typeof error2 === 'string'){
                session.$user.usage[argv.command.name]--;
                return session.send(error2);
            }
            session.send(error2.message);`,
        ],
    ],
    [
        'koishi-plugin-teach', 3,
        ['append', 'state.dialogue = dialogue;', '\nsession._dialogue = dialogue;'],
        ['replace', ".toLowerCase().replace(/\\s+/g, '')", ''],
        ['replace', `        if (index === 0)
            message = message.replace(/^[()\\[\\]]*/, '');
        if (index === arr.length - 1)
            message = message.replace(/[\\.,?!()\\[\\]~]*$/, '');`, ''],
    ],
];

async function hack() {
    console.log('Running Hack');
    for (const [filename, version, ...changes] of tasks) {
        let file;
        try {
            file = require.resolve(filename);
        } catch (e) {
            const name = filename.split('/')[0];
            file = require.resolve(name).split(sep);
            file.pop();
            file = `${file.join(sep)}${sep}${filename.split('/')[1]}`;
        }
        let content = existsSync(file) ? readFileSync(file).toString() : '';
        if (typeof version === 'string') {
            writeFileSync(file, version);
            continue;
        }
        const first = content.split('\n')[0];
        const ver = parseInt(first.split('// Hacked v')[1], 10);
        if (ver >= version) continue;
        for (const [type, arg0, arg1, arg2] of changes) {
            if (type === 'replace') {
                content = content.replace(arg0, arg1);
            } else if (type === 'replaceBetween') {
                const [before, mid] = content.split(arg0);
                const [, after] = mid.split(arg1);
                content = before + arg0 + arg2 + arg1 + after;
            } else if (type === 'append') {
                content = content.replace(arg0, arg0 + arg1);
            } else if (type === 'remove') {
                content = content.replace(arg0, '');
            }
        }
        content = `// Hacked v${version}\n${content}`;
        writeFileSync(file, content);
    }
}

export = hack;

if (!module.parent) hack();
