import { readFileSync, writeFileSync } from 'fs-extra';

const tasks = [
    [
        'koishi-core/dist/command', 'append', '1', 'throw error;',
        `if (typeof error === 'string'){
            session.$user.usage[argv.command.name]--;
            return session.$send(error);
        }
        session.$send(error.message);`,
    ],
];

async function hack() {
    for (const [filename, type, version, arg0, arg1] of tasks) {
        const file = require.resolve(filename);
        if (!file) console.warn(`Unable to hack ${filename}: file not found`);
        let content = readFileSync(file).toString();
        if (content.includes(`// Hacked v${version}`)) continue;
        if (type === 'replace') {
            content = content.replace(arg0, arg1);
        } else if (type === 'append') {
            content = content.replace(arg0, arg0 + arg1);
        }
        content = `// Hacked v${version}\n${content}`;
        writeFileSync(file, content);
    }
}

export = hack;

if (!module.parent) hack();
