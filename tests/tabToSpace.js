const {
        getTabToSpaceExpansion,
        updateSettings,
        extSettings,
    } = require("./utils"),
    testURLs = require("./testURLs");

function testTabToSpaceExpansion(usablePages) {
    beforeAll(async () => {
        await updateSettings(
            extSettings({ matchDelimitedWord: false, tabKeyExpandSpace: true }),
        );
    });

    afterAll(async () => {
        await updateSettings(
            extSettings({ matchDelimitedWord: false, tabKeyExpandSpace: false }),
        );
    });

    testURLs.forEach(({ url, textBoxQueryString }, index) => {
        let usablePage,
            loadedPromise;

        beforeAll(async () => {
            ({ usablePage, loadedPromise } = usablePages[index]);
            await loadedPromise;
            // unless we bring it to front, it does not activate snippets
            await usablePage.bringToFront();
            await usablePage.reload();
        });

        describe(`Tab -> space on ${
            url.match(/https?:\/\/(\w+\.)+\w+/)[0]
        }`, () => {
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
