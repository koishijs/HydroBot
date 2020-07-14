const Axios = require('axios');

class ExecutorServer {
    constructor() {
        this.env = ['PATH=/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin', 'HOME=/w'];
        this.axios = Axios.create({ baseURL: 'http://localhost:5050' });
        this.langs = {
            c: {
                type: 'compiler',
                compile: ['/usr/bin/gcc', '-O2', '-Wall', '-std=c99', '-o', 'code', 'foo.c', '-lm'],
                code_file: 'foo.c',
                execute: ['/w/code'],
            },
            cc: {
                type: 'compiler',
                compile: ['/usr/bin/g++', '-O2', '-Wall', '-std=c++11', '-o', 'code', 'foo.cc', '-lm'],
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
    }

    async _post(args, {
        time_limit_ms = 5000,
        memory_limit_mb = 128,
        process_limit = 32,
        stdin, copyIn = {}, copyOut = [], copyOutCached,
    } = {}) {
        let result;
        let body;
        try {
            body = {
                cmd: [{
                    args,
                    env: this.env,
                    files: [
                        stdin ? { src: stdin } : { content: '' },
                        { name: 'stdout', max: 2048 },
                        { name: 'stderr', max: 2048 },
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
            const res = await this.axios.post('/run', body);
            result = res.data[0];
        } catch (e) {
            console.log(e);
            throw e;
        }
        const ret = {
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

    async _run(code, lang, input) {
        const copyIn = {};
        const info = this.langs[lang];
        if (!this.langs[lang]) return { status: 'SystemError', stdout: '不支持的语言', stderr: '目前支持sh,c,cc,pas,py2,py3,js,cs,hs,rs,rb,go,php,java' };
        copyIn[info.code_file] = { content: code };
        if (info.type === 'compiler') {
            const {
                status, stdout, stderr, fileIds,
            } = await this._post(
                info.compile, { copyIn, copyOutCached: ['code'] },
            );
            if (status !== 'Accepted') return { status: `Compile Error:${status}`, stdout, stderr };
            const res = await this._post(info.execute, { copyIn: { code: { fileId: fileIds.code } } });
            await this.axios.delete(`/file/${fileIds.code}`);
            return res;
        } if (info.type === 'interpreter') {
            return await this._post(info.execute, { copyIn });
        }
    }

    async run(lang, code) {
        const { status, stdout, stderr } = await this._run(code, lang, '').catch((e) => ({
            status: 'SystemError',
            stdout: e.toString(),
            stderr: '',
        }));
        if (status === 'Accepted') return `执行${lang}结果: \n${stdout}\n${stderr}`;
        return `执行${lang}出错: ${status}\n${stdout}\n${stderr}`;
    }
}

const executorserver = new ExecutorServer();
async function _run({ meta, options }, language, code) {
    if (options.runner === 'local') {
        meta.$send(await executorserver.run(language, code));
    } else return meta.$send('Unknown runner');
}

exports.register = ({ app }) => {
    app.command('run <language> <code...>', '运行程序', { minInterval: 10, showWarning: true }).alias('code')
        .option('-b, --base64', '传入base64编码的程序')
        .option('-r, --runner <runner>', '指定运行环境，仅支持local', { default: 'local' })
        .action(_run);
};
