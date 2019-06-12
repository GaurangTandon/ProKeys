const puppeteer = require("puppeteer"),
    path = require("path"),
    assert = require("./assert");

/*
 * Wait for given milliseconds
 */
function sleep(milliseconds) {
    const start = new Date().getTime();
    for (let i = 0; i < 1e7; i++) {
        if (new Date().getTime() - start > milliseconds) {
            break;
        }
    }
}

async function loadBrowserWithExt(pathToExtension) {
    const browser = await puppeteer.launch({
    // FIXIT: for some reason, this doesn't work without headless
        headless: false,
        args: [
            `--disable-extensions-except=${pathToExtension}`,
            `--load-extension=${pathToExtension}`,
        ],
        sloMo: 250,
    });

    return browser;
}

/*
 * Expands a snippet on the given page
 */
async function expandSnippet(page) {
    // give some time [sometimes, the text didn't get expanded]
    await sleep(300);

    // emulate default expand snip
    await page.keyboard.down("Shift");
    await page.keyboard.down("Space");
    await page.keyboard.up("Space");
    await page.keyboard.up("Shift");
}

/* Function to move the cursor a bit
 * hjkl
 * ----
 *  h: move cursor left
 *  j: move cursor down
 *  k: move cursor up
 *  l: move cursor right
 *
 * eg: to move cursor 3 left, change = "hhh"
 */
async function positionCursor(page, change) {
    const changeMap = {
        h: "ArrowLeft",
        j: "ArrowDown",
        k: "ArrowUp",
        l: "ArrowRight",
    };

    for (let i = 0; i < change.length; i++) {
        const delta = change[i];

        if (delta in changeMap) {
            // !! reqd, since can't parallelize button presses
            // eslint-disable-next-line no-await-in-loop
            await page.keyboard.press(changeMap[delta]);
        }
    }
}

/*
 * Function to test if a snippet expanded correctly or not
 *
 * Expects that the cursor is in the position from which snippet
 *  is to be expanded and the snippet is typed out
 */
async function testSnippetExpand(
    page,
    textBoxQueryString,
    snipText,
    expansion,
    cursorChange,
) {
    // find the textbox and focus it
    const textBox = await page.$(textBoxQueryString);
    await page.focus(textBoxQueryString);

    // type the snip text [and some extra, if reqd]
    await page.keyboard.type(snipText);

    if (cursorChange) {
        await positionCursor(page, cursorChange);
    }

    // expand the snippet
    await expandSnippet(page);

    // wait for some time
    await sleep(300);

    // retrieve the expanded value
    const expandedText = await page.evaluate(txt => txt.value, textBox);

    assert(expandedText === expansion);

    // reset the input field for next expansion
    await page.evaluate((txtBox) => {
        txtBox.value = "";
    }, textBox);
}

(async () => {
    const pathToExtension = path.join(__dirname, "../dist"),
        browser = await loadBrowserWithExt(pathToExtension),
        testURLs = [
            {
                url:
          "https://stackoverflow.com/questions/50990292/using-octal-character-gives-warning-multi-character-character-constant",
                textBoxQueryString: "#wmd-input",
            },
            {
                url:
          "https://serverfault.com/questions/971011/how-to-check-if-an-active-directory-server-is-reachable-from-an-ubuntu-apache-ph",
                textBoxQueryString: "#wmd-input",
            },
        ],
        testSnippets = [
            {
                snipText: "abrbc",
                expansion: "abe right backc",
                cursorChange: "h",
            },
            {
                snipText: "brb",
                expansion: "be right back",
                cursorChange: "",
            },
        ];

    /* eslint-disable no-await-in-loop */
    // TODO: parallelize the snip expansion on diff pages
    for (let pageIndex = 0; pageIndex < testURLs.length; pageIndex++) {
        const page = await browser.newPage();
        await page.setViewport({ width: 1920, height: 1080 });

        const testPage = testURLs[pageIndex],
            { url } = testPage,
            { textBoxQueryString } = testPage;

        await page.goto(url);

        for (let snipIndex = 0; snipIndex < testSnippets.length; snipIndex++) {
            const testSnippet = testSnippets[snipIndex],
                { snipText } = testSnippet,
                { expansion } = testSnippet,
                { cursorChange } = testSnippet;

            await testSnippetExpand(
                page,
                textBoxQueryString,
                snipText,
                expansion,
                cursorChange,
            );
        }

        await page.close();
    }
    /* eslint-enable no-await-in-loop */

    console.log("Tests over");
    await browser.close();
})();
