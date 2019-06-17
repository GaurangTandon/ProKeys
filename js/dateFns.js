/**
 * This file consists of non-proto extended Date functions
 * For extending date prototype refer to primitiveExtend.js file
 */

const MONTHS = [
        "January",
        "February",
        "March",
        "April",
        "May",
        "June",
        "July",
        "August",
        "September",
        "October",
        "November",
        "December",
    ],
    DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"],
    MILLISECONDS_IN_A_DAY = 86400 * 1000;
function getCurrentTimestamp() {
    const date = new Date(),
        hours = Number.padNumber(date.getHours()),
        minutes = Number.padNumber(date.getMinutes()),
        seconds = Number.padNumber(date.getSeconds());

    return `${hours}:${minutes}:${seconds}`;
}

function isLeapYear(year) {
    return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
}

// starting from next month until `num` months
// subtracting 1/2 for february (account for leap year)
// adding 1 for 31st days
function getTotalDeviationFrom30DaysMonth(num) {
    const currDate = new Date(),
        maxMonth = Math.abs(num),
        isNegative = num < 0,
        monthChange = isNegative ? 1 : -1;
    let totalDaysChange = 0,
        currMonth = currDate.getMonth(),
        currYear = currDate.getFullYear(),
        monthIndex = 0;

    while (monthIndex <= maxMonth) {
        currMonth += monthChange;

        if (currMonth > 11) {
            currMonth = 0;
            currYear++;
        } else if (currMonth < 0) {
            currMonth = 11;
            currYear--;
        }

        switch (currMonth) {
        // months with 31 days
        case 0:
        case 2:
        case 4:
        case 6:
        case 7:
        case 9:
        case 11:
            totalDaysChange++;
            break;
            // february
        case 1:
            totalDaysChange--;
            // leap year 29 days; one less than 30 days
            if (!isLeapYear(currYear)) {
                totalDaysChange--;
            }
            break;
            // not possible
        default:
        }

        monthIndex++;
    }

    return isNegative ? -totalDaysChange : totalDaysChange;
}
// receives 24 hour; comverts to 12 hour
// return [12hour, "am/pm"]
function to12Hrs(hour) {
    if (hour === 0) {
        return [12, "am"];
    }
    if (hour === 12) {
        return [12, "pm"];
    }
    if (hour >= 1 && hour < 12) {
        return [hour, "am"];
    }
    return [hour - 12, "pm"];
}

function parseDay(dayNum, type) {
    return type === "full" ? DAYS[dayNum] : DAYS[dayNum].slice(0, 3);
}

// accepts num (0-11); returns month
// type means full, or half
function parseMonth(month, type) {
    return type === "full" ? MONTHS[month] : MONTHS[month].slice(0, 3);
}

// appends th, st, nd, to date
function formatDate(date) {
    const rem = date % 10;
    let str = "th";

    if (rem === 1 && date !== 11) {
        str = "st";
    } else if (rem === 2 && date !== 12) {
        str = "nd";
    } else if (rem === 3 && date !== 13) {
        str = "rd";
    }

    return date + str;
}

/**
* @param: timestamp: optional
*/
function getFormattedDate(timestamp) {
    const d = (timestamp ? new Date(timestamp) : new Date()).toString();

    // sample date would be:
    // "Sat Feb 20 2016 09:17:23 GMT+0530 (India Standard Time)"
    return d.substring(4, 15);
}

const DATE_MACROS = [
    // use word boundary in only those macros which
    // overlap with any other subsequent macro
    [
        "s([+-]\\d+)?",
        [
            function (date) {
                return Number.padNumber(date.getSeconds());
            },
            1000,
        ],
    ],
    [
        "\\bm([+-]\\d+)?\\b",
        [
            function (date) {
                return Number.padNumber(date.getMinutes());
            },
            60000,
        ],
    ],
    [
        "hh([+-]\\d+)?",
        [
            function (date) {
                return Number.padNumber(date.getHours());
            },
            3600000,
        ],
    ],
    [
        "h([+-]\\d+)?",
        [
            function (date) {
                return Number.padNumber(to12Hrs(date.getHours())[0]);
            },
            3600000,
        ],
    ],
    [
        "\\ba\\b",
        [
            function (date) {
                return to12Hrs(date.getHours())[1];
            },
            MILLISECONDS_IN_A_DAY,
        ],
    ],
    [
        "Do([+-]\\d+)?",
        [
            function (date) {
                return formatDate(date.getDate());
            },
            MILLISECONDS_IN_A_DAY,
        ],
    ],
    [
        "D([+-]\\d+)?",
        [
            function (date) {
                return Number.padNumber(date.getDate());
            },
            MILLISECONDS_IN_A_DAY,
        ],
    ],
    [
        "dddd([+-]\\d+)?",
        [
            function (date) {
                return parseDay(date.getDay(), "full");
            },
            MILLISECONDS_IN_A_DAY,
        ],
    ],
    [
        "ddd([+-]\\d+)?",
        [
            function (date) {
                return parseDay(date.getDay(), "half");
            },
            MILLISECONDS_IN_A_DAY,
        ],
    ],
    [
        "MMMM([+-]\\d+)?",
        [
            function (date) {
                return parseMonth(date.getMonth(), "full");
            },
            MILLISECONDS_IN_A_DAY * 30,
        ],
    ],
    [
        "MMM([+-]\\d+)?",
        [
            function (date) {
                return parseMonth(date.getMonth(), "half");
            },
            MILLISECONDS_IN_A_DAY * 30,
        ],
    ],
    [
        "MM([+-]\\d+)?",
        [
            function (date) {
                return Number.padNumber(date.getMonth() + 1);
            },
            MILLISECONDS_IN_A_DAY * 30,
        ],
    ],
    [
        "YYYY([+-]\\d+)?",
        [
            function (date) {
                return date.getFullYear();
            },
            MILLISECONDS_IN_A_DAY * 365,
        ],
    ],
    [
        "YY([+-]\\d+)?",
        [
            function (date) {
                return date.getFullYear() % 100;
            },
            MILLISECONDS_IN_A_DAY * 365,
        ],
    ],
    [
        "ZZ",
        [
            function (date) {
                return date.toString().match(/\((.*)\)/)[1];
            },
            0,
        ],
    ],
    [
        "Z",
        [
            function (date) {
                return date
                    .toString()
                    .match(/\((.*)\)/)[1]
                    .split(" ")
                    .reduce((a, b) => a + b[0], "");
            },
            0,
        ],
    ],
    [
        "z",
        [
            function (date) {
                return date.toString().match(/GMT(.*?) /)[1];
            },
            0,
        ],
    ],
    [
        "J",
        [
            function (date) {
                return date.getDayOfYear();
            },
            0,
        ],
    ],
    ["date", [getFormattedDate, 0]],
    ["time", [getCurrentTimestamp, 0]],
];

export {
    getCurrentTimestamp, getTotalDeviationFrom30DaysMonth, isLeapYear, getFormattedDate, MILLISECONDS_IN_A_DAY, DATE_MACROS,
};
