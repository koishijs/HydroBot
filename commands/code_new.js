'use strict';
const
    _ = require('lodash'),
    Axios = require('axios'),
    fs = require('fs');
const _langs = {
    c: {
        type: "compiler",
        compile: "/usr/bin/gcc -O2 -Wall -std=c99 -o code foo.c -lm",
        code_file: "foo.c",
        execute: "/w/code"
    },
    cc: {
        type: "compiler",
        compile: "/usr/bin/g++ -O2 -Wall -std=c++11 -o code foo.cc -lm",
        code_file: "foo.cc",
        execute: "/w/code"
    },
    pas: {
        type: "compiler",
        compile: "/usr/bin/fpc -O2 -o/w/code foo.pas",
        code_file: "foo.pas",
        execute: "/w/code"
    },
    py: {
        type: "interpreter",
        code_file: "foo.py",
        execute: "/usr/bin/python foo.py"
    },
    py2: {
        type: "interpreter",
        code_file: "foo.py",
        execute: "/usr/bin/python foo.py"
    },
    py3: {
        type: "interpreter",
        code_file: "foo.py",
        execute: "/usr/bin/python3 foo.py"
    }
};
var CONTROL = '(?:' + [
    '\\|\\|', '\\&\\&', ';;', '\\|\\&', '\\<\\(', '>>', '>\\&', '[&;()|<>]'
].join('|') + ')';
var META = '|&;()<> \\t';
var BAREWORD = '(\\\\[\'"' + META + ']|[^\\s\'"' + META + '])+';
var SINGLE_QUOTE = '"((\\\\"|[^"])*?)"';
var DOUBLE_QUOTE = '\'((\\\\\'|[^\'])*?)\'';
var TOKEN = '';
for (var i = 0; i < 4; i++)
    TOKEN += (Math.pow(16, 8) * Math.random()).toString(16);
function parse(s, env, opts) {
    var mapped = _parse(s, env, opts);
    if (typeof env !== 'function') return mapped;
    return mapped.reduce(function (acc, s) {
        if (typeof s === 'object') return acc.concat(s);
        var xs = s.split(RegExp('(' + TOKEN + '.*?' + TOKEN + ')', 'g'));
        if (xs.length === 1) return acc.concat(xs[0]);
        return acc.concat(xs.filter(Boolean).map(function (x) {
            if (RegExp('^' + TOKEN).test(x)) return JSON.parse(x.split(TOKEN)[1]);
            else return x;
        }));
    }, []);
}
function _parse(s, env, opts) {
    var chunker = new RegExp(['(' + CONTROL + ')', '(' + BAREWORD + '|' + SINGLE_QUOTE + '|' + DOUBLE_QUOTE + ')*'].join('|'), 'g');
    var match = s.match(chunker).filter(Boolean);
    var commented = false;
    if (!match) return [];
    if (!env) env = {};
    if (!opts) opts = {};
    return match.map(function (s, j) {
        if (commented) return;
        if (RegExp('^' + CONTROL + '$').test(s)) return { op: s };
        var SQ = '\'';
        var DQ = '"';
        var DS = '$';
        var BS = opts.escape || '\\';
        var quote = false;
        var esc = false;
        var out = '';
        var isGlob = false;
        for (var i = 0, len = s.length; i < len; i++) {
            var c = s.charAt(i);
            isGlob = isGlob || (!quote && (c === '*' || c === '?'));
            if (esc) {
                out += c;
                esc = false;
            } else if (quote) {
                if (c === quote) quote = false;
                else if (quote == SQ) out += c;
                else { // Double quote
                    if (c === BS) {
                        i += 1;
                        c = s.charAt(i);
                        if (c === DQ || c === BS || c === DS) out += c;
                        else out += BS + c;
                    } else if (c === DS) out += parseEnvVar();
                    else out += c;
                }
            } else if (c === DQ || c === SQ) quote = c;
            else if (RegExp('^' + CONTROL + '$').test(c)) return { op: s };
            else if (RegExp('^#$').test(c)) {
                commented = true;
                if (out.length)
                    return [out, { comment: s.slice(i + 1) + match.slice(j + 1).join(' ') }];
                return [{ comment: s.slice(i + 1) + match.slice(j + 1).join(' ') }];
            } else if (c === BS) esc = true;
            else if (c === DS) out += parseEnvVar();
            else out += c;
        }
        if (isGlob) return { op: 'glob', pattern: out };
        return out;
        function parseEnvVar() {
            i += 1;
            var varend, varname;
            if (s.charAt(i) === '{') {
                i += 1;
                if (s.charAt(i) === '}') throw new Error('Bad substitution: ' + s.substr(i - 2, 3));
                varend = s.indexOf('}', i);
                if (varend < 0) throw new Error('Bad substitution: ' + s.substr(i));
                varname = s.substr(i, varend - i);
                i = varend;
            } else if (/[*@#?$!_\-]/.test(s.charAt(i))) {
                varname = s.charAt(i);
                i += 1;
            } else {
                varend = s.substr(i).match(/[^\w\d_]/);
                if (!varend) {
                    varname = s.substr(i);
                    i = s.length;
                } else {
                    varname = s.substr(i, varend.index);
                    i += varend.index - 1;
                }
            }
            return getVar(null, '', varname);
        }
    }).reduce(function (prev, arg) {
        if (arg === undefined)
            return prev;
        return prev.concat(arg);
    }, []);
    function getVar(_, pre, key) {
        var r = typeof env === 'function' ? env(key) : env[key];
        if (r === undefined && key != '') r = '';
        else if (r === undefined) r = '$';
        if (typeof r === 'object') return pre + TOKEN + JSON.stringify(r) + TOKEN;
        else return pre + r;
    }
}

const env = ['PATH=/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin', 'HOME=/w'];
const axios = Axios.create({ baseURL: 'http://localhost:5050' });
async function _run(execute, {
    time_limit_ms = 5000,
    memory_limit_mb = 128,
    process_limit = 32,
    stdin, copyIn = {}, copyOut = [], copyOutCached
} = {}) {
    let args = parse(execute), result, body;
    try {
        body = {
            cmd: [{
                args, env,
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
        let res = await axios.post('/run', body);
        result = res.data[0];
    } catch (e) {
        console.log(e);
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
};
async function run(code, lang, input) {
    let copyIn = {};
    let info = _langs[lang];
    if (!_langs[lang]) throw new Error('Language not supported');
    copyIn[info.code_file] = { content: code };
    if (info.type == 'compiler') {
        let { status, stdout, stderr, fileIds } = await _run(
            info.compile, { copyIn, copyOutCached: ['code'] }
        );
        if (status != 'Accepted') return { status: 'Compile Error', stdout, stderr };
        let res = await _run(info.execute, { copyIn: { code: { fileId: fileIds.code } } });
        await axios.delete(`/file/${fileIds.code}`);
        return res;
    } else if (info.type == 'interpreter') {
        return await _run(info.execute, { copyIn });
    }
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
    if (args[1].includes('\n')) {
        let i = args[1].split('\n');
        args[1] = i[0];
        args[2] = i[1] + ' ' + args[2];
    }
    if (args[0] == 'help') return 'code [code|base64|url] [Language] [code]  运行代码';
    if (args.length < 3) return 'Use `code help\' for help';
    if (args[0] == 'url') {
        args[2] = await axios.get(args[2]);
        args[2] = args[2].data;
    }
    let { status, stdout, stderr } = await run(_.drop(args, 2).join(' '), args[1], '');
    console.log(status, stdout, stderr);
    if (status == 'Accepted')
        return `执行${args[1]}结果: \n${stdout}\n${stderr}`;
    else
        return `执行${args[1]}出错: ${status}\n${stdout}\n${stderr}`;
}
