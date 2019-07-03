const {
        testSnippetExpansion,
        testSnippetExpansionDelimited,
    } = require("./snipExpand"),
    { testPlaceHolderSnippetExpansion } = require("./placeHolders"),
    { testMathomania } = require("./mathomania"),
    { testTabToSpaceExpansion } = require("./tabToSpace"),
    { testClipboardSnippet, testEmbeddedSnippet, testURLSnippet } = require("./macros"),
    { dismissDialog, extSettings, updateSettings } = require("./utils"),
    testURLs = require("./testURLs");

const usablePages = [],
    JEST_TIMEOUT = 30000;

/*
 * add this since jest's default timeout is 5s only
 * Loading a page might take longer
 */
jest.setTimeout(JEST_TIMEOUT);

beforeAll(async () => {
    // load all the pages
    /* eslint-disable no-await-in-loop */
    for (const testURL of testURLs) {
        const usablePage = await browser.newPage();
        await usablePage.setViewport({ width: 1920, height: 1080 });

        usablePage.on("dialog", dismissDialog);
        usablePages.push({
            usablePage,
            loadedPromise: usablePage.goto(testURL.url),
        });
    }
    /* eslint-enable no-await-in-loop */

    // to init the list of snippets used for testing
    await updateSettings(
        extSettings({ matchDelimitedWord: false, tabKeyExpandSpace: false }),
    );
});

/*
 * TESTS
 */
describe("Test snippet expansion", () => {
    testSnippetExpansion(usablePages);
});

describe("Test delimited snippet expansion", () => {
    testSnippetExpansionDelimited(usablePages);
});

describe("Test placeholder expansion", () => {
    testPlaceHolderSnippetExpansion(usablePages);
});

describe("Test tab to space behaviour", () => {
    testTabToSpaceExpansion(usablePages);
});

describe("Test mathomania", () => {
    testMathomania(usablePages);
});

describe("Test macros", () => {
    testClipboardSnippet(usablePages);
    testEmbeddedSnippet(usablePages);
    testURLSnippet(usablePages);
});
