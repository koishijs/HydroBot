const { CQCode } = require('koishi');
const sharp = require('sharp');

exports.messageOutput = (msg) => {
    msg = CQCode.parseAll(msg);
    let message = '';
    for (const i of msg) {
        if (i.type === 'text') message += i.data.text;
        else if (i.type === 'image') message += `[image ${i.data.url.split('?')[0]} ]`;
        else if (i.type === 'at') message += `@${i.data.qq}`;
        else if (i.type === 'face') message += `[face${i.data.id}]`;
        else message += JSON.stringify(i);
    }
    return message;
};

exports.svg2png = async (svg) => {
    const image = sharp(Buffer.from(svg)).png();
    const buf = await image.toBuffer();
    return buf.toString('base64');
};
