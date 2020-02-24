const
    child = require('child_process'),
    fs = require('fs').promises;
Array.prototype.indexOf = function (val) {
    for (let i = 0; i < this.length; i++)
        if (this[i] == val) return i;
    return -1;
};
Array.prototype.remove = function (val) {
    let index = this.indexOf(val);
    if (index > -1) this.splice(index, 1);
};
let CQ = null;
let config = {};
let disabled = false;
let log = null;
let db = [
    {
        reg: /^process\.exit\(\)$/i,
        op: () => {
            setTimeout(() => {
                child.exec('pm2 stop robot');
                setTimeout(() => {
                    global.process.exit();
                }, 1000);
            }, 3000);
            return 'Exiting in 3 secs...';
        }
    },
    {
        reg: /^process\.restart\(\)$/i,
        op: () => {
            setTimeout(() => {
                child.exec('pm2 restart robot');
            }, 3000);
            return 'Restarting in 3 secs...';
        }
    },
    {
        reg: /^send_group_msg>([0-9]+)>([\s\S]+)$/i,
        op: (tmp, e) => {
            CQ('send_group_msg', { group_id: tmp[1], message: tmp[2] });
            e.stopPropagation();
        }
    },
    {
        reg: /^send_private_msg>([0-9]+)>([\s\S]+)$/i,
        op: (tmp, e) => {
            CQ('send_private_msg', { user_id: tmp[1], message: tmp[2] });
            e.stopPropagation();
        }
    },
    {
        reg: /^add_blacklist>([0-9]+)$/i,
        op: async tmp => {
            let blacklist = await fs.readFile('./database/blacklist.json');
            blacklist = JSON.parse(blacklist);
            blacklist.private.push(new Number(tmp[1]));
            await fs.writeFile('./database/blacklist.json', JSON.stringify(blacklist));
            return 'Added.';
        }
    },
    {
        reg: /^leave$/i,
        op: async (tmp, e, context) => {
            if (context.group_id) CQ('set_group_leave', { group_id: context.group_id });
            else CQ('set_discuss_leave', { discuss_id: context.discuss_id });
            e.stopPropagation();
        }
    },
    {
        reg: /^plugin_disable>([\s\S]+)$/i,
        op: async tmp => {
            let file = await fs.readFile('../config.json');
            file = JSON.parse(file.toString());
            file.enabled_plugins.remove(tmp[1]);
            await fs.writeFile('../config.json', JSON.stringify(file));
        }
    },
    {
        reg: /^plugin_enable>([\s\S]+)$/i,
        op: async tmp => {
            let file = await fs.readFile('../config.json');
            file = JSON.parse(file.toString());
            file.enabled_plugins.push(tmp[1]);
            await fs.writeFile('../config.json', JSON.stringify(file));
        }
    }
];

exports.init = item => {
    config = item.config || {};
    log = item.log;
    CQ = item.CQ;
    disabled = false;
    if (config.admin == undefined) {
        log.error('[Management] No admin configured. Plugin disabled.');
        disabled = true;
        return;
    }
};
exports.info = {
    id: 'management',
    author: 'masnn',
    hidden: false,
    contacts: {
        email: 'masnn0@outlook.com',
        github: 'https://github.com/masnn/'
    },
    description: '管理系统',
    usage: `
公众开放如下内容：
status  获取当前运行状态
`
};
exports.msg_group = exports.msg_private = async (e, context) => {
    if (disabled) return;
    for (let i in db)
        if (db[i].reg.test(context.raw_message))
            if (db[i].public || config.admin.includes(context.user_id)) {
                let tmp = db[i].reg.exec(context.raw_message);
                let res;
                try {
                    if (db[i].op instanceof Function)
                        res = db[i].op(tmp, e, context);
                    else res = eval(db[i].op);
                    if (res instanceof Promise)
                        res = await res;
                } catch (e) {
                    log.error('[Management]Error:' + e.message);
                    return ['Error:', e.message];
                }
                return res;
            }
};
