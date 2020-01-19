'use strict';
const
    axios = require('axios'),
    reg = /^code>([a-zA-z]+?)>([\s\S]*)$/i,
    LANGS = {
        bash: 1,
        sh: 1,
        basic: 3,
        vb: 3,
        c: 4,
        cpp: 10,
        csharp: 16,
        cs: 16,
        clojure: 18,
        clj: 18,
        crystal: 19,
        elixir: 20,
        ex: 20,
        erlang: 21,
        erl: 21,
        go: 22,
        haskell: 23,
        hs: 23,
        insect: 25,
        java: 26,
        nodejs: 29,
        js: 29,
        ocaml: 31,
        octave: 32,
        pascal: 33,
        pas: 33,
        python3: 34,
        py3: 34,
        py: 34,
        python2: 36,
        py2: 36,
        ruby: 38,
        rb: 38,
        rust: 42,
        rs: 42
    },
    STATUS = {
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
    },
    encode = str => (Buffer.from(str, 'utf8').toString('base64')),
    decode = str => (Buffer.from(str, 'base64').toString());

async function run(code, lang, input) {
    let res;
    try {
        res = await axios.post('https://api.judge0.com/submissions/?base64_encoded=false&wait=false', {
            source_code: code,
            language_id: lang,
            stdin: input
        });
    } catch (e) {
        return e.message + '\n' + e.stack;
    }
    console.log(res.data.token);
    let result = { status_id: 1 };
    while (result.status_id <= 2) {
        result = (await axios.get(`https://api.judge0.com/submissions/${res.data.token}?base64_encoded=true&fields=stdout,stderr,status_id,time,memory,compile_output,status`)).data;
        await new Promise((resolve) => {
            setTimeout(() => { resolve(); }, 300);
        });
        if (!result.status_id) result.status_id = 1;
    }
    console.log(result);
    return result;
}

function langname(name) {
    switch (name) {
        case 'rb': return 'ruby';
        case 'py': return 'python';
        case 'pl': return 'perl';
        case 'clj': return 'clojure';
        case 'coffee': return 'coffeescript';
        case 'sh': return 'bash';
        case 'asm': return 'assembly';
        case 'cs': return 'csharp';
        case 'erl': return 'erlang';
        case 'idr': return 'idris';
        case 'rs': return 'rust';
        case 'ex': return 'elixir';
        case 'fs': return 'fsharp';
        case 'hs': return 'haskell';
        case 'js': return 'javascript';
        case 'jl': return 'julia';
        case 'ml': return 'ocaml';
        case 'cpp': case 'java': case 'scala': case 'd': case 'go': case 'php': case 'c':
        case 'lua': case 'nim': case 'ruby': case 'perl': case 'clojure':
        case 'coffeescript': case 'bash': case 'assembly': case 'csharp':
        case 'ocaml': case 'erlang': case 'idris': case 'rust': case 'elixir':
        case 'fsharp': case 'haskell': case 'javascript': case 'julia': return name;
        default: return 'error';
    }
}

module.exports = class {
    constructor(item) {
        this.log = item.log;
    }
    info() {
        return {
            id: 'codeRunner',
            author: 'masnn',
            hidden: false,
            contacts: {
                email: 'masnn0@outlook.com',
                github: 'https://github.com/masnn/'
            },
            description: '运行代码',
            usage: `
公众开放如下内容：
code>代码名称>代码  运行代码

注：代码名称通常为文件默认扩展名
`
        };
    }
    async message(e, context) {
        if (!reg.test(context.raw_message)) return;
        let tmp = reg.exec(context.raw_message);
        if (!LANGS[tmp[1]]) return '[错误]不支持的语言:' + tmp[1];
        this.log.log('[CodeRunner]Now Running:' + langname(tmp[1]) + ' From:' + context.user_id);
        let { status_id, stdout, stderr } = await run(tmp[2], LANGS[tmp[1]], '');
        console.log(status_id, stdout, stderr);
        if (status_id == 3)
            return `执行${langname(tmp[1])}结果: \n${decode(stdout || '')}`;
        else
            return `执行${langname(tmp[1])}出错: ${STATUS[status_id]}\n${decode(stderr || '')}`;
    }
}
