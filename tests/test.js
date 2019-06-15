const {
        testSnippetExpansion,
        testSnippetExpansionDelimited,
    } = require("./snipExpand"),
    { dismissDialog, getPageByTitle } = require("./utils"),
    testURLs = require("./testURLs");

const usablePages = ["This", "Should", "Contain", "Pages"],
    optionsPageTitle = "ProKeys | Options",
    JEST_TIMEOUT = 60000;

/*
 * add this since jest's default timeout is 5s only
 * Loading a page might take longer
 */
jest.setTimeout(JEST_TIMEOUT);

let extWelcomePage = "This should become a page";

(async () => {
    const allPages = await browser.pages();
    extWelcomePage = await getPageByTitle(allPages, optionsPageTitle);

    // dismiss dialog on page
    extWelcomePage.on("dialog", dismissDialog);

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
})();

/*
 * TESTS
 */
describe("Test snippet expansion", () => {
    console.log(usablePages);
    testSnippetExpansion(usablePages);
});

describe("Test snipppet expansion delimited", () => {
    console.log(extWelcomePage);
    testSnippetExpansionDelimited(usablePages, extWelcomePage);
});
