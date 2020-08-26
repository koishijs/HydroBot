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
    ],
    [
        'koishi-core/dist/command', 2,
        [
            'append', "await this.app.serial(session, 'command', argv);",
            "if (this.getConfig('cost')) session.$user.coin -= this.getConfig('cost');",
        ],
    ],
    [
        'koishi-plugin-mongo', 1,
        [
            'replace', `if ($set.timers) {
            for (const key in $set.timers) {
                if (key === '$date')
                    $set['timers._date'] = $set.timers.$date;
                else
                    $set[\`timers.\${key.replace(/\\./gmi, '_')}\`] = $set.timers[key];
            }
        }
        if ($set.usage) {
            for (const key in $set.usage) {
                if (key === '$date')
                    $set['usage._date'] = $set.usage.$date;
                else
                    $set[\`usage.\${key.replace(/\\./gmi, '_')}\`] = $set.usage[key];
            }
        }
        delete $set.timers;
        delete $set.usage;
            `, `\
        delete $set.timers;
        delete $set.usage;
        if (data.timers) {
            $set.timers = {};
            for (const key in data.timers) {
                if (key === '$date') $set.timer._date = data.timers.$date;
                else $set.timer[key.replace(/\\./gmi, '_')] = data.timers[key];
            }
        }
        if (data.usage) {
            $set.usage = {};
            for (const key in data.usage) {
                if (key === '$date') $set.usage._date = data.usage.$date;
                else $set.usage[key.replace(/\\./gmi, '_')] = data.usage[key];
            }
        }`,
        ],
    ],
];

async function hack() {
    for (const [filename, version, ...changes] of tasks) {
        const file = require.resolve(filename);
        if (!file) console.warn(`Unable to hack ${filename}: file not found`);
        let content = readFileSync(file).toString();
        const first = content.split('\n')[0];
        const ver = parseInt(first.split('// Hacked v')[1], 10);
        if (ver >= version) continue;
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
