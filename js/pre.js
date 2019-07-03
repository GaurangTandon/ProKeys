/* global Data */

import { getFormattedDate } from "./dateFns";

// this file contains all common utility functions
// this file should not contain any code that needs to be executed outisde an exported function as
// it is not included in final dist

// attempting to send a message to a tab on chrome:// or webstore
// page will fail with this error because no content script is running there
// see https://stackoverflow.com/a/11911806
function isTabSafe(tab) {
    return (
        tab
        && tab.id
        && tab.url
        && !/^chrome-extension:/.test(tab.url)
        && !/^chrome:/.test(tab.url)
        && !/^https?:\/\/chrome\.google\.com/.test(tab.url)
        && !/^about:blank/.test(tab.url)
    );
}

function getStackTrace() {
    let stack;

    try {
        throw new Error("");
    } catch (error) {
        stack = error.stack || "";
    }

    stack = stack.split("\n").map(line => line.trim());
    return stack.splice(stack[0] === "Error" ? 2 : 1);
}

/**
 * Only and always use this function as an argument to chrome API calls
 * Never use this as an argument to wrappers like DBupdate/etc.
 * @param {String} uniqueIdentifier for the function who called me
 * @param {Function} callback fn to execute if no error
 * @returns {Function} which is used in Chrome API calls
 */
function chromeAPICallWrapper(callback) {
    const stackTrace = getStackTrace().join("\n");

    return function checkRE(...args) {
        if (chrome.runtime.lastError) {
            console.log(`CRLError: ${chrome.runtime.lastError.message}`);
            console.log(stackTrace);
        }
        if (callback) {
            callback(...args);
        }
    };
}

const DOM_HELPERS = {
    // they do not retain their `this` binding.
    // on export; hence, the `this || window`
    /**
     * short hand for document.querySelector
     * @param {string} selector selector to match element
     */
        q(selector) {
            return (this || document).querySelector(selector);
        },
        /**
* short hand for document.querySelectorAll
* @param {string} selector selector to match elements
*/
        Q(selector) {
            return (this || document).querySelectorAll(selector);
        },
        /**
* short hand for document.getElementById
* @param {string} id selector to match element
*/
        qId(id) {
            return (this || document).getElementById(id);
        },
        /**
* short hand for document.getElementsByClassName
* @param {string} cls selector to match elements
* @returns {Element[]} array (not HTMLCollection!) of matched elements
*/
        qCls(cls) {
            return [...(this || document).getElementsByClassName(cls)];
        },
        /**
* short hand for document.getElementsByClassName;
* returns the first Node in the output (not a NodeList)
* @param {string} cls selector to match elements
* @returns {Node} matched element
*/
        qClsSingle(cls) {
            const res = (this || document).qCls(cls);
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

const DEBUGGING = true;
let debugDirTemp,
    debugLogTemp;
// see https://stackoverflow.com/q/13815640
if (DEBUGGING) {
    debugLogTemp = console.log.bind(console);
    debugDirTemp = console.dir.bind(console);
} else {
    debugLogTemp = function () { };
    debugDirTemp = function () { };
}
const debugLog = debugLogTemp,
    debugDir = debugDirTemp,
    SHOW_CLASS = "show",
    PRIMITIVES_EXT_KEY = "primitivesExtended",
    protoWWWReplaceRegex = /^(ht|f)tps?:\/\/(www\.)?/,
    /**
     * we need to keep this limit as it helps improve ProKeys
     * performance, for example, by telling how many characters
     * prior to the caret the snippet abbreviation maybe present
     */
    OBJECT_NAME_LIMIT = 100;

function isObjectEmpty(obj) {
    return !obj || Object.keys(obj).length === 0;
}

function escapeRegExp(str) {
    return str.replace(/[-[\]/{}())*+?.\\^$|]/g, "\\$&");
}

// if it is a callForParent, means that a child node wants
// to get its parents checked
// callForParent: flag to prevent infinite recursion
function isContentEditable(node, callForParent) {
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

        if (isContentEditable(parent, true)) {
            return true;
        }
    } while (parent !== window.document);

    return false;
}

// Returns a function, that, as long as it continues to be invoked, will not
// be triggered. The function will be called after it stops being called for
// N milliseconds. If `immediate` is passed, trigger the function on the
// leading edge, instead of the trailing.
function debounce(func, wait, immediate) {
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
}

/**
 * credits: Dean Taylor https://stackoverflow.com/users/406712/dean-taylor on StackOverflow https://stackoverflow.com/a/30810322/2675672
 */
function copyTextToClipboard(text) {
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
}

/**
 * @param {String} url to check
 * @returns {Boolean} true if site is blocked by user, false otherwise
 */
function isBlockedSite(url) {
    const domain = url.replace(protoWWWReplaceRegex, "");

    for (const blockedSite of Data.blockedSites) {
        const regex = new RegExp(`^${escapeRegExp(blockedSite)}`);

        if (regex.test(domain)) {
            return true;
        }
    }

    return false;
}

/**
 * @param {Element} link the anchor element which initiates download
 * @param {String} data to create file out of
 * @param {String} filename name of downloadable file
 */
function appendBlobToLink(link, data, filename) {
    const blob = new Blob([data], {
        type: "text/js",
    });

    link.href = URL.createObjectURL(blob);
    link.download = `${filename} ${getFormattedDate()}.txt`;
}

function gTranlateImmune(text) {
    return `<span class=notranslate>${text}</span>`;
}


/**
 * in certain web apps, like mailchimp
 * node refers to the editor inside iframe
 * while `window` refers to top level window
 * so selection and other methods do not work
 * hence the need to get the `node's window`
 *
 * @param {Element} node
 */
function getNodeWindow(node) {
    return node.ownerDocument.defaultView;
}

function triggerFakeInput($elm) {
    $elm.dispatchEvent(
        new Event("input", {
            cancelable: true,
            bubbles: true,
        }),
    );
}

/**
 * throttle given fn with some delay;
 * executes tail end calls as well
 * @param {Function} fn synchronous function (bind to retain context)
 * @param {Number} delay in milliseconds
 */
function throttle(fn, delay) {
    let lastcall = 0,
        timeoutid;

    function ret(...args) {
        if (Date.now() - lastcall >= delay) {
            lastcall = Date.now();
            if (timeoutid) {
                clearTimeout(timeoutid);
                timeoutid = undefined;
            }
            fn(...args);
        } else if (!timeoutid) {
            timeoutid = setTimeout(ret, delay, ...args);
        }
    }

    return ret;
}

// classArray for CodeMirror and ace editors
// parentSelector for others
// max search upto 10 parent nodes (searchLimit)
function isParent(node, parentSelector, classArray, searchLimit) {
    function classMatch(classToMatch) {
        // sometimes this is undefined, dk why
        if (!node.classList) {
            return false;
        }
        for (const cls of node.classList) {
            if (cls.search(classToMatch) === 0) {
                return true;
            }
        }

        return false;
    }

    node = node.parentNode;

    // tackle optionals
    if (!classArray || classArray.length === 0) {
        classArray = [];
    }
    searchLimit = searchLimit || 10;

    let count = 1;

    while (node && count++ <= searchLimit) {
        // 'node.matches' is important condition for MailChimp
        // it shows "BODY" as node but doesn't allow match :/
        if (
            (parentSelector && node.matches && node.matches(parentSelector))
            || classArray.some(classMatch)
        ) {
            return true;
        }

        node = node.parentNode;
    }

    return false;
}

export {
    q,
    qCls,
    qClsSingle,
    qId,
    Q,
    isObject,
    isTextNode,
    debugLog,
    debugDir,
    DOM_HELPERS,
    isObjectEmpty,
    copyTextToClipboard,
    SHOW_CLASS,
    isTabSafe,
    chromeAPICallWrapper,
    isContentEditable,
    isBlockedSite,
    escapeRegExp,
    protoWWWReplaceRegex,
    debounce,
    OBJECT_NAME_LIMIT,
    PRIMITIVES_EXT_KEY,
    appendBlobToLink,
    gTranlateImmune,
    getNodeWindow,
    triggerFakeInput,
    throttle,
    isParent,
};
