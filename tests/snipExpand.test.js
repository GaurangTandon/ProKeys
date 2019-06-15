const fs = require("fs"),
    path = require("path");
/*
 * add this since jest's default timeout is 5s only
 * Loading a page might take longer
 */
const JEST_TIMEOUT = 60000,
    extensionDelay = 300,
    extSettings = opts => "{\"snippets\":[\"Snippets\",1560477878650],"
    + "\"blockedSites\":[],"
    + "\"charsToAutoInsertUserList\":"
    + "[[\"(\",\")\"],[\"{\",\"}\"],[\"\\\"\",\"\\\"\"],[\"[\",\"]\"]],"
    + "\"dataVersion\": 1,\"language\": \"English\",\"hotKey\": [\"shiftKey\",32],"
    + "\"dataUpdateVariable\": false,\"matchDelimitedWord\":"
    + `${opts.matchDelimitedWord},"tabKey": ${opts.tabKeyExpandSpace},`
    + "\"snipNameDelimiterList\":\"@#$%&*+-=(){}[]:\\\"'/_<>?!., \","
    + "\"omniboxSearchURL\":\"https://www.google.com/search?q=SEARCH\","
    + "\"wrapSelectionAutoInsert\":true,\"ctxEnabled\":true}";

jest.setTimeout(JEST_TIMEOUT);

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
            delimitedExpansion: "abrb c",
        },
        {
            snipText: "brb",
            expansion: "be right back",
            cursorChange: "",
            delimitedExpansion: "be right back",
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

async function dismissDialog(dialog) {
    await dialog.accept();
}

/**
 * How do parallel tests work?
 * The following `beforeAll` sends a `gotoURL` call to all of the pages
 * at once. The associated page objects and their `gotoURL` Promises are stored here
 */
const usablePages = [],
    optionsPageTitle = "ProKeys | Options";
let extWelcomePage;

beforeAll(async () => {
    const allPages = await browser.pages();

    // .find() method is synchronous, so it has to return a value immediately
    // so if it asynchronous fn argument, it probably acts weird
    // hence use for loop
    for (const pg of allPages) {
    // eslint-disable-next-line no-await-in-loop
        const title = await pg.title();
        if (title === optionsPageTitle) {
            extWelcomePage = pg;
            break;
        }
    }

    // dismiss dialog on page
    extWelcomePage.on("dialog", dismissDialog);

    for (const testURL of testURLs) {
    // eslint-disable-next-line no-await-in-loop
        const usablePage = await browser.newPage();
        // eslint-disable-next-line no-await-in-loop
        await usablePage.setViewport({ width: 1920, height: 1080 });
        usablePage.on("dialog", dismissDialog);
        usablePages.push({
            usablePage,
            loadedPromise: usablePage.goto(testURL.url),
        });
    }
});

async function updateSettings(newSettings) {
    const settingsFile = "extSettings.txt",
        extUploadFileFormID = "#file_input_elm",
        settingsPath = path.join(__dirname, settingsFile),
        importButtonQuerySelector = "button[class='import']",
        restoreButtonQuerySelector = "button[class='restore']";

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

/*
 * TEST:
 *  check if snippets are expanding normally
 */
describe("Test snippet expansion", () => {
    testURLs.forEach(({ url, textBoxQueryString }, index) => {
        let usablePage,
            loadedPromise;

        beforeAll(async () => {
            ({ usablePage, loadedPromise } = usablePages[index]);
            await loadedPromise;
            // unless we bring it to front, it does not activate snippets
            await usablePage.bringToFront();
        });

        describe(`Snipppet expands on ${
            url.match(/https?:\/\/(\w+\.)+\w+/)[0]
        }`, () => {
            testSnippets.forEach(({ snipText, expansion, cursorChange }) => {
                it(`${snipText} should expand`, async () => {
                    const expandedText = await getExpandedSnippet(
                        usablePage,
                        textBoxQueryString,
                        snipText,
                        cursorChange,
                    );
                    await expect(expandedText).toBe(expansion);
                });
            });
        });
    });
});

/*
 * TEST:
 *  check if snippets obey delimited settings
 */
describe("Test delimited snippets", () => {
    // enable delimited in settings
    beforeAll(async () => {
        await extWelcomePage.bringToFront();
        await updateSettings(
            extSettings({ matchDelimitedWord: true, tabKeyExpandSpace: false }),
        );
    });

    // disable delimited in settings
    afterAll(async () => {
        await extWelcomePage.bringToFront();
        await updateSettings(
            extSettings({ matchDelimitedWord: false, tabKeyExpandSpace: false }),
        );
    });

    testURLs.forEach(({ url, textBoxQueryString }, index) => {
        let usablePage;

        beforeAll(async () => {
            ({ usablePage } = usablePages[index]);
            // unless we bring it to front, it does not activate snippets
            await usablePage.bringToFront();
            await usablePage.reload();
        });

        describe(`Snipppet expands on ${
            url.match(/https?:\/\/(\w+\.)+\w+/)[0]
        }`, () => {
            // for ext changes
            testSnippets.forEach(({ snipText, cursorChange, delimitedExpansion }) => {
                it(`${snipText} should become ${delimitedExpansion}`, async () => {
                    const expandedText = await getExpandedSnippet(
                        usablePage,
                        textBoxQueryString,
                        snipText,
                        cursorChange,
                    );
                    await expect(expandedText).toBe(delimitedExpansion);
                });
            });
        });
    });
});
