const { getExpandedSnippet, updateSettings } = require("./utils"),
    testURLs = require("./testURLs"),
    { sleep } = require("./utils.js");

const testSnippets = [
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

/*
 * TEST:
 *  check if snippets are expanding normally
 */
function testSnippetExpansion(usablePages) {
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
}

/*
 * TEST:
 *  check if snippets obey delimited settings
 */
function testSnippetExpansionDelimited(usablePages) {
    testURLs.forEach(({ url, textBoxQueryString }, index) => {
        let usablePage;

        beforeAll(async () => {
            await sleep(30000);

            ({ usablePage } = usablePages[index]);
            // unless we bring it to front, it does not activate snippets
            await usablePage.bringToFront();
            await updateSettings({ matchDelimitedWord: true });
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
}

module.exports = {
    testSnippetExpansion,
    testSnippetExpansionDelimited,
};
