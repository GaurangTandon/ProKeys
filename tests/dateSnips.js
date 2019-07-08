const testURLs = require("./testURLs"),
    { getDateTestParams, getExpandedSnippet } = require("./utils");

const testSnippets = [
    {
        snipText: "date",
        cursorChange: "",
        expansion: "%date%",
    },
    {
        snipText: "date_dm5",
        cursorChange: "",
        expansion: "%date%-5",
    },
];

function testDateSnippets(usablePages) {
    testURLs.forEach(({ url, textBoxQueryString, handler }, index) => {
        let usablePage,
            loadedPromise;

        beforeAll(async () => {
            ({ usablePage, loadedPromise } = usablePages[index]);
            await loadedPromise;
            await usablePage.bringToFront();
        });

        describe(`Date snippet works on ${
            url.match(/https?:\/\/(\w+\.)+\w+/)[0]
        }`, () => {
            testSnippets.forEach(({
                snipText, expansion, cursorChange,
            }) => {
                it("should match with test dates", async () => {
                    if (expansion === "%date%") {
                        expansion = await getDateTestParams();
                    } else if (expansion === "%date%-5") {
                        const d = new Date();
                        // eslint-disable-next-line no-magic-numbers
                        d.setDate(d.getDate() - 5);
                        expansion = await getDateTestParams(d.toString().split(" "));
                    }

                    const expandedText = await getExpandedSnippet(
                        usablePage,
                        textBoxQueryString,
                        snipText,
                        cursorChange,
                        handler,
                    );

                    await expect(expandedText).toBe(expansion.join(" "));
                });
            });
        });
    });
}

module.exports = {
    testDateSnippets,
};
