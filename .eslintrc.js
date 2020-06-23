module.exports = {
    "root": true,
    "env": {
        "commonjs": true,
        "es6": true,
        "node": true
    },
    "extends": [
        "airbnb-base"
    ],
    "globals": {
        "Atomics": "readonly",
        "SharedArrayBuffer": "readonly"
    },
    "parserOptions": {
        "ecmaVersion": 2018
    },
    "rules": {
        "no-restricted-syntax": "off",
        "no-param-reassign": "off",
        "no-console": "off",
        "indent": ["warn", 4],
        "no-extend-native": "off",
        "no-return-await": "off",
        "guard-for-in": "off",
        "no-underscore-dangle": "off",
        "no-plusplus": "off",
        "radix": "off",
        "no-empty-function": "off",
        "consistent-return": "off",
        "max-classes-per-file": "off"
    }
};