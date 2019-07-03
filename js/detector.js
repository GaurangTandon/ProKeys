/* global Data */

import {
    q,
    chromeAPICallWrapper,
    debugLog,
    isContentEditable,
    isTextNode,
    isBlockedSite,
    PRIMITIVES_EXT_KEY,
    getNodeWindow,
    triggerFakeInput,
    OBJECT_NAME_LIMIT,
    throttle,
    isParent,
} from "./pre";
import { Snip } from "./snippetClasses";
import { DBget } from "./commonDataHandlers";
import { primitiveExtender } from "./primitiveExtend";
import { updateAllValuesPerWin } from "./protoExtend";
import { getHTML, getText } from "./textmethods";
import { showBlockSiteModal } from "./modalHandlers";
import { getCurrentTimestamp, getFormattedDate } from "./dateFns";
import { insertCharacter, searchAutoInsertChars } from "./autoInsertFunctionality";

primitiveExtender();
(function () {
    const windowLoadChecker = setInterval(() => {
            if (window.document.readyState === "complete") {
                onPageLoad();
                clearInterval(windowLoadChecker);
            }
        }, 250),
        // //////////////////////
        // Global variables
        // //////////////////////
        /* should be "span"; if "p" is used, then it gets appended inside
            another "p" which the webpage was using. this can cause styling
            problems for that rich editor */
        TAGNAME_SNIPPET_HOLDER_ELM = "SPAN",
        // class of span element holding entire snippet
        PROKEYS_ELM_CLASS = "prokeys-snippet-text",
        // class of span element holding placeholders
        PLACE_CLASS = "prokeys-placeholder",
        // contains all Placeholder related variables
        Placeholder = {
            // from is where the snippet starts; to is where it ends;
            // used for specifying from where to where to search and place placeholders
            fromIndex: 0,
            toIndex: 0,
            mode: false, // false initially, made true only by checkSnippetPresence function
            node: null, // the text node containing the start placeholder
            isCENode: false,
            regex: /^%[A-Z0-9_]+%$/i,
            regexAnywhere: /%[A-Z0-9_]+%/i,
            array: null, // array of all the text nodes
            // for adjustment of textarea toIndex
            selectionLength: 0,
        },
        // prokeys can only work in these input elements
        // the others don't support caret manipulation
        allowedInputElms = ["", "text", "search", "tel", "url"],
        CACHE_DATASET_STRING = "prokeyscachednode",
        DOC_IS_IFRAME_KEY = "PROKEYS_ON_IFRAME",
        // unique key to tell content script running in document
        UNIQ_CS_KEY = "PROKEYS_RUNNING",
        IFRAME_CHECK_TIMER = 500,
        TAB_INSERTION_VALUE = "    ",
        /**
         * a collection of cached snippet names that are seen by the detector script
         */
        LAST_SEEN_SNIPPETS = {};

    let ctxElm = null,
        ctxTimestamp = 0,
        PAGE_IS_IFRAME = false;

    /**
     * @param {Element} node
     */
    function getSelAndRange(node) {
        const win = getNodeWindow(node),
            sel = win.getSelection(),
            range = sel.getRangeAt(0);
        return { sel, range };
    }

    function onIFrameLoad(iframe) {
        let doc,
            win;

        try {
            doc = iframe.contentDocument;
            win = iframe.contentWindow;

            // make sure handler's not already attached
            if (doc && !doc[UNIQ_CS_KEY]) {
                doc[UNIQ_CS_KEY] = true;
                doc[DOC_IS_IFRAME_KEY] = true;
                updateAllValuesPerWin(win);
                attachNecessaryHandlers(win);
                setInterval(initiateIframeCheck, IFRAME_CHECK_TIMER, doc);
            }
        } catch (e) {
            debugLog(e, iframe, doc, win);
        }
    }

    function initiateIframeCheck(parentDoc) {
        const iframes = parentDoc.querySelectorAll("iframe");

        for (const iframe of iframes) {
            iframe.on("load", onIFrameLoad);
            const doc = iframe.contentDocument;

            if (doc && doc.readyState === "complete") {
                onIFrameLoad(iframe);
            }
        }
    }

    /*
        Snippet/Placeholder functions
    */

    function resetPlaceholderVariables() {
        Placeholder.mode = false;
        Placeholder.fromIndex = Placeholder.toIndex = 0;
        Placeholder.isCENode = false;
        Placeholder.lastNode = null;
        Placeholder.array = null;
    }

    // always content editable
    // used by span.prokeys-placeholder
    function selectEntireTextIn(node) {
        const win = getNodeWindow(node),
            sel = win.getSelection(),
            range = sel.getRangeAt(0);

        range.selectNodeContents(node);
        sel.removeAllRanges();
        sel.addRange(range);
    }

    /**
     * A ProKeys node is a span node added by prokeys
     * in CE nodes to keep track of snippet texts
     * @param {Element} node to check
     */
    function isProKeysNode(node) {
        return node.tagName === TAGNAME_SNIPPET_HOLDER_ELM && (node && node.hasClass(PROKEYS_ELM_CLASS));
    }

    function setCaretAtEndOf(node, pos) {
        if (isProKeysNode(node)) {
            const { sel, range } = getSelAndRange(node);

            range.selectNodeContents(node);
            range.collapse(false);
            sel.removeAllRanges();
            sel.addRange(range);
        } else {
            // textarea
            node.selectionEnd = node.selectionStart = pos || Placeholder.toIndex;
        }
    }

    /**
     * @param {Snip} snip
     * @param {Element} node
     * @param {Function} callback
     */
    function prepareSnippetBodyForCENode(snip, callback) {
        const lineSeparator = "<br>";

        snip.formatMacros((snipBody) => {
            snipBody = Snip.makeHTMLValidForExternalEmbed(snipBody)
                .replace(/\n/g, lineSeparator)
                .replace(
                    /(%[_A-Za-z0-9]+%)/g,
                    (w, $1) => `<span class='${PLACE_CLASS}'>${$1}</span>`,
                )
                .replace(
                    /\[\[%c(\(.*?\))?\]\]/g,
                    wholeMatch => `<span class="${Snip.CARET_POSITION_CLASS}">${wholeMatch}</span>`,
                );

            debugLog("prepared snippet body for CE node\n", snipBody);

            callback(snipBody.split(lineSeparator));
        });
    }

    /**
     * @param {Element} mainNode
     * @param {Element} lastNode
     */
    function populatePlaceholderObject(mainNode, lastNode) {
        Placeholder.mode = true;
        Placeholder.lastNode = lastNode;
        Placeholder.isCENode = true;
        // convert the NodeList of <span.prokeys-placeholder> to array and store
        Placeholder.array = [].slice.call(mainNode.qCls(PLACE_CLASS) || [], 0);
    }

    function checkPlaceholdersInContentEditableNode() {
        const pArr = Placeholder.array;

        if (pArr && pArr.length > 0) {
            const [currND] = pArr;

            selectEntireTextIn(currND);
            pArr.shift();
            return true;
        }
        setCaretAtEndOf(Placeholder.lastNode);
        resetPlaceholderVariables();
        return false;
    }

    /**
     * https://github.com/GaurangTandon/ProKeys/issues/295#issuecomment-507561596
     * it's either a P or a DIV
     * @param {Element|Text} container
     * @returns {Element} either P or DIV, whichever the parent is
     */
    function determineCEParent(container) {
        while (!container.matches || !container.matches("P,DIV")) { container = container.parentElement; }
        return container;
    }

    /**
     * This inserts snippets line by line into html elements
     * the first line might be a part of a span, while all other lines
     * are of the same type parentTagName. This ensures compat with whatever editor
     * we are using. Also, using html elements ensures we can format placeholders
     * correctly.
     * @param {String} parentTagName
     * @param {Range} range
     * @param {Array<String>}
     * @returns {Element} the first element that was inserted
     */
    function insertSnippetCE(parentTagName, range, snipBodyLines) {
        function getSpan(htmlContent) {
            return q.new("span").html(htmlContent).addClass(PROKEYS_ELM_CLASS);
        }

        function getParentType(htmlContent) {
            return q.new(parentTagName).html(htmlContent).addClass(PROKEYS_ELM_CLASS);
        }

        // it might be an element node too?
        const { startContainer } = range;
        let startLineIndex = 0,
            extraText = "",
            firstElm = null,
            insertAfterMe = startContainer;

        if (isTextNode(startContainer)) {
            const pos = range.startOffset;
            extraText = startContainer.textContent.substr(pos);
            startContainer.textContent = startContainer.textContent.substr(0, pos);
            const span = firstElm = getSpan(snipBodyLines[0]);
            startContainer.insertAfter(span);
            insertAfterMe = span;

            startLineIndex++;
        }

        for (let i = startLineIndex; i < snipBodyLines.length; i++) {
            // if there was no content, it's
            const parentElm = getParentType(snipBodyLines[i] || "<br>");
            if (i === startLineIndex && firstElm === null) { firstElm = parentElm; }

            insertAfterMe.insertAfter(parentElm);
            insertAfterMe = parentElm;
        }

        let lastElm;
        if (insertAfterMe.matches("span")) {
            if (extraText) { insertAfterMe.insertAfter(document.createTextNode(extraText)); }
            lastElm = insertAfterMe;
        } else if (extraText) {
            const spanElm = getSpan(insertAfterMe.innerHTML);

            insertAfterMe.innerHTML = "";
            insertAfterMe.appendChild(spanElm);
            insertAfterMe.removeClass(PROKEYS_ELM_CLASS);
            insertAfterMe.innerHTML += extraText;

            lastElm = insertAfterMe.qClsSingle(PROKEYS_ELM_CLASS);
        } else {
            lastElm = insertAfterMe;
        }

        return lastElm;
    }

    /**
     * @param {Range} range
     * @param {Snip} snip
     * @param {Element} node
     */
    function insertSnippetInContentEditableNode(range, snip, node) {
        prepareSnippetBodyForCENode(snip, (snipBodyLines) => {
            // old way - too simplistic
            // const snipElmNode = q.new(TAGNAME_SNIPPET_HOLDER_ELM);
            // snipElmNode.html(snipBody).addClass(SPAN_CLASS); // identification
            // range.insertNode(snipElmNode);
            const mainParent = determineCEParent(range.startContainer);
            let { tagName } = mainParent;

            // the div.contenteditable is the most primitive it can be (with textnodes only)
            // insert paragraphs by default
            if (mainParent === node) {
                tagName = "p";
                const holder = document.createElement("P"),
                    textholder = document.createTextNode("");
                holder.appendChild(textholder);
                range.insertNode(holder);
                range.setStart(textholder, 0);
                range.setEnd(textholder, 0);
            }

            const lastNode = insertSnippetCE(tagName, range, snipBodyLines);

            triggerFakeInput(node);
            populatePlaceholderObject(node, lastNode);

            checkPlaceholdersInContentEditableNode();
        });
    }

    function sendCheckSnippetMsg(node, caretPos, mainCallback) {
        // one extra subtraction for delimiter char
        const textSliceStart = Math.max(0, caretPos - OBJECT_NAME_LIMIT - 1),
            usableText = getText(node).slice(textSliceStart, caretPos);

        chrome.runtime.sendMessage({ task: "checkSnippetPresent", text: usableText }, ({ snipFound, snipObject }) => {
            if (snipFound) { LAST_SEEN_SNIPPETS[snipObject.name] = snipObject.body; }
            mainCallback({ snipFound, snipObject });
        });
    }

    /**
     * @param {Number} start
     * @param {Number} caretPos
     * @param {Snip} snip
     * @param {String} nodeText
     * @param {Element} node
     * @param {Element} node a textarea
     * @param {String} snipBody text
     * @param {Integer} start index of snippet
     */
    function testPlaceholderPresence(node, snipBody, start) {
        const endLength = start + snipBody.length;

        if (Placeholder.regexAnywhere.test(snipBody)) {
            Placeholder.mode = true;
            Placeholder.fromIndex = start; // this is the org. length just before snip name
            Placeholder.toIndex = endLength; // this just after snip body
            checkPlaceholdersInNode(node, Placeholder.fromIndex, Placeholder.toIndex, true);
        } else {
            setCaretAtEndOf(node, endLength);

            resetPlaceholderVariables();
        }
    }

    function insertSnippetInTextarea(start, caretPos, snip, nodeText, node) {
        const textBeforeSnipName = nodeText.substring(0, start),
            textAfterSnipName = nodeText.substring(caretPos);

        snip.formatMacros((snipBody) => {
            // snipBody can be both textarea-saved or rte-saved
            // if it is textarea-saved => nothing needs to be done
            // else callt his method
            // it is textarea-saved IF it does not have any quill classes
            snipBody = Snip.makeHTMLSuitableForTextareaThroughString(snipBody);
            node.html(textBeforeSnipName + snipBody + textAfterSnipName);

            testPlaceholderPresence(node, snipBody, start);
        });
    }

    // jumps from one `%asd%` to another (does not warp from last to first placeholder)
    // notCheckSelection avoids recursion
    function checkPlaceholdersInNode(node, from, to, notCheckSelection) {
        let selectedText, // in node
            bool; // bool indicates if placeholder was found (true) or not (false)

        // might have been called from keyEventhandler
        if (Placeholder.isCENode) {
            checkPlaceholdersInContentEditableNode();
            return;
        }

        triggerFakeInput(node);

        // text area logic
        if (notCheckSelection) {
            selectedText = getUserSelection(node);

            if (Placeholder.regex.test(selectedText)) {
                checkPlaceholdersInNode(node, node.selectionEnd, to, false);
                return;
            }
        }

        bool = setPlaceholderSelection(node, from, to);

        // now probably the end of the snippet's placeholders has been reached
        // as no placeholder was found
        if (!bool) {
            // but set this prop to make sure next tab
            // jumps after snippet body
            setCaretAtEndOf(node, to);
            resetPlaceholderVariables();
        }
    }

    // set selection of next placeholder
    // returns false if no placeholder else true
    // in textarea
    function setPlaceholderSelection(node, from, to) {
        let foundPlaceholder = false,
            // text of node (from `from` to `to`)
            nodeText = node.value,
            // index of placeholder
            index = nodeText.substring(from, to).search(Placeholder.regexAnywhere);

        // one placeholder exists
        if (index > -1) {
            // increase by `from` since
            // we had substring string at start
            index += from;

            foundPlaceholder = true;

            node.selectionStart = index;
            let j = index + 1;
            // first get whole placeholder length
            while (nodeText[j] !== "%") {
                j++;
            }
            // increase j by 2 (because condition of loop ignores both `%`)
            // subtract one because end has already started
            // at first `%`
            // so, in total add 1
            j += 1;

            node.selectionEnd = j;

            // for adjusting toIndex
            Placeholder.justSelected = true;
            Placeholder.selectionLength = j - index;
        }

        return foundPlaceholder;
    }

    /**
     * fired by the window.contextmenu event
     * @param {Snip} snip
     * @param {Element} node
     */
    function insertSnippetFromCtx(snip, node) {
        if (isContentEditable(node)) {
            const { range } = getSelAndRange(node);

            if (!range.collapsed) {
                range.deleteContents();
            }

            insertSnippetInContentEditableNode(range, snip, node);
        } else {
            const caretPos = node.selectionStart;
            let val = node.value;

            if (caretPos !== node.selectionEnd) {
                val = val.substring(0, caretPos) + val.substring(node.selectionEnd);
            }

            insertSnippetInTextarea(caretPos, caretPos, snip, val, node);
        }
    }

    // returns user-selected text in content-editable element
    function getUserSelection(node) {
        let win,
            sel;

        if (isTextNode(node) || isContentEditable(node)) {
            win = getNodeWindow(node);
            sel = win.getSelection();

            try {
                return sel.getRangeAt(0).toString();
            } catch (e) {
                // possibly no range exists
                node.focus();

                return win
                    .getSelection()
                    .getRangeAt(0)
                    .toString();
            }
        } else {
            // textarea
            return getHTML(node).substring(node.selectionStart, node.selectionEnd);
        }
    }

    function formatVariable(str) {
        if (/date/i.test(str)) {
            return getFormattedDate();
        }
        if (/time/i.test(str)) {
            return getCurrentTimestamp();
        }
        if (/version/i.test(str)) {
            return navigator.userAgent.match(/Chrome\/[\d.]+/)[0].replace("/", " ");
        }
        return null;
    }

    /**
     * @param {Element} node whose caret to shift
     * @param {Number} shiftCount shift count (+tive towards right; -ive to left)
     */
    function shiftCaretByCount(node, shiftCount) {
        if (isContentEditable(node)) {
            const { sel, range } = getSelAndRange(node),
                loc = range.startOffset + shiftCount;
            // debugDir(node);debugDir(range);
            range.setStart(range.startContainer, loc);
            range.setEnd(range.endContainer, loc);
            sel.removeAllRanges();
            sel.addRange(range);
        } else {
            node.selectionStart = node.selectionEnd += shiftCount;
        }
    }

    function insertTabChar(node) {
        insertCharacter(node, TAB_INSERTION_VALUE);
        shiftCaretByCount(node, TAB_INSERTION_VALUE.length);
    }

    function evaluateMathExpression(expression) {
        // remove all non-expected characters
        let result = expression.replace(/[^\d^*/.\-+%()]/g, "");

        // invalid string
        if (!result) {
            return expression;
        }

        try {
            // replace for ^ exponent operators
            result = result.replace(/(\d+)\^(\d+)/g, (wMatch, $1, $2) => `Math.pow(${$1},${$2})`);
            // replace for % operator
            // eslint-disable-next-line no-eval
            result = eval(result.replace(/%/g, "/100"));
        } catch (e) {
            // possible syntax error on `eval`
            result = expression;
        }

        result = parseFloat(result);

        // if number has decimal digits
        if (result % 1 !== 0) {
            // convert to float of 5 point precision and to string
            result = result.toFixed(5);

            // remove the extraneous zeros after decimal
            result = result.replace(/\.(\d*?)0+$/, ".$1");

            // remove the dot if no digits are there after it
            result = result.replace(/\.$/, "");
        }

        return Number.isNaN(result) ? expression : result.toString();
    }

    // returns string with evaluated `[[text=]]` and the new caretPosition
    function evaluateDoubleBrackets(wholeValue, startOfText, endOfText) {
        let orgValue = wholeValue.substring(startOfText, endOfText),
            // result is of String form
            result = formatVariable(orgValue) || evaluateMathExpression(orgValue);

        if (result === orgValue) {
            result = "[[ERROR! Check ProKeys help to properly operate Mathomania/Variables]]";
        }

        // replace the `[[expression]]` with rValue
        wholeValue = wholeValue.substring(0, startOfText - 2) + result + wholeValue.substring(endOfText + 2);

        return [wholeValue, startOfText - 2 + result.length];
    }

    // replacement of text of mathomania/variable
    // with their required value after `=` has been pressed
    // which has been detected by handleKeyPress
    function provideDoubleBracketFunctionality(node) {
        const { sel, range } = getSelAndRange(node),
            rangeNode = range.startContainer,
            isCENode = isContentEditable(node),
            caretPos = isCENode ? range.endOffset : node.selectionEnd,
            value = isCENode ? rangeNode.textContent : node.value;
        let shouldOperate = true,
            i = caretPos;

        // check closing brackets are present
        if (value.substr(caretPos, 2) !== "]]") {
            shouldOperate = false;
        } else {
            // check opening brackets are present
            while (i >= 0 && value[i] !== "[") {
                i--;
            }

            if (i <= 0 || value[i - 1] !== "[") {
                shouldOperate = false;
            }
        }

        if (shouldOperate) {
            const evaluatedValue = evaluateDoubleBrackets(value, i + 1, caretPos),
                [valueToSet, caretPosToSet] = evaluatedValue;

            if (isCENode) {
                rangeNode.textContent = valueToSet;
                range.setStart(rangeNode, caretPosToSet);
                range.setEnd(rangeNode, caretPosToSet);
                sel.removeAllRanges();
                sel.addRange(range);
                triggerFakeInput(rangeNode);
            } else {
                node.value = valueToSet;
                node.selectionStart = node.selectionEnd = caretPosToSet;
                triggerFakeInput(node);
            }
        }
    }

    function isNotMetaKey(event) {
        return !event.ctrlKey && !event.shiftKey && !event.metaKey && !event.altKey;
    }

    // that is, where we can perform
    // keypress, keydown functions
    function isUsableNode(node) {
        let retVal;

        if (!node.dataset) {
            node.dataset = {};
        }

        const tgN = node.tagName,
            data = node.dataset;

        if (data && typeof data[CACHE_DATASET_STRING] !== "undefined") {
            retVal = data[CACHE_DATASET_STRING] === "true";
        } else if (isParent(node, null, ["CodeMirror", "ace", "monaco-editor"], 3)) {
            retVal = false;
        } else if (tgN === "TEXTAREA" || isContentEditable(node)) {
            retVal = true;
        } else if (tgN === "INPUT") {
            const inputNodeType = node.attr("type");
            // "!inputNodeType" -> github issue #40
            retVal = !inputNodeType || allowedInputElms.indexOf(inputNodeType) > -1;
        } else {
            retVal = false;
        }

        node.dataset[CACHE_DATASET_STRING] = retVal;

        return retVal;
    }

    function getCharFollowingCaret(node) {
        if (isContentEditable(node)) {
            const { range } = getSelAndRange(node),
                caretPos = range.startOffset;
            let container = range.startContainer,
                text = getHTML(container); // no .html() as can be text node

            if (caretPos < text.length) {
                return text[caretPos];
            }

            // caretPos was at the end of container
            container = range.startContainer.nextSibling;
            // so take the following node
            if (container) {
                text = getHTML(container);
                if (text.length !== 0) {
                    return text[0];
                }
            }

            return "";
        }
        return node.value[node.selectionStart] || "";
    }

    function previousCharactersForEmoji(node) {
        let emojisChars = [":", ":-"],
            position,
            nodeValue;

        if (isContentEditable(node)) {
            const { range } = getSelAndRange(node),
                rangeNode = range.startContainer;
            position = range.startOffset;
            nodeValue = rangeNode.textContent;
        } else {
            nodeValue = node.value;
            position = node.selectionStart;
        }

        const previousChars = nodeValue.substring(position - 2, position);

        return previousChars[1] === emojisChars[0] || previousChars === emojisChars[1];
    }

    /**
     * still passing keycode for backward compatibility
     * @param {Event} event
     * @param {Number} keyCode
     * @param {String} key
     */
    function isSnippetSubstitutionKey(event, keyCode, key) {
        const modifierKey = Data.hotKey.length === 1 ? undefined : Data.hotKey[0],
            actualKey = Data.hotKey[Data.hotKey.length - 1],
            modifierPressedIfReq = (!modifierKey || event[modifierKey]),
            actualKeyCorrect = Number.isInteger(actualKey) ? keyCode === actualKey : key.toLowerCase() === actualKey.toLowerCase();

        return modifierPressedIfReq && actualKeyCorrect;
    }

    /**
     * @param {Element} node
     * @returns true if snippet was present, else false
     */
    function executeSnippetIfPresent(node) {
        if (!node.dataset || node.dataset.snipFound !== "true") { return false; }

        const name = node.dataset.snipName,
            snip = Snip.fromObject({ name, body: LAST_SEEN_SNIPPETS[name], timestamp: 1 }),
            { range } = getSelAndRange(node),
            container = range.startContainer;

        if (isContentEditable(node)) {
            // pos relative to container (not node)
            const caretPos = range.startOffset;
            range.setStart(container, caretPos - name.length);
            range.setEnd(container, caretPos);
            range.deleteContents();

            setTimeout(insertSnippetInContentEditableNode, 10, range, snip, node);
        } else {
            const caretPos = node.selectionStart,
                start = caretPos - name.length;
            setTimeout(insertSnippetInTextarea, 10, start, caretPos, snip, node.value, node);
        }

        return true;
    }

    // check snippet's presence and intiate
    // another function to insert snippet body
    function isSnippetPresent(node, callback) {
        const notFoundRet = { snipFound: false, snipObject: {} };
        if (isContentEditable(node)) {
            const { range } = getSelAndRange(node),
                container = range.startContainer,
                // pos relative to container (not node)
                caretPos = range.startOffset;

            if (!range.collapsed) {
                callback(notFoundRet);
                return;
            }

            sendCheckSnippetMsg(container, caretPos, callback);
        } else {
            const caretPos = node.selectionStart;

            // if the start and end points are not the same
            // break and insert some character there
            if (caretPos !== node.selectionEnd) {
                callback(notFoundRet);
                return;
            }

            sendCheckSnippetMsg(node, caretPos, callback);
        }
    }

    /**
     * do not use `this` in this function since
     * its binding is lost on throttle;
     * fired by both selectionchange and keyup
     * @param {Event} event
     */
    function updateNodeSnippetPresence(event) {
        const doc = event.target, // the doc may be inside iframe; hence, use event.target
            node = doc instanceof Document ? doc.activeElement : event.target;
        // handlekeydown/keyup are guaranteed to fire on usable nodes
        // but this function isn't
        if (!isUsableNode(node)) { return; }

        isSnippetPresent(node, ({ snipFound, snipObject }) => {
            node.dataset.snipFound = snipFound;
            node.dataset.snipName = snipObject.name;
        });
    }

    const throttledUpdateNodeSnippetPresence = throttle(updateNodeSnippetPresence, 50);

    let handleKeyPress,
        handleKeyDown;
    (function () {
        // boolean variable: if user types first letter of any auto-insert combo, like `(`,
        // then variable is set to true; now, if user types `)` out of habit, it will not become
        // `())` but rather `()` only. Variable is set to false on any keypress that is not
        // the first letter of any auto-insert combo and when autoInsertTyped's value is true.
        let autoInsertTyped = false;

        handleKeyPress = function (e) {
            const node = e.target,
                // //////////////////////////////
                // Char insertion technique start
                charTyped = String.fromCharCode(e.keyCode),
                autoInsertPairFirstChar = searchAutoInsertChars(charTyped, 0),
                autoInsertPairSecondChar = searchAutoInsertChars(charTyped, 1);

            // holds integer on how much to increase
            // Placeholder.toIndex by during Placeholder.mode
            // //////
            // Why use `toIndexIncrease`?  Because of following bug:
            // Suppose, text is "%A% one two three %B%"
            // Placeholder.fromIndex is 0 and Placeholder.toIndex is 21 (length of string)
            // when user goes on %A% and types in text suppose 5 chars long
            // then the %B% moves 5 chars right, and thus the text that comes
            // within the range of Placeholder.fromIndex/Placeholder.toIndex becomes "12345 one two thre" -- missing "e %B%" ///
            // and thus this eliminated the placeholders
            // ///////
            let toIndexIncrease = 1;

            if (
                autoInsertTyped
                && autoInsertPairSecondChar[0]
                && getCharFollowingCaret(node) === charTyped
            ) {
                e.preventDefault();

                shiftCaretByCount(node, 1);

                autoInsertTyped = false;
            } else if (autoInsertPairFirstChar[0]) {
                // #197: disable auto-inserts for emojis
                if (
                    !(
                        "({".indexOf(autoInsertPairFirstChar[0]) > -1
                        && previousCharactersForEmoji(node)
                    )
                ) {
                    e.preventDefault();
                    insertCharacter(node, autoInsertPairFirstChar[0], autoInsertPairFirstChar[1]);

                    toIndexIncrease = 2;

                    autoInsertTyped = true;
                }
            }

            // Char insertion technique end
            // //////////////////////////////

            // to type date, we do [[date=]] and for time we do [[time=]]
            // so check for that
            if (charTyped === "=") {
                // wait till the = sign actually appears in node value
                setTimeout(provideDoubleBracketFunctionality, 10, node);
            }

            // this logic of Placeholder only for textarea
            // about adjusting toIndex to match typed text
            if (!Placeholder.isCENode) {
                const caretPos = node.selectionStart;

                if (
                    Placeholder.mode
                    && caretPos >= Placeholder.fromIndex
                    && caretPos <= Placeholder.toIndex
                ) {
                    // when you select text of length 10, and press one key
                    // I have to subtract 9 chars in toIndex
                    if (Placeholder.justSelected) {
                        Placeholder.justSelected = false;
                        toIndexIncrease -= Placeholder.selectionLength;
                    }

                    Placeholder.toIndex += toIndexIncrease;
                }
            }
        };

        handleKeyDown = function (e) {
            const { keyCode, key } = e,
                node = e.target,
                // do not use `this` instead of node; `this` can be document iframe
                tgN = node.tagName,
                metaKeyNotPressed = isNotMetaKey(e);

            // possibly document iframe
            if (!tgN) {
                return;
            }

            if (isSnippetSubstitutionKey(e, keyCode, key)) {
                if (executeSnippetIfPresent(node)) {
                    e.preventDefault();
                    e.stopPropagation();
                    return;
                }
            }

            // since tab key functions as all of snippet expansion,
            // placeholder jumper as well as 4sp insert, we cannot
            // put an else if here
            if (keyCode === 9 && metaKeyNotPressed) {
                // [Tab] key for tab spacing/placeholder shifting
                if (window.isGmail && isParent(node, "form")) {
                    // in Gmail, the subject and to address field
                    // should not have any tab function.
                    // These two fields have a "form" as their parent.
                    // thus, we check if the node has a form as a parent
                    // if it is, then it is a to or subject field node
                    // and we will not perform operation (return false)
                    return;
                }

                // in placeholder mode, tab => jumping of placeholders
                if (Placeholder.mode) {
                    e.stopPropagation();
                    e.preventDefault();

                    if (Placeholder.isCENode) {
                        checkPlaceholdersInContentEditableNode();
                    } else {
                        // when user has finished writing one placeholder
                        // the next placeholder lies beyond the caret position
                        Placeholder.fromIndex = node.selectionStart;
                        checkPlaceholdersInNode(
                            node,
                            Placeholder.fromIndex,
                            Placeholder.toIndex,
                            true,
                        );
                    }
                } else if (Data.tabKey && tgN !== "INPUT") {
                    // normal tab spacing if user specifies
                    e.preventDefault();
                    e.stopPropagation();

                    insertTabChar(node);
                    resetPlaceholderVariables();
                } else {
                    resetPlaceholderVariables();
                }
            } else if ([38, 40].indexOf(keyCode) > -1) {
                // pressing up/down arrows breaks out of placeholder mode
                // and prevents proper-bracket functionality (issues#5)
                autoInsertTyped = false;
                resetPlaceholderVariables();
            }
        };
    }());

    // attaches event to document receives
    // `this` as the function to call on event
    function keyEventAttacher(handler) {
        return function (event) {
            const node = event.target;
            if (isUsableNode(node)) {
                handler.call(node, event);
            }
        };
    }

    const onKeyDownFunc = keyEventAttacher(handleKeyDown),
        onKeyPressFunc = keyEventAttacher(handleKeyPress);

    function attachNecessaryHandlers(win, isBlocked) {
        win.addEventListener("contextmenu", (event) => {
            ctxElm = event.target;
            ctxTimestamp = Date.now();
            chrome.runtime.sendMessage({ ctxTimestamp }, chromeAPICallWrapper());
        });

        win.addEventListener("error", (event) => {
            console.log(
                "Error occurred in ProKeys. Mail a screen shot to prokeys.feedback@gmail.com to help me fix it! Thanks!",
            );
            console.error(event.message, event);
            console.trace();
        });

        if (isBlocked) {
            return;
        }

        win.document.on("keydown", onKeyDownFunc, true);
        win.document.on("keypress", onKeyPressFunc, true);

        // attaching selectionchange on individual textareas
        // doesn't work
        // event.target is always document, hence, no point
        // trying to capture it
        win.document.on("selectionchange", throttledUpdateNodeSnippetPresence);
        // when user presses stuff like backspace, delete, ctrl-x
        // tracking it during keydown is useless as they haven't updated
        // the node text yet; hence, use keyup
        win.document.on("keyup", throttledUpdateNodeSnippetPresence);

        debugLog("handlers attached on", win.document);
    }

    function setPageDOM() {
        if (!window[PRIMITIVES_EXT_KEY]) {
            updateAllValuesPerWin(window);
        }

        debugLog("---\ninit", document);

        // another instance is already running, time to escape
        if (document[UNIQ_CS_KEY] === true) {
            return;
        }

        // in case of iframes, to avoid multiple detector.js instances
        // in one same document, see initiateIframeCheck function
        document[UNIQ_CS_KEY] = true;

        // url of page
        let URL;

        try {
            PAGE_IS_IFRAME = window.location !== window.parent.location;

            URL = PAGE_IS_IFRAME ? document.referrer : window.location.href;
        } catch (e) {
            // CORS :(
            URL = window.location.href;
        }

        const isBlocked = isBlockedSite(URL);
        chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
            let timestamp;

            // when user updates snippet data, reloading page is not required
            if (request.checkBlockedYourself) {
                sendResponse(isBlocked);
            } else if (request.task === "showModal" && ctxElm) {
                // ctxElm condition just to make sure that
                // the modal only appears in the window from where the block form intiated
                if (PAGE_IS_IFRAME) {
                    chrome.runtime.sendMessage(
                        { openBlockSiteModalInParent: true, data: request },
                        chromeAPICallWrapper(),
                    );
                } else {
                    showBlockSiteModal(request);
                }
            } else if (typeof request.clickedSnippet !== "undefined") {
                timestamp = parseInt(request.ctxTimestamp, 10);

                if (ctxTimestamp === timestamp) {
                    if (isUsableNode(ctxElm)) {
                        insertSnippetFromCtx(Snip.fromObject(request.clickedSnippet), ctxElm);
                    } else {
                        alert("Unsupported textbox! Snippet cannot be inserted.");
                    }
                }
            } else if (request.showBlockSiteModal && !PAGE_IS_IFRAME) {
                // when "Block this site" is called in iframe, iframe sends message
                // to background.js to send msg to show dialog in parent window
                // cannot access parent window directly due to CORS
                showBlockSiteModal(request.data);
            }
        });

        attachNecessaryHandlers(window, isBlocked);

        // do not operate on blocked sites
        if (isBlocked) {
            return;
        }

        setInterval(initiateIframeCheck, IFRAME_CHECK_TIMER, document);

        window.isGmail = /mail\.google/.test(window.location.href);
        debugLog("done initializing");
    }

    function afterDBget(DataResponse) {
        window.Data = DataResponse;
        setPageDOM();
    }

    function onPageLoad() {
        if (!window.IN_OPTIONS_PAGE) {
            DBget(["hotKey", "tabKey", "blockedSites",
                "charsToAutoInsertUserList", "dataUpdateVariable", "matchDelimitedWord",
                "snipNameDelimiterList", "omniboxSearchURL", "wrapSelectionAutoInsert"], afterDBget);
        } else {
            // load a second after the init
            // function in the options page has executed
            setTimeout(setPageDOM, 1000);
        }
    }
}());
