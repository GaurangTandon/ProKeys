const { getExpandedSnippet } = require("./utils"),
    testURLs = require("./testURLs");

const testExpressions = [
    {
        snipText: "[[2+3=",
        expansion: "5",
        cursorChange: "",
    },
];

/*
 * TEST:
 *  check if mathomania works
 */
function testMathomania(usablePages) {
    testURLs.forEach(({ url, textBoxQueryString, handler }, index) => {
        let usablePage,
            loadedPromise;

        beforeAll(async () => {
            ({ usablePage, loadedPromise } = usablePages[index]);
            await loadedPromise;
            // unless we bring it to front, it does not activate snippets
            await usablePage.bringToFront();
        });

        describe(`Mathomania works on ${
            url.match(/https?:\/\/(\w+\.)+\w+/)[0]
        }`, () => {
            testExpressions.forEach(({ snipText, expansion, cursorChange }) => {
                it(`${snipText} should do the math`, async () => {
                    const expandedText = await getExpandedSnippet(
                        usablePage,
                        textBoxQueryString,
                        snipText,
                        cursorChange,
                        handler,
                        false,
                    );
                    await expect(expandedText).toBe(expansion);
                });
            });
        });
    });
}

module.exports = {
    testMathomania,
};
