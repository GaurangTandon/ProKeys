/* global q, pk, Snip */

// custom functions inspired from jQuery
// special thanks to
// bling.js - https://gist.github.com/paulirish/12fb951a8b893a454b32

// will be used to store prokeys related variables (#204)
window.pk = {};

/**
 * extends NodeList prototype per iframe present in the webpage
 */
// only one method exposed to user
let extendNodePrototype;
(function protoExtensionWork() {
    const protoExtensionNames = [],
        protoExtensionFunctions = [];
    function setNodeListPropPerWindow(prop, func, win) {
        // in case of custom created array of Nodes, Array.prototype is necessary
        win.Array.prototype[prop] = win.NodeList.prototype[prop] = win.HTMLCollection.prototype[
            prop
        ] = function (...args) {
            // HTMLCollection doesn't support forEach
            for (let i = 0, len = this.length; i < len; i++) {
                func.apply(this[i], args);
            }

            return this;
        };

        win.Node.prototype[prop] = func;
    }

    // called by detector.js
    pk.updateAllValuesPerWin = function (win) {
        for (let i = 0, count = protoExtensionNames.length; i < count; i++) {
            setNodeListPropPerWindow(protoExtensionNames[i], protoExtensionFunctions[i], win);
        }
    };

    /**
     * extends protoype of Node, Array and NodeList
     * @param (string) prop property to extend
     * @param (function) func function to execute per for each Node
     */
    extendNodePrototype = function (prop, func) {
        protoExtensionNames.push(prop);
        protoExtensionFunctions.push(func);
    };
}());

(function mainIIFE() {
    const DEBUGGING = false;

    pk.OBJECT_NAME_LIMIT = 30;
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
    Object.setPrototypeOf(NodeList, Array);

    Date.prototype.isLeapYear = function () {
        const year = this.getFullYear();
        return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
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
                if (!(currYear % 400 === 0 || (currYear % 100 !== 0 && currYear % 4 === 0))) {
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

    // see https://stackoverflow.com/q/13815640
    if (DEBUGGING) {
        window.debugLog = console.log.bind(console);
        window.debugDir = console.dir.bind(console);
    } else {
        window.debugLog = function () {};
        window.debugDir = function () {};
    }

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

    const DOM_HELPERS = {
        /**
         * short hand for document.querySelector
         * @param {string} selector selector to match element
         */
        q(selector) {
            return this.querySelector(selector);
        },
        /**
         * short hand for document.querySelectorAll
         * @param {string} selector selector to match elements
         */
        Q(selector) {
            return this.querySelectorAll(selector);
        },
        /**
         * short hand for document.getElementById
         * @param {string} id selector to match element
         */
        qId(id) {
            return this.getElementById(id);
        },
        /**
         * short hand for document.getElementsByClassName
         * @param {string} cls selector to match elements
         * @returns {Element[]} array (not HTMLCollection!) of matched elements
         */
        qCls(cls) {
            return Array.prototype.slice.call(this.getElementsByClassName(cls));
        },
        /**
         * short hand for document.getElementsByClassName;
         * returns the first Node in the output (not a NodeList)
         * @param {string} cls selector to match elements
         * @returns {Node} matched element
         */
        qClsSingle(cls) {
            const res = this.qCls(cls);
            return res && res[0];
        },
    };

    for (
        let i = 0, funcs = Object.keys(DOM_HELPERS), len = funcs.length, funcName, func;
        i < len;
        i++
    ) {
        funcName = funcs[i];
        func = DOM_HELPERS[funcName];
        window[funcName] = func.bind(document);
        extendNodePrototype(funcName, func);
    }

    q.new = function (tagName) {
        return document.createElement(tagName);
    };

    extendNodePrototype(
        "on",
        /**
         * letting the window.on to exist for legacy, but won't
         * recommend using as contentWindow's of iframes will not
         * have this property set
         */
        (window.on = function (name, fn, useCapture) {
            const names = name.split(/,\s*/g);

            for (let i = 0, len = names.length; i < len; i++) {
                this.addEventListener(names[i], fn, useCapture);
            }

            return this;
        }),
    );

    // inserts the newNode after `this`
    extendNodePrototype("insertAfter", function (newNode) {
        this.parentNode.insertBefore(newNode, this.nextSibling);
        return this;
    });

    // returns true if element has class; usage: Element.hasClass("class")
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

    function setHTMLPurificationForListSnippets(node) {
        // after we start splitting these text nodes and insert <br>s
        // the original text nodes and their count gets lost
        function getCurrentTextNodes() {
            const textNodesInNode = [];
            let child;

            for (let i = 0, len = node.childNodes.length; i < len; i++) {
                child = node.childNodes[i];
                if (pk.isTextNode(child)) {
                    textNodesInNode.push(child);
                }
            }

            return textNodesInNode;
        }
        const list = getCurrentTextNodes(),
            childCount = list.length;
        let count = 0,
            child,
            textNodes,
            i,
            len,
            tNode,
            $br,
            text;

        for (; count < childCount; count++) {
            child = list[count];

            // if a textnode has a single newline
            // => it is present between two element nodes
            // otherwise it would have had some text as well
            // so replace ONE newline first
            // BUT BUT this leads to loss of newline after
            // a simpler element node like <a> or <b>
            // hence, DO NOT do this

            textNodes = child.textContent.split(/\n/g);
            i = 0;
            len = textNodes.length;

            for (; i < len; i++) {
                text = textNodes[i];
                tNode = document.createTextNode(text);
                $br = q.new("br");
                node.insertBefore($br, child);
                node.insertBefore(tNode, $br);
            }
            // textNodes may be:
            // ["a"] or ["a", "b"]
            // the former implies there was NO newline in case like
            // <pre></pre>a<bq></bq>
            // hence have to remove the LAST newline that we've inserted
            node.removeChild($br);
            node.removeChild(child);
        }

        // block level elements already occupy a full line, hence, remove
        // ONE <br> after them
        node.Q("pre, blockquote, ol, ul").forEach((elm) => {
            const br = elm.nextElementSibling;
            if (br && br.tagName === "BR") {
                br.parentNode.removeChild(br);
            }
        });

        node.Q("ol, ul").forEach(Snip.formatOLULInListParentForCEnode);
    }

    // returns innerText
    pk.getText = function (node) {
        return pk.getHTML(node, "innerText");
    };

    // sets innerText
    pk.setText = function (node, newVal) {
        return pk.setHTML(node, newVal, "innerText");
    };

    pk.getHTML = function (node, prop) {
        if (!node) {
            return undefined;
        }

        if (pk.isTextNode(node)) {
            return node.textContent.replace(/\u00a0/g, " ");
        }

        switch (node.tagName) {
        case "TEXTAREA":
        case "INPUT":
            return node.value;
        default:
            return node[prop || "innerHTML"];
        }
    };

    pk.setHTML = function (node, newVal, prop, isListSnippets) {
        // in case number is passed; .replace won't work
        newVal = newVal.toString();

        if (pk.isTextNode(node)) {
            node.textContent = newVal.replace(/ /g, "\u00a0");
            return node;
        }

        switch (node.tagName) {
        case "TEXTAREA":
        case "INPUT":
            node.value = newVal.replace("<br>", "\n").replace("&nbsp;", " ");
            break;
        default:
            if (prop === "innerText") {
                // but innertext will collapse consecutive spaces
                // do not use textContent as it will collapse even single newlines
                node.innerText = newVal.replace("<br>", "\n").replace("&nbsp;", " ");
            } else {
                // first .replace is required as at the end of any text
                // as gmail will not display single space for unknown reason
                try {
                    node.innerHTML = newVal
                        .replace(/ $/g, "&nbsp;")
                        .replace(/ {2}/g, " &nbsp;");

                    if (!isListSnippets) {
                        node.innerHTML = node.innerHTML.replace(/\n/g, "<br>");
                    } else {
                        setHTMLPurificationForListSnippets(node);
                    }
                } catch (e) {
                    console.log("From setHTML: `node` argment is undefined");
                }
            }
        }

        return node;
    };

    // prototype alternative for setHTML/getHTML
    // use only when sure that Node is "not undefined"
    extendNodePrototype("html", function (textToSet, prop, isListSnippets) {
        // can be zero/empty string; make sure it's undefined
        return typeof textToSet !== "undefined"
            ? pk.setHTML(this, textToSet, prop, isListSnippets)
            : pk.getHTML(this, prop);
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

    // replaces string's `\n` with `<br>` or reverse
    // `convertForHTML` - true => convert text for display in html div (`.innerHTML`)
    // false => convrt text for dislplay in text area (`.value`)
    pk.convertBetweenHTMLTags = function (string, convertForHTML) {
        const map = [["<br>", "\\n"], [" &nbsp;", "  "]],
            regexIndex = +convertForHTML,
            replacerIdx = +!convertForHTML,
            len = map.length;
        let elm,
            i = 0;

        for (; i < len; i++) {
            elm = map[i];
            string = string.replace(new RegExp(elm[regexIndex], "g"), elm[replacerIdx]);
        }

        const container = q.new("div").html(string),
            selector = "pre + br, blockquote + br, li + br, ol > br, ol + br, ul + br, ul > br",
            unnecessaryBRs = container.Q(selector),
            count = unnecessaryBRs.length;

        for (i = 0; i < count; i++) {
            elm = unnecessaryBRs[i];
            elm.parentNode.removeChild(elm);
        }

        return container.innerHTML.replace(/&nbsp; ?&nbsp;<li>/g, "<li>");
    };

    pk.isObjectEmpty = function (obj) {
        for (const prop in obj) {
            if (Object.prototype.hasOwnProperty.call(obj, prop)) {
                return false;
            }
        }

        return true;
    };

    pk.escapeRegExp = function (str) {
        return str.replace(/[-[\]/{}())*+?.\\^$|]/g, "\\$&");
    };

    // prepends 0 to single digit num and returns it
    // as a string
    Number.padNumber = function (num) {
        num = parseInt(num, 10);

        return (num <= 9 ? "0" : "") + num;
    };

    pk.isObject = function (o) {
        return Object.prototype.toString.call(o) === "[object Object]";
    };

    // should use this since users may use foreign language
    // characters which use up more than two bytes
    pk.lengthInUtf8Bytes = function (str) {
        // Matches only the 10.. bytes that are non-initial characters in a multi-byte sequence.
        const m = encodeURIComponent(str).match(/%[89ABab]/g);
        return str.length + (m ? m.length : 0);
    };

    pk.isTextNode = function (node) {
        return node.nodeType === 3;
    };

    // if it is a callForParent, means that a child node wants
    // to get its parents checked
    // callForParent: flag to prevent infinite recursion
    pk.isContentEditable = function (node, callForParent) {
        const tgN = node && node.tagName;

        // insanity checks first
        if (!node || tgN === "TEXTAREA" || tgN === "INPUT" || !node.getAttribute) {
            return false;
        }

        let parent;
        // can also be a textnode
        const attr = node.attr ? node.attr("contenteditable") : null;

        // empty string to support <element contenteditable> markup
        if (attr === "" || attr === "true" || attr === "plaintext-only") {
            return true;
        }

        // important part below
        // note that if we introduce a snippet
        // then it generates <span> elements in contenteditable `div`s
        // but they don't have content-editable true attribute
        // so they fail the test, hence, here is a new check for them
        // search if their parents are contenteditable
        // but only do this if the current node is not a textarea
        // which we have checked above

        if (callForParent) {
            return false;
        }

        parent = node;
        do {
            parent = parent.parentNode;

            if (!parent) {
                return false;
            }

            if (pk.isContentEditable(parent, true)) {
                return true;
            }
        } while (parent !== window.document);

        return false;
    };

    /*  stack trace may sometimes not be beneficial, therefore
        use a unique identifier to track down the culprit */
    pk.checkRuntimeError = function (uniqueIdentifier) {
        return function checkREHelper() {
            if (chrome.runtime.lastError) {
                // TODO: remove
                // alert(
                // "An error occurred! Please press Ctrl+Shift+J/Cmd+Shift+J, copy whatever is shown in the 'Console' tab and report it at my email: prokeys.feedback@gmail.com . This will help me resolve your issue and improve my extension. Thanks!"
                // );
                console.log(chrome.runtime.lastError);
                console.trace();
                console.log(uniqueIdentifier);
                return true;
            }
            return false;
        };
    };

    // Returns a function, that, as long as it continues to be invoked, will not
    // be triggered. The function will be called after it stops being called for
    // N milliseconds. If `immediate` is passed, trigger the function on the
    // leading edge, instead of the trailing.
    pk.debounce = function (func, wait, immediate) {
        let timeout;
        return function (...args) {
            const context = this,
                later = function () {
                    timeout = null;
                    if (!immediate) {
                        func.apply(context, args);
                    }
                },
                callNow = immediate && !timeout;
            clearTimeout(timeout);
            timeout = setTimeout(later, wait);
            if (callNow) {
                func.apply(context, args);
            }
        };
    };

    /**
     * credits: Dean Taylor https://stackoverflow.com/users/406712/dean-taylor on StackOverflow https://stackoverflow.com/a/30810322/2675672
     */
    pk.copyTextToClipboard = function (text) {
        const textArea = document.createElement("textarea");

        //
        // *** This styling is an extra step which is likely not required. ***
        //
        // Why is it here? To ensure:
        // 1. the element is able to have focus and selection.
        // 2. if element was to flash render it has minimal visual impact.
        // 3. less flakyness with selection and copying which **might** occur if
        //    the textarea element is not visible.
        //
        // The likelihood is the element won't even render, not even a flash,
        // so some of these are just precautions. However in IE the element
        // is visible whilst the popup box asking the user for permission for
        // the web page to copy to the clipboard.
        //

        // Place in top-left corner of screen regardless of scroll position.
        textArea.style.position = "fixed";
        textArea.style.top = 0;
        textArea.style.left = 0;

        // Ensure it has a small width and height. Setting to 1px / 1em
        // doesn't work as this gives a negative w/h on some browsers.
        textArea.style.width = "2em";
        textArea.style.height = "2em";

        // We don't need padding, reducing the size if it does flash render.
        textArea.style.padding = 0;

        // Clean up any borders.
        textArea.style.border = "none";
        textArea.style.outline = "none";
        textArea.style.boxShadow = "none";

        // Avoid flash of white box if rendered for any reason.
        textArea.style.background = "transparent";

        textArea.value = text;

        document.body.appendChild(textArea);
        textArea.focus();
        textArea.select();

        try {
            document.execCommand("copy");
        } catch (err) {
            console.log("Oops, unable to copy");
        }

        document.body.removeChild(textArea);
    };

    /**
     * removes the content inside those indices from the string
     * @param {Integer} posStart the index to start removing text from
     * @param {Integer} posEnd the index to stop removing text at
     */
    String.prototype.unsubstring = function (posStart, posEnd) {
        return this.substring(0, posStart) + this.substring(posEnd);
    };

    pk.updateAllValuesPerWin(window);

    // attempting to send a message to a tab on chrome:// or webstore
    // page will fail with this error because no content script is running there
    // see https://stackoverflow.com/a/11911806
    pk.isTabSafe = function (tab) {
        return (
            tab
            && tab.id
            && tab.url
            && !/^chrome-extension:/.test(tab.url)
            && !/^chrome:/.test(tab.url)
            && !/^https?:\/\/chrome\.google\.com/.test(tab.url)
        );
    };
}());
