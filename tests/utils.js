const fs = require("fs"),
    path = require("path"),
    extensionDelay = 300;

/**
 * Wait for given milliseconds
 * @param {Number} milliseconds to wait
 */
function sleep(milliseconds) {
    return new Promise((resolve) => {
        setTimeout(resolve, milliseconds);
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

async function clickElement(page, textBoxQueryString, handler = null, button = "left") {
    if (handler) {
        await handler.clickElement(page, button);
    } else {
        // since not using handler, it's ok
        //  to simpy use page.focus [no need to use focusTextBox]

        await page.focus(textBoxQueryString);
        await page.click(textBoxQueryString, { button });
    }
}

function extSettings(opts) {
    return `
    {
        "snippets": [
            "Snippets",
            1560477878650,
            {
                "name": "placeholder",
                "body": "hello %world% %again%",
                "timestamp": 0
            },
            {
                "name": "embed",
                "body": "[[%s(brb)]]",
                "timestamp": 1
            },
            {
                "name": "url",
                "body": "[[%u(p)]]",
                "timestamp": 2
            },
            {
                "name": "clipboard",
                "body": "[[%p]]",
                "timestamp": 3
            }
        ],
        "blockedSites": [],
        "charsToAutoInsertUserList": [
            [
                "(",
                ")"
            ],
            [
                "{",
                "}"
            ],
            [
                "\\"",
                "\\""
            ],
            [
                "[",
                "]"
            ]
        ],
        "dataVersion": 1,
        "language": "English",
        "hotKey": [
            "shiftKey",
            32
        ],
        "dataUpdateVariable": false,
        "matchDelimitedWord": ${opts.matchDelimitedWord},
        "tabKey": ${opts.tabKeyExpandSpace},
        "snipNameDelimiterList": "@#$%&*+-=(){}[]:\\"'/_<>?!., ",
        "omniboxSearchURL": "https://www.google.com/search?q=SEARCH",
        "wrapSelectionAutoInsert": true,
        "ctxEnabled": true
    }`;
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

async function focusTextBox(page, textBoxQueryString, handler) {
    if (handler) {
        await handler.focusTextBox(page);
    } else {
        await page.focus(textBoxQueryString);
        await page.click(textBoxQueryString);
    }
}

async function clearText(page, textBoxQueryString, handler) {
    if (handler) {
        await handler.clearText();
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
        expandedText = await handler.retrieveText();
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
    hotkeyRequired = true,
) {
    await page.bringToFront();

    await focusTextBox(page, textBoxQueryString, handler);
    await clearText(page, textBoxQueryString, handler);

    // type the snip text [and some extra, if reqd]
    await page.keyboard.type(snipText);

    if (cursorChange) {
        await positionCursor(page, cursorChange);
    }

    // expand the snippet
    if (hotkeyRequired) {
        await expandSnippet(page);
    }

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
    await page.bringToFront();

    await focusTextBox(page, textBoxQueryString, handler);
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
    const expandedText = await retrieveText(page, textBoxQueryString, handler);

    return expandedText;
}

async function getTabToSpaceExpansion(
    page,
    textBoxQueryString,
    handler = null,
) {
    await page.bringToFront();

    await focusTextBox(page, textBoxQueryString, handler);
    await clearText(page, textBoxQueryString, handler);

    await page.keyboard.press("Tab");

    const text = await retrieveText(page, textBoxQueryString, handler);

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
        dontImportDupeQuerySelector = "input[name='duplicate'][value='existing']",
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

    const dupeRemover = await extWelcomePage.$(dontImportDupeQuerySelector);
    await dupeRemover.click();

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

async function copyTextToClipboard(page, textToCopy) {
    await page.evaluate((text) => {
        const input = document.createElement("input");
        input.setAttribute("value", text);
        document.body.appendChild(input);
        input.select();
        document.execCommand("copy");
        document.body.removeChild(input);
    }, textToCopy);
}

/*
 * This function is so werid that this is needed
 *  @param {Page} page The page on which this is to be done
 *  @param {String} textBoxQueryString The query string for textbox in which text is to be inserted
 *  @param {String} keyToHighlightMenu The context menu doesn't get automatically highlighted,
 *                                      pressing a key highlights the menu after which we position
 *  @param {String} cursorChange The keypresses reqd to select desired menu
 *  @param {Object} handler For RTEs, where things are handled differently
 */
async function getContextMenuInsertion(page, textBoxQueryString, keyToHighlightMenu, cursorChange, handler = null) {
    await page.bringToFront();
    console.log("bringtofront");
    await focusTextBox(page, textBoxQueryString, handler);
    console.log("focus");
    await clearText(page, textBoxQueryString, handler);
    console.log("cleared");

    await clickElement(page, textBoxQueryString, handler, "right");
    console.log("clicked!");

    await sleep(5000);

    await page.keyboard.press(keyToHighlightMenu);
    console.log("PLEASE GET HIGHLIGHTED");

    await positionCursor(page, cursorChange);
    console.log("inposition");
    await sleep(5000);

    await page.keyboard.press("Enter");
    console.log("fired");

    await sleep(10000);
}

module.exports = {
    copyTextToClipboard,
    dismissDialog,
    expandSnippet,
    extSettings,
    getContextMenuInsertion,
    getExpandedPlaceHolderSnippet,
    getExpandedSnippet,
    getExtOptionsPage,
    getPageByTitle,
    getTabToSpaceExpansion,
    positionCursor,
    sleep,
    updateSettings,
};
