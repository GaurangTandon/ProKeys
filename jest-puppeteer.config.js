const pathToExtension = require("path").join(__dirname, "dist"),
    prokeysUA = "iamprokeysyay";

module.exports = {
    launch: {
        headless: false,
        args: [
            `--disable-extensions-except=${pathToExtension}`,
            `--load-extension=${pathToExtension}`,
            "--single-process",
            `--user-agent=${prokeysUA}`,
        ],
        sloMo: 250,
    },
};
