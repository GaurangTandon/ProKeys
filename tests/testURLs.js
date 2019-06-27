// eslint-disable-next-line no-unused-vars
const { sleep } = require("./utils");

const tinyCloudExpansionHandler = {
        queryString: "document.querySelector(\"iframe\").contentDocument.querySelectorAll(\"p\")[1]",
        h2: null,

        focusTextBox: async (page) => {
            const h2 = await page.$("iframe[id^=\"tiny-react\"]", iframeArg => iframeArg.contentDocument.querySelector("h2"));
            this.h2 = h2;
            await h2.focus();
        },
        retrieveText: async page => page.evaluate(h2 => h2.innerHTML, this.h2),
        clearText: async (page) => {
            await page.evaluate((h2) => { h2.innerHTML = ""; }, this.h2);
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
