'use strict';
const os = require('os');
exports.exec = () =>
    ('Running on: ' + os.release() + ' ' + os.arch() + '\n'
        + 'Mem usage: ' + ((os.totalmem() - os.freemem()) / 1073741824).toFixed(1) + 'GiB/'
        + (os.totalmem() / 1073741824).toFixed(1) + 'GiB\n'
        + 'Process uptime: ' + (process.uptime() / 60).toFixed(1) + 'min\n'
        + 'System uptime: ' + (os.uptime() / 60).toFixed(1) + 'min')
