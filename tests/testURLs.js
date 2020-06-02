// eslint-disable-next-line no-unused-vars
const { sleep } = require("./utils");

/*
const tinyCloudExpansionHandler = {
        p: null,
        frame: null,
        focusTextBox: async (page) => {
            // idk why but it fails if I don't wait :(
            await sleep(5000);

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
            const txt = await this.frame.evaluate(p => p.textContent, this.p);

            return txt;
        },
        clearText: async () => {
            await this.frame.evaluate((p) => {
                p.innerHTML = "<br>";
            }, this.p);
        },
    };
*/
const testURLs = [
    {
        url:
      "https://stackoverflow.com/questions/50990292/"
      + "using-octal-character-gives-warning-multi-character-character-constant",
        textBoxQueryString: "#wmd-input",
    },
    {
        url:
      "https://serverfault.com/questions/971011/"
      + "how-to-check-if-an-active-directory-server-is-reachable-from-an-ubuntu-apache-ph",
        textBoxQueryString: "#wmd-input",
    },
    /*
        {
            url: "https://www.tiny.cloud/",
            handler: tinyCloudExpansionHandler,
        },
        */
];

module.exports = testURLs;
