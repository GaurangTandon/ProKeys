// this file adds useful extensions to prototypes of various primitives
// it is indcluded with the other files

import { DOM_HELPERS } from "./pre";
import { extendNodePrototype } from "./protoExtend";
import { getHTML, setHTML } from "./textmethods";

(function () {
    Date.MONTHS = [
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
    ];
    Date.DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
    Date.MILLISECONDS_IN_A_DAY = 86400 * 1000;
    // eslint-disable-next-line no-proto
    NodeList.prototype.__proto__ = Array.prototype;

    function isLeapYear(year) {
        return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
    }

    Date.prototype.isLeapYear = function () {
        const year = this.getFullYear();
        return isLeapYear(year);
    };

    Date.getCurrentTimestamp = function () {
        const date = new Date(),
            hours = Number.padNumber(date.getHours()),
            minutes = Number.padNumber(date.getMinutes()),
            seconds = Number.padNumber(date.getSeconds());

        return `${hours}:${minutes}:${seconds}`;
    };

    Date.getDayOfYear = function () {
        const dayCount = [0, 31, 59, 90, 120, 151, 181, 212, 243, 273, 304, 334],
            mn = this.getMonth(),
            dn = this.getDate();
        let dayOfYear = dayCount[mn] + dn;

        // if mn is ahead of february (= 1)
        if (mn > 1 && this.isLeapYear()) {
            dayOfYear++;
        }

        return dayOfYear;
    };

    // starting from next month until `num` months
    // subtracting 1/2 for february (account for leap year)
    // adding 1 for 31st days
    Date.getTotalDeviationFrom30DaysMonth = function (num) {
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
    };
    // receives 24 hour; comverts to 12 hour
    // return [12hour, "am/pm"]
    Date.to12Hrs = function (hour) {
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
    };

    Date.parseDay = function (dayNum, type) {
        return type === "full" ? Date.DAYS[dayNum] : Date.DAYS[dayNum].slice(0, 3);
    };

    // accepts num (0-11); returns month
    // type means full, or half
    Date.parseMonth = function (month, type) {
        return type === "full" ? Date.MONTHS[month] : Date.MONTHS[month].slice(0, 3);
    };

    // appends th, st, nd, to date
    Date.formatDate = function (date) {
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
    };

    /**
     * @param: timestamp: optional
     */
    Date.getFormattedDate = function (timestamp) {
        const d = (timestamp ? new Date(timestamp) : new Date()).toString();

        // sample date would be:
        // "Sat Feb 20 2016 09:17:23 GMT+0530 (India Standard Time)"
        return d.substring(4, 15);
    };

    // prepends 0 to single digit num and returns it
    // as a string
    Number.padNumber = function (num) {
        num = parseInt(num, 10);

        return (num <= 9 ? "0" : "") + num;
    };

    /**
     * removes the content inside those indices from the string
     * @param {Integer} posStart the index to start removing text from
     * @param {Integer} posEnd the index to stop removing text at
     */
    String.prototype.unsubstring = function (posStart, posEnd) {
        return this.substring(0, posStart) + this.substring(posEnd);
    };

    extendNodePrototype("trigger", function (eventName, obj) {
        const ev = new CustomEvent(eventName, {
            detail: obj || null,
        });
        // those functions which need to access
        // the custom values will need to separately
        // access the "detail" property, in such a way:
        // (ev.detail && ev.detail[requiredProperty]) || ev[requiredProperty]
        // because if detail is not passed it's always null

        this.dispatchEvent(ev);
    });

    extendNodePrototype("triggerKeypress", function (keyCode) {
        const ev = new Event("input");
        ev.keyCode = keyCode;
        this.dispatchEvent(ev);
    });

    extendNodePrototype(
        "on",
        /**
         * letting the window.on to exist for legacy, but won't
         * recommend using as contentWindow's of iframes will not
         * have this property set
         */
        (window.on = function (nameList, fn, useCapture) {
            const names = nameList.split(/,\s*/g);

            for (const name of names) {
                this.addEventListener(name, fn, useCapture);
            }

            return this;
        }),
    );

    // inserts the newNode after `this`
    extendNodePrototype("insertAfter", function (newNode) {
        this.parentNode.insertBefore(newNode, this.nextSibling);
        return this;
    });

    extendNodePrototype("hasClass", function (className) {
        return this.className && new RegExp(`(^|\\s)${className}(\\s|$)`).test(this.className);
    });

    extendNodePrototype("toggleClass", function (cls) {
        this.classList.toggle(cls);
        return this;
    });

    extendNodePrototype("addClass", function (cls) {
        // multiple classes to add
        if (!Array.isArray(cls)) {
            cls = [cls];
        }

        cls.forEach((e) => {
            this.classList.add(e);
        });

        return this;
    });

    extendNodePrototype("removeClass", function (cls) {
        // multiple classes to remove
        if (!Array.isArray(cls)) {
            cls = [cls];
        }

        cls.forEach((e) => {
            this.classList.remove(e);
        });

        return this;
    });

    extendNodePrototype("isTextBox", function () {
        return this.tagName === "INPUT" || this.tagName === "TEXTAREA";
    });

    extendNodePrototype("attr", function (name, val) {
        if (typeof val !== "undefined") {
            this.setAttribute(name, val);
            return this;
        }
        return this.getAttribute(name);
    });

    extendNodePrototype("parent", function (selector) {
        let parent = this.parentElement;

        while (parent) {
            if (parent.matches(selector)) {
                return parent;
            }

            parent = parent.parentElement;
        }

        return null;
    });

    // prototype alternative for setHTML/getHTML
    // use only when sure that Node is "not undefined"
    extendNodePrototype("html", function (textToSet, prop, isListSnippets) {
        // can be zero/empty string; make sure it's undefined
        return typeof textToSet !== "undefined"
            ? setHTML(this, textToSet, prop, isListSnippets)
            : getHTML(this, prop);
    });

    // prototype alternative for setText/getText
    // use only when sure that Node is "not undefined"
    extendNodePrototype("text", function (textToSet) {
        // can be zero/empty string; make sure it's undefined
        return this.html(textToSet, "innerText");
    });

    extendNodePrototype("unwrap", function () {
        const children = this.childNodes,
            parent = this.parentNode;
        let { nextSibling } = this,
            child,
            len = children.length;

        while (len > 0) {
            child = children[len - 1];

            if (nextSibling) {
                parent.insertBefore(child, nextSibling);
            } else {
                parent.appendChild(child);
            }

            nextSibling = child;
            len--;
        }

        parent.removeChild(this);
    });

    for (const [funcName, func] of Object.entries(DOM_HELPERS)) {
        window[funcName] = func.bind(document);
        extendNodePrototype(funcName, func);
    }
}());
