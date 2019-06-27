const { getExpandedPlaceHolderSnippet } = require("./utils"),
    testURLs = require("./testURLs");

const testSnippets = [
    {
        snipText: "test",
        expansion: "hello yoogottam the great",
        cursorChange: "",
        delimitedExpansion: "hello yoogottam the great",
    },
];

/*
 * TEST:
 *  check if snippets are expanding normally
 */
function testPlaceHolderSnippetExpansion(usablePages) {
    testURLs.forEach(({ url, textBoxQueryString, handler }, index) => {
        let usablePage,
            loadedPromise;

        beforeAll(async () => {
            ({ usablePage, loadedPromise } = usablePages[index]);
            await loadedPromise;
            // unless we bring it to front, it does not activate snippets
            await usablePage.bringToFront();
        });

        describe(`Placeholder snipppet expands on ${
            url.match(/https?:\/\/(\w+\.)+\w+/)[0]
        }`, () => {
            testSnippets.forEach(({ snipText, expansion }) => {
                it(`${snipText} should expand`, async () => {
                    const expandedText = await getExpandedPlaceHolderSnippet(
                        usablePage,
                        textBoxQueryString,
                        snipText,
                        ["yoogottam", "the great"],
                        handler,
                    );
                    await expect(expandedText).toBe(expansion);
                });
            });
        });
    });
}

module.exports = { testPlaceHolderSnippetExpansion };
