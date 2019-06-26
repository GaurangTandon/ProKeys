const moduleObject = {
    rules: [
        {
            test: /\.js$/,
            exclude: /(node_modules|bower_components)/,
            use: {
                loader: "babel-loader",
                options: {
                    presets: ["@babel/preset-env"],
                },
            },
        },
    ],
};

// webpack will only transform all import/export directives
// gulp will minify all the files
module.exports = {
    // development mode ensures terser (es6 minifier) is not run
    // see https://webpack.js.org/configuration/mode
    module: moduleObject,
    mode: "development",
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
