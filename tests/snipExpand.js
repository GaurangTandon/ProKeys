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
    {
        snipText: "embed",
        expansion: "be right back",
        cursorChange: "",
        delimitedExpansion: "be right back",
    },
    {
        snipText: "url",
        expansion: "%url%",
        cursorChange: "",
        delimitedExpansion: "%url%",
    },
];

/*
 * TEST:
 *  check if snippets are expanding normally
 */
function testSnippetExpansion(usablePages) {
    testURLs.forEach(({ url, textBoxQueryString, handler }, index) => {
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
                if (expansion === "%url%") {
                    expansion = url;
                }

                it(`${snipText} should expand`, async () => {
                    const expandedText = await getExpandedSnippet(
                        usablePage,
                        textBoxQueryString,
                        snipText,
                        cursorChange,
                        handler,
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

    testURLs.forEach(({ url, textBoxQueryString, handler }, index) => {
        let usablePage;

        beforeAll(async () => {
            ({ usablePage } = usablePages[index]);
            // unless we bring it to front, it does not activate snippets
            await usablePage.bringToFront();
            await usablePage.reload();
        });

        describe(`Delimited snipppet behaves correctly on ${
            url.match(/https?:\/\/(\w+\.)+\w+/)[0]
        }`, () => {
            testSnippets.forEach(({ snipText, cursorChange, delimitedExpansion }) => {
                it(`${snipText} should become ${delimitedExpansion}`, async () => {
                    if (delimitedExpansion === "%url%") {
                        delimitedExpansion = url;
                    }

                    const expandedText = await getExpandedSnippet(
                        usablePage,
                        textBoxQueryString,
                        snipText,
                        cursorChange,
                        handler,
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
