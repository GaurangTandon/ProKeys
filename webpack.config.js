// webpack will only transform all import/export directives
// gulp will minify all the files
module.exports = {
    entry: {
        background: `${__dirname}/js/background.js`,
        detector: `${__dirname}/js/detector.js`,
        options: `${__dirname}/js/options.js`,
    },
    output: {
        filename: "[name].js",
        path: `${__dirname}/dist/js`,
    },
};
