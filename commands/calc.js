const child = require('child_process');

async function _calc({ meta }, expression) {
    expression = expression.decode();
    if (expression.includes('\'')) return 'Qoute detected. Calculation abort.';
    let res;
    try {
        res = child.execSync(`wolframscript -cloud -c '${expression}'`).toString();
    } catch (e) {
        return meta.$send(e.toString);
    }
    return meta.$send(res);
}
exports.register = ({ app }) => {
    app.command('calc <expression>', '计算表达式', { minInterval: 10 }).action(_calc);
};
