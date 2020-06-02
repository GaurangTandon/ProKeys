const {
        extSettings, getExpandedSnippet, updateSettings,
    } = require("./utils"),
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

/**
 *
 * @param {Boolean} isDelimited
 * @param {Array} usablePages
 */
function commonSnippetTest(usablePages, isDelimited = false) {
    testURLs.forEach(({ url, textBoxQueryString, handler }, index) => {
        let usablePage,
            loadedPromise;

        beforeAll(async () => {
            ({ usablePage, loadedPromise } = usablePages[index]);
            // unless we bring it to front, it does not activate snippets
            await usablePage.bringToFront();
            if (isDelimited) { await usablePage.reload(); } else { await loadedPromise; }
        });

        describe(`${isDelimited ? "Delimited " : ""}snipppet expands on ${
            url.match(/https?:\/\/(\w+\.)+\w+/)[0]
        }`, () => {
            testSnippets.forEach(({
                snipText, cursorChange, expansion, delimitedExpansion,
            }) => {
                let usableExpansion = isDelimited ? delimitedExpansion : expansion;

                it(`${snipText} expands to ${usableExpansion}`, async () => {
                    if (usableExpansion === "%url%") {
                        usableExpansion = url;
                    }

                    const expandedText = await getExpandedSnippet(
                        usablePage,
                        textBoxQueryString,
                        snipText,
                        cursorChange,
                        handler,
                    );
                    await expect(expandedText).toBe(usableExpansion);
                });
            });
        });
    });
}

/*
 * TEST:
 *  check if snippets are expanding normally
 */
function testSnippetExpansion(usablePages) {
    commonSnippetTest(usablePages);
}

/*
 * TEST:
 *  check if snippets obey delimited settings
 */
function testSnippetExpansionDelimited(usablePages) {
    beforeAll(async () => {
        await updateSettings(
            extSettings({ matchDelimitedWord: true, tabKeyExpandSpace: false }),
        );
    });

    afterAll(async () => {
        await updateSettings(
            extSettings({ matchDelimitedWord: false, tabKeyExpandSpace: false }),
        );
    });
    commonSnippetTest(usablePages, true);
}

module.exports = {
    testSnippetExpansion,
    testSnippetExpansionDelimited,
};