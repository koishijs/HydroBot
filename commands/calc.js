const child = require('child_process');
exports.exec = async args => {
    args = args.replace(/&#91;/gm, '[');
    args = args.replace(/&#93;/gm, ']');
    args = args.replace(/&amp;/gm, '&');
    if (args.includes('\'')) return 'Qoute detected. Calculation abort.';
    return child.execSync(`wolframscript -cloud -c '${args}'`).toString();
}