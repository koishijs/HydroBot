const puppeteer = require('puppeteer');

/**
 * @type {import('puppeteer').Browser}
 */
let browser;

async function getPage(url, fullPage = false, viewport = '1920x1080') {
    let page;
    let s;
    let e;
    try {
        if (url.startsWith('file://') || url.startsWith('view-source:')) throw new Error('Access denied');
        if (!browser) {
            browser = await puppeteer.launch({
                args: ['--no-sandbox'],
                defaultViewport: {
                    width: 1920,
                    height: 1080,
                },
            });
        }
        page = await browser.newPage();
        await page.setViewport({
            width: parseInt(viewport.split('x')[0], 10),
            height: parseInt(viewport.split('x')[1], 10),
            deviceScaleFactor: 1,
        });
        await page.goto(url, { waitUntil: 'networkidle0' });
        s = await page.screenshot({ fullPage });
    } catch (err) {
        e = err;
    }
    if (page) await page.close();
    if (e) throw e;
    return (s || Buffer.from('')).toString('base64');
}

module.exports = { getPage };
