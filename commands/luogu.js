'use strict';
const axios = require('axios');
exports.exec = async (args) => {
    if (!args) return '请输入要查询的题号！';
    let res;
    try {
        res = await axios({
            url: 'https://www.luogu.com.cn/api/problem/detail/' + args,
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; WOW64; Trident/7.0; rv:11.0) like Gecko',
                'Accept': 'text/html, application/xhtml+xml, image/jxr, */*',
                'Accept-Language': 'zh-Hans-CN, zh-Hans; q=0.8, en-US; q=0.5, en; q=0.3',
                'Accept-Encoding': 'gzip, deflate'
            }
        });
    } catch (e) {
        return '获取失败';
    }
    let p = res.data;
    if (p.status == 200) return `${p.data.StringPID} ${p.data.Name}\n${p.data.Description}`;
    else return p.data;
};
/*
export interface IAPIProblem {
    StringPID: string
    Tags: Tag[]
    Type: number
    Sample: [string[]]
    InputFormat: string
    OutputFormat: string
    Name: string
    Hint: string
    Flag: string
    Description: string
    Background: string
    Translation?: string
}

export interface IAPITag {
    Id: number
    Name: string
    ParentId: number
}
*/
