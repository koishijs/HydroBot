import { readFileSync, writeFileSync } from 'fs-extra';

const tasks: [string, string, ...string[][]][] = [
    [
        'koishi-core/dist/command', '1',
        [
            'append', 'throw error;',
            `if (typeof error === 'string'){
                session.$user.usage[argv.command.name]--;
                return session.$send(error);
            }
            session.$send(error.message);`,
        ],
    ],
];

async function hack() {
    for (const [filename, version, ...changes] of tasks) {
        const file = require.resolve(filename);
        if (!file) console.warn(`Unable to hack ${filename}: file not found`);
        let content = readFileSync(file).toString();
        if (content.includes(`// Hacked v${version}`)) continue;
        for (const [type, arg0, arg1] of changes) {
            if (type === 'replace') {
                content = content.replace(arg0, arg1);
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
