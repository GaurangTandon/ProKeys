const { extSettings, getExpandedSnippet, updateSettings } = require("./utils"),
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
    // enable delimited in settings
    beforeAll(async () => {
        await updateSettings(
            extSettings({ matchDelimitedWord: true, tabKeyExpandSpace: false }),
        );
    });

    // disable delimited in settings
    afterAll(async () => {
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
}

module.exports = {
    testSnippetExpansion,
    testSnippetExpansionDelimited,
};
