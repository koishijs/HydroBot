const axios = require('axios');
const jsdom = require('jsdom');

const { JSDOM } = jsdom;
const ID = (url) => {
    const path = url.split('/');
    return path[path.length - 1];
};
const transformRequest = [(data) => {
    let ret = '';
    for (const it in data) {
        if (data[it] !== '') {
            if (ret !== '') ret += '&';
            ret += `${encodeURIComponent(it)}=${encodeURIComponent(data[it])}`;
        }
    }
    return ret;
}];

String.prototype.Trim = function () {
    return this.replace(/(^\s*)|(\s*$)/g, '');
};
String.prototype.LTrim = function () {
    return this.replace(/(^\s*)/g, '');
};
String.prototype.RTrim = function () {
    return this.replace(/(\s*$)/g, '');
};
module.exports = class {
    constructor(baseURL) {
        this.baseURL = baseURL;
    }

    async login(uname, password) {
        const login = await axios.post(`${this.baseURL}/login`, { uname, password }, {
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            transformRequest,
        });
        const cookie = login.headers['set-cookie'][0].split(';')[0].split('=')[1];
        console.log('cookie:', cookie);
        return cookie;
    }

    async problemList(page) {
        const data = await axios.get(`${this.baseURL}/p?page=${page}`);
        const DOM = new JSDOM(data.data.fragments[0].html);
        let tbody = DOM.window.document.getElementsByTagName('tbody');
        tbody = tbody[0];
        const list = [];
        for (const i in tbody.children) {
            const children = tbody.children[i].children;
            if (children) {
                const col_name = children[0];
                const submit = children[1].innerHTML;
                const AC = children[2].innerHTML;
                const difficulty = children[3].innerHTML;
                const href = col_name.children[0].href;
                const name = col_name.children[0].innerHTML.Trim();
                const id = ID(href);
                list.push({
                    id, name, href, submit, AC, difficulty,
                });
            }
        }
        return list;
    }

    async problemDetail(id) {
        const data = await axios.get(`${this.baseURL}/p/${id}`);
        const DOM = new JSDOM(data.data);
        return DOM.window.document.getElementsByClassName('section__body typo')[0].innerHTML;
    }

    async problemSubmit(id, lang, code, cookie) {
        const res = await axios.get(`${this.baseURL}/p/${id}/submit`, {
            headers: {
                accept: 'text/html',
                cookie: `sid=${cookie}`,
                'Content-Type': 'application/x-www-form-urlencoded',
            },
            transformRequest,
        });
        const DOM = new JSDOM(res.data);
        const csrf_token = (DOM.window.document.getElementsByName('csrf_token'))[0].value;
        console.log('csrf_token:', csrf_token);
        const resp = await axios.post(`${this.baseURL}/p/${id}/submit`, { lang, code, csrf_token }, {
            headers: {
                accept: 'text/html',
                cookie: `sid=${cookie}`,
                'Content-Type': 'application/x-www-form-urlencoded',
            },
            transformRequest,
        });
        console.log(resp.request.path.split('/')[2]);
        return resp.request.path.split('/')[2];
    }

    async recordStatus(rid) {
        const data = await axios.get(`${this.baseURL}/records/${rid}`);
        const DOM = new JSDOM(data.data);
        const title = (DOM.window.document.getElementsByClassName('section__title'))[0];
        const status = title.children[1].innerHTML.Trim();
        const summary = DOM.window.document.getElementById('summary');
        const score = summary.children[1].innerHTML;
        const time = summary.children[3].innerHTML;
        const mem = summary.children[5].innerHTML;
        let compiler_text = '';
        const compiler = (DOM.window.document.getElementsByClassName('compiler-text'))[0];
        if (compiler) compiler_text = compiler.innerHTML;
        const details = [];
        const tbody = (DOM.window.document.getElementsByTagName('tbody'))[0];
        if (tbody) {
            for (const i in tbody.children) {
                const children = tbody.children[i].children;
                if (children) {
                    const status = children[1].children[1].innerHTML.Trim();
                    const time = children[2].innerHTML;
                    const mem = children[3].innerHTML;
                    details.push({ status, time, mem });
                }
            }
        }
        return {
            status, score, time, mem, details, compiler_text,
        };
    }
};
