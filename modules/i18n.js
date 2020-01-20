const
    fs = require('fs'),
    yaml = require('js-yaml'),
    locales = {};

String.prototype.format = function (args) {
    var result = this;
    if (arguments.length > 0) {
        if (arguments.length == 1 && typeof (args) == 'object') {
            for (var key in args)
                if (args[key] != undefined) {
                    let reg = new RegExp('({' + key + '})', 'g');
                    result = result.replace(reg, args[key]);
                }
        } else for (var i = 0; i < arguments.length; i++)
            if (arguments[i] != undefined) {
                let reg = new RegExp('({)' + i + '(})', 'g');
                result = result.replace(reg, arguments[i]);
            }
    }
    return result;
};
String.prototype.rawformat = function (object) {
    let result = this;
    return result.replace('${0}', JSON.stringify(object));
};
String.prototype.translate = function (language) {
    if (locales[language]) return locales[language][this] || this;
    else return this;
};

module.exports = function load(file, language) {
    if (!locales[language]) locales[language] = {};
    Object.assign(locales[language], yaml.safeLoad(file));
};