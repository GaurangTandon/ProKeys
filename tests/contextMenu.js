const testURLs = require("./testURLs"),
    { getContextMenuInsertion } = require("./utils");

const testSnippets = [
    // sorry, could find no other way
    {
        keyToHighlightMenu: "w",
        cursorChange: "hjljjjj",
        expansion: "be right back",
    },
];

function testContextMenuInsertion(usablePages) {
    testURLs.forEach(({ url, textBoxQueryString, handler }, index) => {
        let usablePage,
            loadedPromise;

        beforeAll(async () => {
            ({ usablePage, loadedPromise } = usablePages[index]);

            await loadedPromise;
            await usablePage.bringToFront();
        });

        describe(`Test context menu insertion on ${
            url.match(/https?:\/\/(\w+\.)+\w+/)[0]
        }`, () => {
            testSnippets.forEach(({ keyToHighlightMenu, cursorChange, expansion }) => {
                it(`should insert ${expansion}`, async () => {
                    const insertedText = await getContextMenuInsertion(
                        usablePage,
                        textBoxQueryString,
                        keyToHighlightMenu,
                        cursorChange,
                        handler,
                    );

                    await expect(insertedText).toBe(expansion);
                });
            });
        });
    });
}

module.exports = {
    testContextMenuInsertion,
};
