'use strict';
const
    axios = require('axios'),
    _ = require('lodash'),
    LANGS = {
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
    decode = str => (Buffer.from(str, 'base64').toString()),
    langname = name => {
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
    }

async function run(code, lang, input, base64 = false) {
    let res;
    try {
        res = await axios.post(`https://api.judge0.com/submissions/?base64_encoded=${base64}&wait=false`, {
            source_code: code,
            language_id: lang,
            stdin: input,
            wall_time_limit: 5
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
let coll = null;
(async function init() {
    coll = global.App.db.collection('cmd_code');
})();
exports.exec = async (args, e, context) => {
    args = args.replace(/&#91;/gm, '[');
    args = args.replace(/&#93;/gm, ']');
    args = args.replace(/&amp;/gm, '&');
    args = args.split(' ');
    if (args[1] && args[1].includes('\n')) {
        let i = args[1].split('\n');
        args[1] = i[0];
        args[2] = i[1] + ' ' + args[2];
    }
    if (args[0] == 'help') return 'code [code|base64|url] [Language] [code]  运行代码';
    if (args.length < 3) return 'Use `code help\' for help';
    if (!LANGS[args[1]]) return '[错误]不支持的语言:' + args[1];
    console.log('[CodeRunner]Now Running:' + langname(args[1]) + ' From:' + context.user_id);
    if (args[0] == 'url') {
        args[2] = await axios.get(args[2]);
        args[2] = args[2].data;
    }
    let { status_id, stdout, stderr } = await run(_.drop(args, 2).join(' '), LANGS[args[1]], '', 'base64' == args[0]);
    console.log(status_id, stdout, stderr);
    if (status_id == 3)
        return `执行${langname(args[1])}结果: \n${decode(stdout || '')}`;
    else
        return `执行${langname(args[1])}出错: ${STATUS[status_id]}\n${decode(stderr || '')}`;
}
