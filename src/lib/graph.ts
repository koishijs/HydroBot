import { Page } from 'puppeteer';
import AnsiUp from 'ansi_up';

const AU = new AnsiUp();

export async function text2png(page: Page, content: string) {
    const str = `<pre style="font-family: Consolas;font-size: 14px;">${AU.ansi_to_html(content)}</pre>`;
    const data = `data:text/html;base64,${Buffer.from(str).toString('base64')}`;
    let s: Buffer;
    let e;
    try {
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
