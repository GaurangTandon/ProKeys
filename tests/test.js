const puppeteer = require("puppeteer"),
    path = require("path");

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
    //  uncomment this to `see` what happens
    //  headless: false,
        args: [
            `--disable-extensions-except=${pathToExtension}`,
            `--load-extension=${pathToExtension}`,
        ],
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
            // !! reqd
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

    console.assert(expandedText === expansion);

    // reset the input field for next expansion
    await page.evaluate((txtBox) => {
        txtBox.value = "";
    }, textBox);
}

(async () => {
    const pathToExtension = path.join(__dirname, "../dist"),
        browser = await loadBrowserWithExt(pathToExtension),
        page = await browser.newPage();

    await page.setViewport({ width: 1920, height: 1080 });

    const testURLs = [
            {
                url:
          "https://stackoverflow.com/questions/50990292/using-octal-character-gives-warning-multi-character-character-constant",
                textBoxQueryString: "#wmd-input",
            },
        ],
        testSnippets = [
            {
                snipText: "abrbc",
                expansion: "abe right backc",
                cursorChange: "h",
            },
        ];

    testURLs.forEach(async (testPage) => {
        const { url } = testPage,
            { textBoxQueryString } = testPage;

        await page.goto(url);

        testSnippets.forEach(async (testSnippet) => {
            const { snipText } = testSnippet,
                { expansion } = testSnippet,
                { cursorChange } = testSnippet;

            await testSnippetExpand(
                page,
                textBoxQueryString,
                snipText,
                expansion,
                cursorChange,
            );
        });
    });
})();
