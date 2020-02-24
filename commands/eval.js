exports.sudo = true;
exports.exec = async args => {
    args = args.replace(/&#91;/gm, '[');
    args = args.replace(/&#93;/gm, ']');
    args = args.replace(/&amp;/gm, '&');
    let res = eval(args);
    if (res instanceof Promise) res = await res;
    if (typeof res == 'string' || res instanceof Array) return res;
    else if (typeof res == 'object') return JSON.stringify(res);
    else if (typeof res == 'undefined') return 'undefined';
    else return res.toString();
}