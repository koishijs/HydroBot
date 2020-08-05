import sharp from 'sharp';
import puppeteer, { Browser, Page } from 'puppeteer';
import AnsiUp from 'ansi_up';

const AU = new AnsiUp();

let browser: Browser;

export async function getPage(url: string, fullPage = false, viewport = '1920x1080') {
    let page: Page;
    let s: Buffer;
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

export async function text2png(content: string) {
    const str = `<pre style="font-family: Consolas;font-size: 14px;">${AU.ansi_to_html(content)}</pre>`;
    const data = `data:text/html;base64,${Buffer.from(str).toString('base64')}`;
    let page: Page;
    let s: Buffer;
    let e;
    try {
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
        await page.goto(data);
        await page.setViewport({
            height: 10,
            width: 1024,
        });
        s = await page.screenshot({ fullPage: true });
    } catch (err) {
        e = err;
    }
    if (page) await page.close();
    if (e) throw e;
    return (s || Buffer.from('')).toString('base64');
}

export async function svg2png(svg: string) {
    const image = sharp(Buffer.from(svg)).png();
    const buf = await image.toBuffer();
    return buf.toString('base64');
}
