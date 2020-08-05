import Axios from 'axios';
import { App } from 'koishi';
import { text2png } from '../lib/graph';

const LANGS = {
    c: {
        type: 'compiler',
        compile: ['/usr/bin/gcc', '-O2', '-Wall', '-std=c99', '-o', 'code', 'foo.c', '-lm'],
        code_file: 'foo.c',
        execute: ['/w/code'],
    },
    cc: {
        type: 'compiler',
        compile: ['/usr/bin/g++-7', '-O2', '-Wall', '-std=c++11', '-o', 'code', 'foo.cc', '-lm'],
        code_file: 'foo.cc',
        execute: ['/w/code'],
    },
    pas: {
        type: 'compiler',
        compile: ['/usr/bin/fpc', '-O2', '-o/w/code', 'foo.pas'],
        code_file: 'foo.pas',
        execute: ['/w/code'],
    },
    py: {
        type: 'interpreter',
        code_file: 'foo.py',
        execute: ['/usr/bin/python', 'foo.py'],
    },
    py2: {
        type: 'interpreter',
        code_file: 'foo.py',
        execute: ['/usr/bin/python', 'foo.py'],
    },
    py3: {
        type: 'interpreter',
        code_file: 'foo.py',
        execute: ['/usr/bin/python3', 'foo.py'],
    },
    java: {
        type: 'compiler',
        compile: ['/usr/bin/javac', '-d', '/w', '-encoding', 'utf8', './Main.java'],
        code_file: 'Main.java',
        execute: ['/usr/bin/java', 'Main'],
    },
    php: {
        type: 'interpreter',
        code_file: 'foo.php',
        execute: ['/usr/bin/php', 'foo.php'],
    },
    rs: {
        type: 'compiler',
        compile: ['/usr/bin/rustc', '-O', '-o', '/w/foo', '/w/foo.rs'],
        code_file: 'foo.rs',
        execute: ['/w/foo'],
    },
    hs: {
        type: 'compiler',
        compile: ['/usr/bin/ghc', '-O', '-outputdir', '/tmp', '-o', 'foo', 'foo.hs'],
        code_file: 'foo.hs',
        execute: ['/w/foo'],
    },
    js: {
        type: 'interpreter',
        code_file: 'foo.js',
        execute: ['/usr/bin/jsc', '/w/foo.js'],
    },
    go: {
        type: 'compiler',
        compile: ['/usr/bin/go', 'build', '-o', 'foo', 'foo.go'],
        code_file: 'foo.go',
        execute: ['/w/foo'],
    },
    rb: {
        type: 'interpreter',
        code_file: 'foo.rb',
        execute: ['/usr/bin/ruby', 'foo.rb'],
    },
    sh: {
        type: 'interpreter',
        code_file: 'foo.sh',
        execute: ['/bin/bash', 'foo.sh'],
    },
    cs: {
        type: 'compiler',
        compile: ['/usr/bin/mcs', '-optimize+', '-out:/w/foo', '/w/foo.cs'],
        code_file: 'foo.cs',
        execute: ['/usr/bin/mono', 'foo'],
    },
};
const env = ['PATH=/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin', 'HOME=/w'];
const axios = Axios.create({ baseURL: 'http://localhost:5051' });

async function _post(args: string[], {
    time_limit_ms = 5000,
    memory_limit_mb = 256,
    process_limit = 32,
    stdin = '', copyIn = {}, copyOut = [], copyOutCached = null,
} = {}) {
    let result;
    let body;
    try {
        body = {
            cmd: [{
                args,
                env,
                files: [
                    stdin ? { src: stdin } : { content: '' },
                    { name: 'stdout', max: 20480 },
                    { name: 'stderr', max: 20480 },
                ],
                cpuLimit: time_limit_ms * 1000 * 1000,
                readCpuLimit: time_limit_ms * 1200 * 1000,
                memoryLimit: memory_limit_mb * 1024 * 1024,
                procLimit: process_limit,
                copyIn,
                copyOut,
                copyOutCached,
            }],
        };
        const res = await axios.post('/run', body);
        result = res.data[0];
    } catch (e) {
        console.log(e);
        throw e;
    }
    const ret: any = {
        status: result.status,
        time_usage_ms: result.time / 1000000,
        memory_usage_kb: result.memory / 1024,
        files: result.files,
    };
    result.files = result.files || {};
    ret.stdout = result.files.stdout || '';
    ret.stderr = result.files.stderr || '';
    if (result.error) {
        ret.error = result.error;
    }
    ret.files = result.files;
    if (result.fileIds) ret.fileIds = result.fileIds;
    return ret;
}

async function _run(code, lang, input) {
    const copyIn = {};
    const info = LANGS[lang];
    if (!LANGS[lang]) {
        return {
            status: 'SystemError',
            stdout: '不支持的语言',
            stderr: '目前支持sh,c,cc,pas,py2,py3,js,cs,hs,rs,rb,go,php,java',
        };
    }
    copyIn[info.code_file] = { content: code };
    if (info.type === 'compiler') {
        const {
            status, stdout, stderr, fileIds,
        } = await _post(
            info.compile, { copyIn, copyOutCached: ['code'] },
        );
        if (status !== 'Accepted') return { status: `Compile Error:${status}`, stdout, stderr };
        const res = await _post(
            info.execute, { copyIn: { code: { fileId: fileIds.code } } },
        );
        await axios.delete(`/file/${fileIds.code}`);
        return res;
    } if (info.type === 'interpreter') {
        return await _post(info.execute, { copyIn, stdin: input });
    }
}

async function run(code: string, lang: string, input: string) {
    const { status, stdout, stderr } = await _run(code, lang, input).catch((e) => ({
        status: 'SystemError',
        stdout: e.toString(),
        stderr: '',
    }));
    return (status === 'Accepted')
        ? `执行${lang}结果: \n${stdout}\n${stderr}`
        : `执行${lang}出错: ${status}\n${stdout}\n${stderr}`;
}

export const apply = (app: App) => {
    app.command('run <language> <code...>', '运行程序', { minInterval: 1000, showWarning: true }).alias('code')
        .option('-i, --input', '启用stdin')
        .option('-b, --base64', '传入base64编码的程序')
        .action(async ({ session, options }, lang, code) => {
            if (options.input) {
                await session.$prompt((session, next) => {

                });
            } else {
                const response = await run(code, lang, '');
                if (response.length > 512 || response.split('\n').length > 10) {
                    return `[CQ:image,file=base64://${text2png(response)}`;
                }
                return response;
            }
        });
};
