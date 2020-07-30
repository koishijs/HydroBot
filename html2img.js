const puppeteer = require('puppeteer');

/**
 * @type {import('puppeteer').Browser}
 */
let browser;

async function getPage(url) {
    let page;
    let s;
    let e;
    try {
        if (url.startsWith('file://') || url.startsWith('view-source:')) throw new Error('Access denied');
        if (!browser) {
            browser = await puppeteer.launch({
                args: ['--no-sandbox', '--disable-file-system'],
                defaultViewport: {
                    width: 1920,
                    height: 1080,
                },
            });
        }
        page = await browser.newPage();
        await page.goto(url);
        s = await page.screenshot();
    } catch (err) {
        e = err;
    }
    if (page) await page.close();
    if (e) throw e;
    return (s || Buffer.from('')).toString('base64');
}

module.exports = { getPage };
