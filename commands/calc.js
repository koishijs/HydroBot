const child = require('child_process');
async function _calc({ meta }, expression) {
    if (expression.includes('\'')) return 'Qoute detected. Calculation abort.';
    return meta.$send(child.execSync(`wolframscript -cloud -c '${expression}'`).toString());
}
exports.register = ({ app }) => {
    app.command('calc <expression>', '计算表达式', { minInterval: 10 }).action(_calc);
};