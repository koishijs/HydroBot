'use strict';
const
    axios = require('axios'),
    reg = /^(code|code_base64|code_from_paste)>([a-zA-z]+?)>([\s\S]*)$/i,
    LANGS = {
        prolog: 69,
        asm: 45,
        bash: 46,
        sh: 46,
        basic: 47,
        vb: 47,
        c: 50,
        d: 56,
        lisp: 55,
        cpp: 54,
        csharp: 51,
        cs: 51,
        elixir: 57,
        ex: 57,
        erlang: 58,
        exe: 44,
        erl: 58,
        go: 60,
        fortran: 59,
        haskell: 61,
        hs: 61,
        java: 62,
        nodejs: 63,
        js: 63,
        lua: 64,
        ts: 74,
        typescript: 74,
        ocaml: 65,
        octave: 66,
        pascal: 67,
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
        rs: 73
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
    decode = str => (Buffer.from(str, 'base64').toString());

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
let log = null;
exports.init = item => {
    log = item.log;
};
exports.info = {
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
code_base64>代码名称>代码 提交base64编码的源程序

注：代码名称通常为文件默认扩展名
`
};
exports.message = async (e, context) => {
    if (!reg.test(context.message)) return;
    let tmp = reg.exec(context.message);
    if (!LANGS[tmp[2]]) return '[错误]不支持的语言:' + tmp[2];
    log.log('[CodeRunner]Now Running:' + langname(tmp[2]) + ' From:' + context.user_id);
    if (tmp[1] == 'code_from_paste') {
        tmp[3] = await axios.get(tmp[3]);
        tmp[3] = tmp[3].data;
    }
    let { status_id, stdout, stderr } = await run(tmp[3], LANGS[tmp[2]], '', 'code_base64' == tmp[1]);
    console.log(status_id, stdout, stderr);
    if (status_id == 3)
        return `执行${langname(tmp[2])}结果: \n${decode(stdout || '')}`;
    else
        return `执行${langname(tmp[2])}出错: ${STATUS[status_id]}\n${decode(stderr || '')}`;
}
