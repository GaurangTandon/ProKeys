const puppeteer = require("puppeteer"),
    path = require("path");

(async () => {
    const pathToExtension = path.join(__dirname, "../dist"),
        browser = await puppeteer.launch({
            headless: false,
            args: [
                `--disable-extensions-except=${pathToExtension}`,
                `--load-extension=${pathToExtension}`,
            ],
        }),
        page = await browser.newPage();
    await page.goto(
        "https://meta.stackexchange.com/questions/47375/what-is-the-most-downvoted-post-on-stackoverflow",
    );
})();
