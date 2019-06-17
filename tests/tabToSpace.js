const {
        getTabToSpaceExpansion,
        updateSettings,
        extSettings,
    } = require("./utils"),
    testURLs = require("./testURLs");

function testTabToSpaceExpansion(usablePages) {
    testURLs.forEach(({ url, textBoxQueryString }, index) => {
        let usablePage,
            loadedPromise;

        beforeAll(async () => {
            ({ usablePage, loadedPromise } = usablePages[index]);
            await loadedPromise;
            // unless we bring it to front, it does not activate snippets
            await usablePage.bringToFront();
        });

        describe(`Tab -> space on ${
            url.match(/https?:\/\/(\w+\.)+\w+/)[0]
        }`, () => {
            beforeAll(async () => {
                await updateSettings(
                    extSettings({ matchDelimitedWord: false, tabKeyExpandSpace: true }),
                );
            });

            it("Should convert tab -> space", async () => {
                const text = await getTabToSpaceExpansion(
                    usablePage,
                    textBoxQueryString,
                );

                expect(text).toBe("    ");
            });
        });
    });
}

module.exports = { testTabToSpaceExpansion };
