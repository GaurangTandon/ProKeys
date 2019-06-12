function assert(condition) {
    const greenBg = "\x1b[42m",
        redBg = "\x1b[41m",
        blackFg = "\x1b[30m",
        reset = "\x1b[0m";
    if (condition) {
        console.log(`${greenBg + blackFg}PASSED😊${reset}`);
    } else {
        console.log(`${redBg + blackFg}FAILED😔${reset}`);
    }
}

module.exports = assert;
