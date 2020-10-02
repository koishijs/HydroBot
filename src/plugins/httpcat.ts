import { App } from 'koishi-core';

const ALLOW = [
    '100', '101', '200', '201', '202',
    '204', '206', '207', '300', '301',
    '302', '303', '304', '305', '307',
    '400', '401', '402', '403', '404',
    '405', '406', '408', '409', '410',
    '411', '412', '413', '414', '415',
    '416', '417', '418', '420', '421',
    '422', '423', '424', '425', '426',
    '429', '431', '444', '450', '451',
    '499', '500', '501', '502', '503',
    '504', '505', '506', '507', '508',
    '509', '510', '511', '599',
];

export function apply(app: App) {
    app.command('cat <id>', 'http.cat', { cost: 1 })
        .action(async (_, id) => {
            if (!ALLOW.includes(id)) return `你家http协议会返回${id}？`;
            return `[CQ:image,file=https://cdn.jsdelivr.net/gh/httpcats/http.cat/public/images/${id}.jpg]`;
        });
}
