import { readFileSync, writeFileSync } from 'fs-extra';

const tasks: [string, number, ...string[][]][] = [
    [
        'koishi-core/dist/command', 1,
        [
            'append', 'throw error;',
            `if (typeof error === 'string'){
                session.$user.usage[argv.command.name]--;
                return session.$send(error);
            }
            session.$send(error.message);`,
        ],
        [
            'replace', 'names = [option.name];',
            'names = [koishi_utils_1.paramCase(option.name)];',
        ],
    ],
    [
        'koishi-plugin-teach', 1,
        ['append', '// send answers', 'session._dialogue = dialogue;'],
    ],
    [
        'koishi-core/dist/plugins/help', 1,
        [
            'append',
            "output += '  ' + config.description;",
            "if (config.cost) output += ' (' + config.cost+')';",
        ],
        [
            'append',
            `if (command.config.authority > 1) {
            output.push(\`最低权限：\${command.config.authority} 级。\`);
        }`,
            // eslint-disable-next-line no-template-curly-in-string
            'if (command.config.cost) output.push(`命令花费：${command.config.cost}`)',
        ],
        [
            'replace',
            "'可用的子指令有'",
            "'可用的子指令有（括号内为命令花费）'",
        ],
    ],
];

async function hack() {
    console.log('Running Hack');
    for (const [filename, version, ...changes] of tasks) {
        const file = require.resolve(filename);
        if (!file) console.warn(`Unable to hack ${filename}: file not found`);
        let content = readFileSync(file).toString();
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
