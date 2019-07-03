const { getExpandedSnippet, copyTextToClipboard } = require("./utils"),
    testURLs = require("./testURLs");

function testSnippetMacroBase(usablePages, testName, testSnippets) {
    testURLs.forEach(({ url, textBoxQueryString, handler }, index) => {
        let usablePage,
            loadedPromise;

        beforeAll(async () => {
            ({ usablePage, loadedPromise } = usablePages[index]);
            // unless we bring it to front, it does not activate snippets
            await usablePage.bringToFront();
            await loadedPromise;
        });

        describe(`Testing snippet macro on ${
            url.match(/https?:\/\/(\w+\.)+\w+/)[0]
        }`, () => {
            testSnippets.forEach(({
                snipText, cursorChange, expansion, preExpand,
            }) => {
                beforeEach(async () => {
                    const random = Math.random().toString(36).split(".")[1];

                    if (expansion === "%random%") {
                        expansion = random;
                    }

                    if (preExpand.length) {
                        const func = preExpand[0],
                            args = preExpand.slice(1);

                        args.forEach((el, i) => {
                            if (el === "%random%") { args[i] = random; }
                        });

                        await func(usablePage, ...args);
                    }
                });

                it(`Testing ${testName}`, async () => {
                    if (expansion === "%url%") { expansion = url; }

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

function testEmbeddedSnippet(usablePages) {
    const embedSnippets = [{
        snipText: "embed",
        expansion: "be right back",
        preExpand: [],
    }];

    testSnippetMacroBase(usablePages, "embedded snippet", embedSnippets);
}

function testURLSnippet(usablePages) {
    const urlSnippets = [{
        snipText: "url",
        expansion: "%url%",
        cursorChange: "",
        preExpand: [],
    }];

    testSnippetMacroBase(usablePages, "url snippet", urlSnippets);
}

function testClipboardSnippet(usablePages) {
    const clipboardSnippets = [{
        snipText: "clipboard",
        expansion: "%random%",
        cursorChange: "",
        preExpand: [copyTextToClipboard, "%random%"],
    }];

    testSnippetMacroBase(usablePages, "clipboard snippets", clipboardSnippets);
}

module.exports = {
    testClipboardSnippet,
    testEmbeddedSnippet,
    testURLSnippet,
};
