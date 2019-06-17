const extensionDelay = 300;

/**
 * Wait for given milliseconds
 * @param {Number} milliseconds to wait
 */
function sleep(milliseconds) {
    return new Promise((resolve) => {
        setTimeout(() => resolve(), milliseconds);
    });
}

/*
 * Expands a snippet on the given page
 */
async function expandSnippet(page) {
    // give some time [sometimes, the text didn't get expanded]
    await sleep(extensionDelay);

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

    // clear the textbox and focus it again
    await page.evaluate((textBoxArg) => {
        textBoxArg.value = "";
    }, textBox);
    await page.focus(textBoxQueryString);

    // type the snip text [and some extra, if reqd]
    await page.keyboard.type(snipText);

    if (cursorChange) {
        await positionCursor(page, cursorChange);
    }

    // expand the snippet
    await expandSnippet(page);

    // wait for some time
    await sleep(extensionDelay);

    // retrieve the expanded value
    const expandedText = await page.evaluate(txt => txt.value, textBox);

    // reset the input field for next expansion
    await page.evaluate((txtBox) => {
        txtBox.value = "";
    }, textBox);

    return expandedText;
}

/*
 * function to dismiss all dialogs
 */
async function acceptDialog(dialog) {
    // try catch to avoid console.error on mutiple call
    //  [cannot accept dialog which is already handled]
    try {
        await dialog.accept();
    } catch (e) {
    // no error to catch since it is ok
    }
}

async function getBackgroundPage() {
    const targets = await browser.targets(),
        backgroundPageTarget = targets.find(
            target => target.type() === "background_page",
        ),
        backgroundPage = await backgroundPageTarget.page();

    return backgroundPage;
}

async function updateSettings(newProps) {
    const bgPage = await getBackgroundPage(),
        argString = `window.updateMyDataForTests(${JSON.stringify(newProps)})`;
    console.log(await bgPage.url());
    await sleep(15000);
    //  await bgPage.evaluateHandle(argString);
    await sleep(30000);
}

module.exports = {
    acceptDialog,
    expandSnippet,
    getBackgroundPage,
    getExpandedSnippet,
    positionCursor,
    sleep,
    updateSettings,
};
