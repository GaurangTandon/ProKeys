// this file adds useful extensions to prototypes of various primitives
// it is indcluded with the other files

import { DOM_HELPERS } from "./pre";
import { extendNodePrototype } from "./protoExtend";
import { getHTML, setHTML } from "./textmethods";
import { isLeapYear } from "./dateFns";

/**
 * There are three frames in which this needs to be executed
 * options page, background page, and all frames of a webpage.
 * This does not need to wait for page load.
 */
export function primitiveExtender() {
    Date.prototype.isLeapYear = function () {
        const year = this.getFullYear();
        return isLeapYear(year);
    };

    Date.prototype.getDayOfYear = function () {
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

    // eslint-disable-next-line no-proto
    NodeList.prototype.__proto__ = Array.prototype;

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

    for (const [funcName, func] of Object.entries(DOM_HELPERS)) {
        extendNodePrototype(funcName, func);
    }
}
