const testURLs = [
        {
            url:
            "https://stackoverflow.com/questions/50990292/"
            + "using-octal-character-gives-warning-multi-character-character-constant",
            textBoxQueryString: "#wmd-input",
        },
        {
            url:
            "https://serverfault.com/questions/971011/"
            + "how-to-check-if-an-active-directory-server-is-reachable-from-an-ubuntu-apache-ph",
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
/**
 * Wait for given milliseconds
 * @param {Number} milliseconds to wait
 */
function sleep(milliseconds) {
    const start = new Date().getTime();
    for (let i = 0; i < 1e7; i++) {
        if (new Date().getTime() - start > milliseconds) {
            break;
        }
    }
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

    for (const delta of change) {
        if (delta in changeMap) {
            // !! reqd, since can't parallelize button presses
            // eslint-disable-next-line no-await-in-loop
            await page.keyboard.press(changeMap[delta]);
        }
    }
}

/*
 * Function to return the expanded value of a snippet
 */
async function getExpandedSnippet(
    page,
    textBoxQueryString,
    snipText,
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

    // reset the input field for next expansion
    await page.evaluate((txtBox) => {
        txtBox.value = "";
    }, textBox);

    return expandedText;
}
// this helps enforce synchronous tests
// the next test runs only when previous has completed
// (with the page having closed)
function testOnNthPage(testPageIdx) {
    const testPage = testURLs[testPageIdx];

    if (testPageIdx === testURLs.length) {
        return;
    }
    const { url, textBoxQueryString } = testPage;

    describe(`SnipppetExpands on ${url.match(/https?:\/\/(\w+\.)+\w+/)[0]}`, () => {
        beforeAll(async () => {
            await page.setViewport({ width: 1920, height: 1080 });
            await page.goto(url);
        });

        for (const testSnippet of testSnippets) {
            const { snipText, expansion, cursorChange } = testSnippet;

            it("Should match", async () => {
                const expandedText = await getExpandedSnippet(page, textBoxQueryString, snipText, cursorChange);
                await expect(expandedText).toBe(expansion);
            });
        }

        // why do we need to close the page???
        // (async () => {
        //     await page.close();
        // })();
    });
    testOnNthPage(testPageIdx + 1);
}
testOnNthPage(0);
