const { getExpandedSnippet, updateSettings } = require("./utils"),
    testURLs = require("./testURLs");

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
    beforeAll(async () => {
        await updateSettings({ matchDelimitedWord: false });
    });

    testURLs.forEach(({ url, textBoxQueryString }, index) => {
        let usablePage,
            loadedPromise;

        describe(`Snipppet expands on ${
            url.match(/https?:\/\/(\w+\.)+\w+/)[0]
        }`, () => {
            // before all being inside kind of means that
            // before all tests for snippet expansion on this page,
            // load this page and bring it to front
            beforeAll(async () => {
                ({ usablePage, loadedPromise } = usablePages[index]);
                await loadedPromise;
                // unless we bring it to front, it does not activate snippets
                await usablePage.bringToFront();
            });

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
    beforeAll(async () => {
        await updateSettings({ matchDelimitedWord: true });
    });

    testURLs.forEach(({ url, textBoxQueryString }, index) => {
        let usablePage;


        describe(`Snipppet expands on ${
            url.match(/https?:\/\/(\w+\.)+\w+/)[0]
        }`, () => {
            beforeAll(async () => {
                ({ usablePage } = usablePages[index]);
                // unless we bring it to front, it does not activate snippets
                await usablePage.bringToFront();
            });
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
