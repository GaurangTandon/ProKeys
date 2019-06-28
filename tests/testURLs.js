// eslint-disable-next-line no-unused-vars
const { sleep } = require("./utils");

const tinyCloudExpansionHandler = {
        p: null,
        frame: null,
        focusTextBox: async (page) => {
            const iframeElm = await page.$("iframe[id^=\"tiny-react\"]"),
                iframe = await iframeElm.contentFrame();

            this.frame = iframe;
            // use the first paragraph element that you find
            this.p = await iframe.$("p");

            expect(iframeElm).toBeTruthy();
            expect(this.p).toBeTruthy();

            await iframeElm.focus();
            await iframeElm.focus(this.p);
        },
        retrieveText: async () => {
            const val = await this.frame.evaluateHandle(p => p.innerHTML, this.p);
            // console.log(val);
            console.log(await val.jsonValue());
            console.log("got value");
            await val.dispose();
            await sleep(5000);
            return "asd";
        },
        clearText: async () => {
            await this.frame.evaluate((p) => { p.innerHTML = ""; }, this.p);
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
