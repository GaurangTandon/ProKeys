const tinyCloudExpansionHandler = {
    //  TODO:
    //      make these functions ready on the queryString given below
    //      queryString:
    //          `document.querySelector("iframe").contentDocument.querySelectorAll("p")[1]`

        focusTextBox: (page) => {
            // Make the cursor blink on the above mentioned node
            const indexOfUsableTag = 1;
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
    //  TODO:
    //      make these tests pass [after uncommenting]
    //  {
    //  url: "https:www.tiny.cloud/",
    //  handler: tinyCloudExpansionHandler,
    //  },
    ];

module.exports = testURLs;
