import puppeteer from 'puppeteer';

(async () => {
    const browser = await puppeteer.launch();
    const page = await browser.newPage();

    page.on('pageerror', err => {
        console.error('------- PAGE ERROR -------');
        console.error(err.toString());
        console.error(err.stack);
    });

    page.on('console', msg => {
        if (msg.type() === 'error') {
            console.error('------- CONSOLE ERROR -------');
            console.error(msg.text());
        }
    });

    try {
        await page.goto('http://localhost:4173/');
        // simulate clicking age wall
        await new Promise(r => setTimeout(r, 1000));
        try {
            await page.click('button');
        } catch (e) { }
        await new Promise(r => setTimeout(r, 3000));
    } catch (err) {
        console.error('------- GOTO ERROR -------');
        console.error(err);
    } finally {
        await browser.close();
    }
})();
