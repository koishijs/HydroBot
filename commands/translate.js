const translate = require('translate');
async function _translate({ meta }, to, str) {
    console.log(to, str);
    let res = await translate(str, to);
    console.log(res);
    return await meta.$send(res);
}
exports.register = ({ app }) => {
    app.command('translate <expression>', 'Translator', { minInterval: 10 })
        .option('--from <language>', 'From language')
        .option('--to <language>', 'To language')
        .action(_translate);
};