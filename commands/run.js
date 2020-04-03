'use strict';
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
                execute: ['/w/code']
            },
            cc: {
                type: 'compiler',
                compile: ['/usr/bin/g++', '-O2', '-Wall', '-std=c++11', '-o', 'code', 'foo.cc', '-lm'],
                code_file: 'foo.cc',
                execute: ['/w/code']
            },
            pas: {
                type: 'compiler',
                compile: ['/usr/bin/fpc', '-O2', '-o/w/code', 'foo.pas'],
                code_file: 'foo.pas',
                execute: ['/w/code']
            },
            py: {
                type: 'interpreter',
                code_file: 'foo.py',
                execute: ['/usr/bin/python', 'foo.py']
            },
            py2: {
                type: 'interpreter',
                code_file: 'foo.py',
                execute: ['/usr/bin/python', 'foo.py']
            },
            py3: {
                type: 'interpreter',
                code_file: 'foo.py',
                execute: ['/usr/bin/python3', 'foo.py']
            }
        };
    }
    async _post(args, {
        time_limit_ms = 5000,
        memory_limit_mb = 128,
        process_limit = 32,
        stdin, copyIn = {}, copyOut = [], copyOutCached
    } = {}) {
        let result, body;
        try {
            body = {
                cmd: [{
                    args, env: this.env,
                    files: [
                        stdin ? { src: stdin } : { content: '' },
                        { name: 'stdout', max: 1024 },
                        { name: 'stderr', max: 1024 }
                    ],
                    cpuLimit: time_limit_ms * 1000 * 1000,
                    readCpuLimit: time_limit_ms * 1200 * 1000,
                    memoryLimit: memory_limit_mb * 1024 * 1024,
                    procLimit: process_limit,
                    copyIn, copyOut, copyOutCached
                }]
            };
            let res = await this.axios.post('/run', body);
            result = res.data[0];
        } catch (e) {
            console.log(e);
            throw e;
        }
        let ret = {
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
        let copyIn = {};
        let info = this.langs[lang];
        if (!this.langs[lang]) return { status: 'SystemError', stdout: '不支持的语言', stderr: '目前支持c,cc,pas,py2,py3' };
        copyIn[info.code_file] = { content: code };
        if (info.type == 'compiler') {
            let { status, stdout, stderr, fileIds } = await this._post(
                info.compile, { copyIn, copyOutCached: ['code'] }
            );
            if (status != 'Accepted') return { status: 'Compile Error', stdout, stderr };
            let res = await this._post(info.execute, { copyIn: { code: { fileId: fileIds.code } } });
            await this.axios.delete(`/file/${fileIds.code}`);
            return res;
        } else if (info.type == 'interpreter') {
            return await this._post(info.execute, { copyIn });
        }
    }
    async run(lang, code) {
        let { status, stdout, stderr } = await this._run(code, lang, '').catch(e => {
            return {
                status: 'SystemError',
                stdout: e.toString(),
                stderr: ''
            };
        });
        if (status == 'Accepted')
            return `执行${lang}结果: \n${stdout}\n${stderr}`;
        else
            return `执行${lang}出错: ${status}\n${stdout}\n${stderr}`;
    }
}

class Judge0 {
    constructor() {
        this.LANGS = {
            asm: 45,
            bash: 46,
            basic: 47,
            c: 50,
            cpp: 54,
            csharp: 51,
            cs: 51,
            d: 56,
            elixir: 57,
            ex: 57,
            erlang: 58,
            exe: 44,
            erl: 58,
            fortran: 59,
            go: 60,
            haskell: 61,
            hs: 61,
            java: 62,
            js: 63,
            lua: 64,
            lisp: 55,
            nodejs: 63,
            ocaml: 65,
            octave: 66,
            pascal: 67,
            prolog: 69,
            pas: 67,
            php: 68,
            python3: 71,
            py3: 71,
            py: 71,
            python2: 70,
            py2: 70,
            ruby: 72,
            rb: 72,
            rust: 73,
            rs: 73,
            sh: 46,
            ts: 74,
            typescript: 74,
            vb: 47
        };
        this.STATUS = {
            1: 'In Queue',
            2: 'Processing',
            3: 'Accepted',
            4: 'Wrong Answer',
            5: 'Time Limit Exceeded',
            6: 'Compilation Error',
            7: 'Runtime Error (SIGSEGV)',
            8: 'Runtime Error (SIGXFSZ)',
            9: 'Runtime Error (SIGFPE)',
            10: 'Runtime Error (SIGABRT)',
            11: 'Runtime Error (NZEC)',
            12: 'Runtime Error (Other)',
            13: 'Internal Error'
        };
        this.LANGNAME = name => {
            switch (name) {
            case 'rb': return 'ruby';
            case 'py': case 'python2': return 'python';
            case 'py3': return 'python3';
            case 'pl': return 'perl';
            case 'coffee': return 'coffeescript';
            case 'sh': return 'bash';
            case 'asm': return 'assembly';
            case 'cs': return 'csharp';
            case 'erl': return 'erlang';
            case 'rs': return 'rust';
            case 'ex': return 'elixir';
            case 'hs': return 'haskell';
            case 'js': return 'javascript';
            case 'ml': return 'ocaml';
            case 'cpp': case 'java': case 'go': case 'php': case 'c':
            case 'lua': case 'ruby': case 'perl': case 'd': case 'fortan':
            case 'coffeescript': case 'bash': case 'assembly': case 'csharp':
            case 'ocaml': case 'erlang': case 'rust': case 'elixir':
            case 'haskell': case 'javascript': case 'python': case 'python3': return name;
            default: return 'error';
            }
        };
    }
    async run(code, lang, input, base64 = false) {
        if (!this.LANGS[lang]) return `不支持的语言:${lang}`;
        let res;
        res = await Axios.post(`https://api.judge0.com/submissions/?base64_encoded=${base64}&wait=false`, {
            source_code: code,
            language_id: lang,
            stdin: input,
            wall_time_limit: 5
        });
        console.log(res.data.token);
        let result = { status_id: 1 };
        while (result.status_id <= 2) {
            result = (await Axios.get(`https://api.judge0.com/submissions/${res.data.token}?base64_encoded=true&fields=stdout,stderr,status_id,time,memory,compile_output,status`)).data;
            await new Promise((resolve) => {
                setTimeout(() => { resolve(); }, 300);
            });
            if (!result.status_id) result.status_id = 1;
        }
        console.log(result);
        if (result.status_id == 3)
            return `执行${this.langname(lang)}结果: \n${decode(result.stdout || '')}`;
        else
            return `执行${this.langname(lang)}出错: ${this.STATUS[result.status_id]}\n${decode(result.stderr || '')}`;
    }
}
const judge0 = new Judge0();
const executorserver = new ExecutorServer();
const decode = str => (Buffer.from(str, 'base64').toString());
async function _run({ meta, options }, language, code) {
    if (options.runner == 'judge0') {
        meta.$send(await judge0.run(code, language, '', options.base64));
    } else if (options.runner == 'local') {
        meta.$send(await executorserver.run(language, code));
    } else return meta.$send('Unknown runner');
}

exports.register = ({ app }) => {
    app.command('run <language> <code...>', '运行程序', { minInterval: 10, showWarning: true }).alias('code')
        .option('-b, --base64', '传入base64编码的程序')
        .option('-r, --runner <runner>', '指定运行环境，可为local或judge0', { default: 'local' })
        .action(_run);
};