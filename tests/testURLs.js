/* eslint-disable no-unused-vars */
const tinyCloudExpansionHandler = {
        queryString: "document.querySelector(\"iframe\").contentDocument.querySelectorAll(\"p\")[1]",

        focusTextBox: (page) => {
            console.log(page);
        },
        retrieveText: (page) => {
        // strip all html tags and return just the text [what we see]
            const indexOfUsableTag = 1;
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
