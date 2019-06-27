// eslint-disable-next-line no-unused-vars
const { sleep } = require("./utils");

const tinyCloudExpansionHandler = {
        queryString: "document.querySelector(\"iframe\").contentDocument.querySelectorAll(\"p\")[1]",
        h2: null,

        focusTextBox: async (page) => {
        // const frames = await page.frames(),
        //     myFrame = frames.find(
        //         frame => frame.url().indexOf("NewRegistration") > 0,
        //     ),
        //     serialNumber = await myframe.$("#MainContent_SerNumText"),

            //     h2 = await page.$eval("iframe[id^=\"tiny-react\"]", (iframeArg) => {
            //         console.log("1", iframeArg);
            //         return iframeArg.contentDocument.querySelector("h2");
            //     });
            const iframeElm = await page.$("iframe[id^=\"tiny-react\"]"),
                iframe = await iframeElm.contentFrame();
            this.h2 = await iframe.$("h2");
            console.log(Object.keys(iframe));
            console.log(this.h2);

            if (this.h2) { await this.h2.focus(); }
        },
        retrieveText: async page => page.evaluate((h2) => {
            console.log(h2);
            return h2.innerHTML;
        }, this.h2),
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
