const { sleep } = require("./utils");

/* eslint-disable no-unused-vars */
const tinyCloudExpansionHandler = {
        queryString: "document.querySelector(\"iframe\").contentDocument.querySelectorAll(\"p\")[1]",
        h2: null,

        focusTextBox: async (page) => {
            const iframe = await page.evaluateHandle(() => document.querySelector("iframe[id^=\"tiny-react\"]")),
                h2 = await page.evaluateHandle(iframeArg => iframeArg.contentDocument.querySelector("h2"), iframe);
            this.h2 = h2;
            h2.focus();
            await iframe.dispose();
            await sleep(10000);
        },
        retrieveText: async (page) => {
        // await page.evaluateHandle(() => )
        },
        clearText: (page) => {
        // clear the text present there
            const indexOfUsableTag = 1;
        },
    },
    testURLs = [
        // {
        //     url:
        //         "https://stackoverflow.com/questions/50990292/"
        //         + "using-octal-character-gives-warning-multi-character-character-constant",
        //     textBoxQueryString: "#wmd-input",
        // },
        // {
        //     url:
        //         "https://serverfault.com/questions/971011/"
        //         + "how-to-check-if-an-active-directory-server-is-reachable-from-an-ubuntu-apache-ph",
        //     textBoxQueryString: "#wmd-input",
        // },
        {
            url: "https://www.tiny.cloud/",
            handler: tinyCloudExpansionHandler,
        },
    ];

module.exports = testURLs;
