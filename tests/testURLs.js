// eslint-disable-next-line no-unused-vars
const { sleep } = require("./utils");

const tinyCloudExpansionHandler = {
        p: null,
        focusTextBox: async (page) => {
            await sleep(5000);
            console.log("focusTextBox called");

            const iframeElm = await page.$("iframe[id^=\"tiny-react\"]"),
                iframe = await iframeElm.contentFrame(),
                allPTags = await iframe.$$("p");

            for (let i = 0; i < allPTags.length; i++) {
                const p = allPTags[i],
                    txt = await iframe.evaluate(el => el.innerHTML, p);

                if (txt === "<br>") {
                    console.log("FOUND EMPTY!!", i);
                    this.p = p;
                    break;
                }
            }

            expect(iframeElm).toBeTruthy();
            expect(this.p).toBeTruthy();

            await iframeElm.focus();
            await iframeElm.focus(this.p);
            await iframeElm.click(this.p);

            console.log("FOCUSSED");
            console.log("TYPE SOMETHING NOW TO SEE WHERE IT GETS TYPED");
            await sleep(10000);
        },
        retrieveText: async (page) => {
            const iframeElm = await page.$("iframe[id^=\"tiny-react\"]"),
                iframe = await iframeElm.contentFrame(),
                h2 = await iframe.$("h2");

            await iframe.evaluate((heading2) => {
                console.log(heading2);
                return heading2.innerHTML;
            }, h2);
        },
        clearText: async (page) => {
            const iframeElm = await page.$("iframe[id^=\"tiny-react\"]"),
                iframe = await iframeElm.contentFrame(),
                h2 = await iframe.$("h2");

            await iframe.evaluate((heading2) => {
                heading2.innerHTML = "";
            }, h2);
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
