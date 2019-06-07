/* global pk, Data */

// this file contains all common utility functions

// will be used to store prokeys related variables (#204)
window.pk = {};

// attempting to send a message to a tab on chrome:// or webstore
// page will fail with this error because no content script is running there
// see https://stackoverflow.com/a/11911806
export function isTabSafe(tab) {
    return (
        tab
        && tab.id
        && tab.url
        && !/^chrome-extension:/.test(tab.url)
        && !/^chrome:/.test(tab.url)
        && !/^https?:\/\/chrome\.google\.com/.test(tab.url)
    );
}
/*  stack trace is not beneficial being async, therefore
        use a unique identifier to track down the origin */
export function checkRuntimeError(uniqueIdentifier) {
    return function checkREHelper() {
        if (chrome.runtime.lastError) {
            // TODO: remove
            // alert(
            // `An error occurred! Please press Ctrl+Shift+J/Cmd+Shift+J, copy whatever is
            // shown in the 'Console' tab and report it at my email: prokeys.feedback@gmail.com
            // .This will help me resolve your issue and improve my extension. Thanks!`
            // );
            // Chrome.Runtime.LastError:, do not use .error() as it prints
            // out too many red messages :(
            console.log(`CRLError (${uniqueIdentifier}): ${chrome.runtime.lastError.message}`);
            return true;
        }
        return false;
    };
}

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
            return [...this.getElementsByClassName(cls)];
        },
        /**
         * short hand for document.getElementsByClassName;
         * returns the first Node in the output (not a NodeList)
         * @param {string} cls selector to match elements
         * @returns {Node} matched element
         */
        qClsSingle(cls) {
            const res = this.qCls(cls);
            return res ? res[0] : null;
        },
    },
    {
        q, qCls, qClsSingle, qId, Q,
    } = DOM_HELPERS;
q.new = function (tagName) {
    return document.createElement(tagName);
};
function isObject(o) {
    return Object.prototype.toString.call(o) === "[object Object]";
}

function isTextNode(node) {
    return node.nodeType === 3;
}

const DEBUGGING = false;
let debugDirTemp,
    debugLogTemp;
// see https://stackoverflow.com/q/13815640
if (DEBUGGING) {
    debugLogTemp = console.log.bind(console);
    debugDirTemp = console.dir.bind(console);
} else {
    debugLogTemp = function () {};
    debugDirTemp = function () {};
}
const debugLog = debugLogTemp,
    debugDir = debugDirTemp;

export {
    isObject, q, qCls, qClsSingle, qId, Q, isTextNode, debugLog, debugDir, DOM_HELPERS,
};

(function mainIIFE() {
    if (!pk.dom) {
        pk.dom = {};
    }
    pk.dom.SHOW_CLASS = "show";
    pk.OBJECT_NAME_LIMIT = 60;
    pk.protoWWWReplaceRegex = /^(ht|f)tps?:\/\/(www\.)?/;

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
        return Object.keys(obj).length === 0;
    };

    pk.escapeRegExp = function (str) {
        return str.replace(/[-[\]/{}())*+?.\\^$|]/g, "\\$&");
    };

    // should use this since users may use foreign language
    // characters which use up more than two bytes
    pk.lengthInUtf8Bytes = function (str) {
        // Matches only the 10.. bytes that are non-initial characters in a multi-byte sequence.
        const m = encodeURIComponent(str).match(/%[89ABab]/g);
        return str.length + (m ? m.length : 0);
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

    pk.updateAllValuesPerWin(window);

    pk.isTabSafe = isTabSafe;

    /**
     * @param {String} url to check
     * @returns {Boolean} true if site is blocked by user, false otherwise
     */
    pk.isBlockedSite = function (url) {
        const domain = url.replace(pk.protoWWWReplaceRegex, "");

        for (const blockedSite of Data.blockedSites) {
            const regex = new RegExp(`^${pk.escapeRegExp(blockedSite)}`);

            if (regex.test(domain)) {
                return true;
            }
        }

        return false;
    };
}());
