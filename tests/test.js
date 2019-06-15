const {
        testSnippetExpansion,
        testSnippetExpansionDelimited,
    } = require("./snipExpand"),
    { dismissDialog, getPageByTitle } = require("./utils"),
    testURLs = require("./testURLs");

const usablePages = [],
    optionsPageTitle = "ProKeys | Options",
    JEST_TIMEOUT = 60000;

/*
 * add this since jest's default timeout is 5s only
 * Loading a page might take longer
 */
jest.setTimeout(JEST_TIMEOUT);

let extWelcomePage;

beforeAll(async (done) => {
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

    const allPages = await browser.pages();
    extWelcomePage = await getPageByTitle(allPages, optionsPageTitle);

    // dismiss dialog on page
    extWelcomePage.on("dialog", dismissDialog);

    // was loaded here:
    console.log("b4al:", await extWelcomePage.title());

    done();
});

/*
 * TESTS
 */
describe("Test snippet expansion", () => {
    testSnippetExpansion(usablePages);
});

describe("Test snipppet expansion delimited", () => {
    testSnippetExpansionDelimited(usablePages, extWelcomePage);
    console.log("after test", extWelcomePage);
});
