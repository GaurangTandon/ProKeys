const {
        getExpandedSnippet, copyTextToClipboard,
    } = require("./utils"),
    testURLs = require("./testURLs");

const testSnippets = [
    {
        snipText: "clipboard",
        expansion: "vim is the best text editor",
        cursorChange: "",
        delimitedExpansion: "vim is the best text editor",
    },
];

function testClipboard(usablePages) {
    testURLs.forEach(({ url, textBoxQueryString, handler }, index) => {
        let usablePage;

        beforeAll(async () => {
            ({ usablePage } = usablePages[index]);
            // unless we bring it to front, it does not activate snippets
            await usablePage.bringToFront();
            await copyTextToClipboard(usablePage, "vim is the best text editor");
        });

        describe(`Testing clipboard on ${
            url.match(/https?:\/\/(\w+\.)+\w+/)[0]
        }`, () => {
            testSnippets.forEach(({
                snipText, cursorChange, expansion,
            }) => {
                it("Clipboard content should be expanded", async () => {
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

module.exports = {
    testClipboard,
};
