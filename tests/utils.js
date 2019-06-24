const fs = require("fs"),
    path = require("path"),
    extensionDelay = 300;

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

function extSettings(opts) {
    return (
        "{\"snippets\":[\"Snippets\",1560477878650,"
    + "{ \"name\": \"test\", \"body\": \"hello %world% %again%\", \"timestamp\": 1560747743398 }"
    + "],"
    + "\"blockedSites\":[],"
    + "\"charsToAutoInsertUserList\":"
    + "[[\"(\",\")\"],[\"{\",\"}\"],[\"\\\"\",\"\\\"\"],[\"[\",\"]\"]],"
    + "\"dataVersion\": 1,\"language\": \"English\",\"hotKey\": [\"shiftKey\",32],"
    + "\"dataUpdateVariable\": false,"
    + `"matchDelimitedWord": ${opts.matchDelimitedWord},`
    + `"tabKey": ${opts.tabKeyExpandSpace},`
    + "\"snipNameDelimiterList\":\"@#$%&*+-=(){}[]:\\\"'/_<>?!., \","
    + "\"omniboxSearchURL\":\"https://www.google.com/search?q=SEARCH\","
    + "\"wrapSelectionAutoInsert\":true,\"ctxEnabled\":true}"
    );
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

async function clearText(page, textBoxQueryString, handler) {
    if (handler) {
        await handler.clearText(page, textBoxQueryString);
    } else {
        const textBox = await page.$(textBoxQueryString);
        await page.evaluate((txtBox) => {
            txtBox.value = "";
        }, textBox);
    }
}

async function retrieveText(page, textBoxQueryString, handler) {
    let expandedText = "";

    if (handler) {
        expandedText = await handler.retrieveText(page, textBoxQueryString);
    } else {
        const textBox = await page.$(textBoxQueryString);
        expandedText = await page.evaluate(txt => txt.value, textBox);
    }

    return expandedText;
}

/*
 * Function to return the expanded value of a snippet
 */
async function getExpandedSnippet(
    page,
    textBoxQueryString,
    snipText,
    cursorChange,
    handler = null,
) {
    await page.focus(textBoxQueryString);

    await clearText(page, textBoxQueryString, handler);

    // type the snip text [and some extra, if reqd]
    await page.keyboard.type(snipText);

    if (cursorChange) {
        await positionCursor(page, cursorChange);
    }

    // expand the snippet
    await expandSnippet(page);

    // wait for some time
    await sleep(extensionDelay);

    const expandedText = await retrieveText(page, textBoxQueryString, handler);

    return expandedText;
}

async function getExpandedPlaceHolderSnippet(
    page,
    textBoxQueryString,
    snipText,
    values,
    handler = null,
) {
    await page.focus(textBoxQueryString);

    await clearText(page, textBoxQueryString, handler);

    // type the snip text [and some extra, if reqd]
    await page.keyboard.type(snipText);

    // expand the snippet
    await expandSnippet(page);

    // wait for some time
    await sleep(extensionDelay);

    // first place holder is already selected
    await page.keyboard.type(values[0]);

    /* eslint-disable no-await-in-loop */
    /* eslint-disable no-magic-numbers */
    for (
        let placeHolderFillerIndex = 1;
        placeHolderFillerIndex < values.length;
        placeHolderFillerIndex++
    ) {
        await page.keyboard.press("Tab");
        await page.keyboard.type(values[placeHolderFillerIndex]);
    }
    /* eslint-enable no-magic-numbers */
    /* eslint-enable no-await-in-loop */

    // retrieve the expanded value
    const expandedText = retrieveText(page, textBoxQueryString, handler);

    return expandedText;
}

async function getTabToSpaceExpansion(
    page,
    textBoxQueryString,
    handler = null,
) {
    await clearText(page, textBoxQueryString, handler);

    // click since focus and then tab would shift focus to next element
    await page.bringToFront();
    await page.click(textBoxQueryString);

    await page.keyboard.press("Tab");

    const text = retrieveText(page, textBoxQueryString, handler);

    return text;
}

/*
 * function to dismiss all dialogs
 */
async function dismissDialog(dialog) {
    // try catch to avoid console.error on mutiple call
    //  [cannot accept dialog which is already handled]
    try {
        await dialog.accept();
    } catch (e) {
    // no error to catch since it is ok
    }
}

async function getPageByTitle(pageList, pageTitle) {
    let requiredPage;

    // .find() method is synchronous, so it has to return a value immediately
    // so if it asynchronous fn argument, it probably acts weird
    // hence use for loop
    for (const pg of pageList) {
    // eslint-disable-next-line no-await-in-loop
        const title = await pg.title();
        if (title === pageTitle) {
            requiredPage = pg;
            break;
        }
    }

    return requiredPage;
}

async function getExtOptionsPage() {
    const optionsPageTitle = "ProKeys | Options",
        allPages = await browser.pages(),
        extWelcomePage = await getPageByTitle(allPages, optionsPageTitle);

    expect(extWelcomePage).toBeTruthy();

    // dismiss dialog on page
    extWelcomePage.on("dialog", dismissDialog);

    return extWelcomePage;
}

async function updateSettings(newSettings) {
    const settingsFile = "extSettings.txt",
        extUploadFileFormID = "#file_input_elm",
        importButtonQuerySelector = "button[class='import']",
        restoreButtonQuerySelector = "button[class='restore']",
        settingsPath = path.join(__dirname, settingsFile),
        extWelcomePage = await getExtOptionsPage();

    // write the settings file
    fs.writeFile(settingsPath, newSettings, (err) => {
        expect(err).toBeFalsy();
    });

    // bring it to front
    await extWelcomePage.bringToFront();

    // click the import button
    const importButton = await extWelcomePage.$(importButtonQuerySelector);
    await importButton.click();

    // upload the file
    const uploadFileForm = await extWelcomePage.$(extUploadFileFormID);
    await uploadFileForm.uploadFile(settingsPath);
    const restoreButton = await extWelcomePage.$(restoreButtonQuerySelector);
    await restoreButton.click();

    // reload options page
    await extWelcomePage.reload();

    // remove the settings file
    fs.unlink(settingsPath, (err) => {
        expect(err).toBeFalsy();
    });
}

module.exports = {
    dismissDialog,
    expandSnippet,
    extSettings,
    getExpandedPlaceHolderSnippet,
    getExpandedSnippet,
    getExtOptionsPage,
    getPageByTitle,
    getTabToSpaceExpansion,
    positionCursor,
    sleep,
    updateSettings,
};
