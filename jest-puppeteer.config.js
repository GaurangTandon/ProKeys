const pathToExtension = require("path").join(__dirname, "dist");

module.exports = {
    launch: {
        headless: false,
        args: [
            `--disable-extensions-except=${pathToExtension}`,
            `--load-extension=${pathToExtension}`,
            "--single-process"
        ],
        sloMo: 250,
    },
};
