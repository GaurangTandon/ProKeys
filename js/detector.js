/* global Data, pk */

import { q, checkRuntimeError, debugLog } from "./pre";
import { Folder, Snip } from "./snippet_classes";
import { changeStorageType, DBLoad } from "./common_data_handlers";

(function () {
    let windowLoadChecker = setInterval(() => {
            if (window.document.readyState === "complete") {
                init();
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
        SPAN_CLASS = "prokeys-snippet-text",
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
        PAGE_IS_IFRAME = false,
        DOC_IS_IFRAME_KEY = "PROKEYS_ON_IFRAME",
        // unique key to tell content script running in document
        UNIQ_CS_KEY = "PROKEYS_RUNNING",
        IFRAME_CHECK_TIMER = 500,
        ctxElm = null,
        ctxTimestamp = 0,
        TAB_INSERTION_VALUE = "    ";

    /*
    Helper functions for iframe related work
        - initiateIframeCheckForSpecialWebpages
        - getNodeWindow
    */

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
                pk.updateAllValuesPerWin(win);
                attachNecessaryHandlers(win);
                setInterval(initiateIframeCheck, IFRAME_CHECK_TIMER, doc);
            }
        } catch (e) {
            debugLog(e, iframe);
        }
    }

    function initiateIframeCheck(parentDoc) {
        let iframes = parentDoc.querySelectorAll("iframe"),
            doc;

        for (const iframe of iframes) {
            iframe.on("load", onIFrameLoad);
            doc = iframe.contentDocument;

            if (doc && doc.readyState === "complete") {
                onIFrameLoad(iframe);
            }
        }
    }

    // in certain web apps, like mailchimp
    // node refers to the editor inside iframe
    // while `window` refers to top level window
    // so selection and other methods do not work
    // hence the need to get the `node's window`
    function getNodeWindow(node) {
        return node.ownerDocument.defaultView;
    }

    /*
        Snippet/Placeholder functions
    */

    function resetPlaceholderVariables() {
        Placeholder.mode = false;
        Placeholder.fromIndex = Placeholder.toIndex = 0;
        Placeholder.isCENode = false;
        Placeholder.node = null;
        Placeholder.array = null;
    }

    /**
     * A ProKeys node is a span node added by prokeys
     * in CE nodes to keep track of snippet texts
     * @param {Element} node to check
     */
    function isProKeysNode(node) {
        return node.tagName === TAGNAME_SNIPPET_HOLDER_ELM && (node && node.hasClass(SPAN_CLASS));
    }

    function setCaretAtEndOf(node, pos) {
        const win = getNodeWindow(node),
            sel = win.getSelection(),
            range = sel.getRangeAt(0);

        if (isProKeysNode(node)) {
            range.selectNodeContents(node);
            range.collapse(false);
            sel.removeAllRanges();
            sel.addRange(range);
        } else {
            // textarea
            node.selectionEnd = node.selectionStart = pos || Placeholder.toIndex;
        }
    }

    function prepareSnippetBodyForCENode(snip, node, callback) {
        // on disqus thread the line break
        // is represented by </p>
        const isDisqusThread = isParent(node, "#disqus_thread"),
            lineSeparator = `<br>${isDisqusThread ? "</p>" : ""}`;

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

            callback(snipBody);
        });
    }

    function populatePlaceholderObject(snipElmNode) {
        Placeholder.mode = true;
        Placeholder.node = snipElmNode;
        Placeholder.isCENode = true;
        // convert the NodeList of <span.prokeys-placeholder> to array and store
        Placeholder.array = [].slice.call(snipElmNode.qCls(PLACE_CLASS) || [], 0);
    }

    function insertSnippetInContentEditableNode(range, snip, node) {
        prepareSnippetBodyForCENode(snip, node, (snipBody) => {
            const snipElmNode = q.new(TAGNAME_SNIPPET_HOLDER_ELM);
            snipElmNode.html(snipBody).addClass(SPAN_CLASS); // identification

            range.insertNode(snipElmNode);

            populatePlaceholderObject(snipElmNode);

            checkPlaceholdersInContentEditableNode();
        });
    }

    function isSnippetPresentCENode(node) {
        const win = getNodeWindow(node),
            sel = win.getSelection(),
            range = sel.getRangeAt(0),
            container = range.startContainer,
            // pos relative to container (not node)
            caretPos = range.startOffset;
        let snip;

        function onSnipFound() {
            // remove snippet name from container
            range.setStart(container, caretPos - snip.name.length);
            range.setEnd(container, caretPos);
            range.deleteContents();

            insertSnippetInContentEditableNode(range, snip, node);
        }

        if (!range.collapsed) {
            return false;
        }

        snip = Data.snippets.getUniqueSnippetAtCaretPos(container, caretPos);

        // snippet found
        if (snip !== null) {
            setTimeout(onSnipFound, 10);

            // first prevent space from being inserted
            return true;
        }

        return false;
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
            Placeholder.node = node.html(textBeforeSnipName + snipBody + textAfterSnipName);

            testPlaceholderPresence(node, snipBody, start);
        });
    }

    // check snippet's presence and intiate
    // another function to insert snippet body
    function isSnippetPresent(node) {
        debugLog("checking snippet presence", node);
        if (pk.isContentEditable(node)) {
            return isSnippetPresentCENode(node);
        }

        let caretPos = node.selectionStart,
            // holds current snippet object
            snip = Data.snippets.getUniqueSnippetAtCaretPos(node, caretPos),
            start;

        // if the start and end points are not the same
        // break and insert some character there
        if (caretPos !== node.selectionEnd) {
            return false;
        }

        if (snip !== null) {
            // start of snippet body
            // for placeholder.fromIndex
            start = caretPos - snip.name.length;

            setTimeout(insertSnippetInTextarea, 10, start, caretPos, snip, node.value, node);

            // first prevent space from being inserted
            return true;
        }
        return false;
    }

    /**
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

    function checkPlaceholdersInContentEditableNode() {
        let pArr = Placeholder.array,
            currND;
        // debugLog(Placeholder);
        if (pArr && pArr.length > 0) {
            [currND] = pArr;

            selectEntireTextIn(currND);
            pArr.shift();
            return true;
        }
        setCaretAtEndOf(Placeholder.node);
        resetPlaceholderVariables();
        return false;
    }

    // jumps from one `%asd%` to another (does not warp from last to first placeholder)
    // notCheckSelection avoids recursion
    function checkPlaceholdersInNode(node, from, to, notCheckSelection) {
        let selectedText, // in node
            bool; // bool indicates if placeholder was found (true) or not (false)

        // might have been called from keyEventhandler
        if (Placeholder.isCENode) {
            checkPlaceholdersInContentEditableNode();
        }

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

    // fired by insertSnippetFromCtx
    function insertSnippetFromCtxContentEditable(snip, node) {
        const win = getNodeWindow(node),
            sel = win.getSelection(),
            range = sel.getRangeAt(0);

        if (!range.collapsed) {
            range.deleteContents();
        }

        insertSnippetInContentEditableNode(range, snip, node);
    }

    // fired by the window.contextmenu event
    function insertSnippetFromCtx(snip, node) {
        if (pk.isContentEditable(node)) {
            insertSnippetFromCtxContentEditable(snip, node);
            return;
        }

        const caretPos = node.selectionStart;
        let val = node.value;

        if (caretPos !== node.selectionEnd) {
            val = val.substring(0, caretPos) + val.substring(node.selectionEnd);
        }

        insertSnippetInTextarea(caretPos, caretPos, snip, val, node);
    }

    /*
        Auto-Insert Character functions
        - searchAutoInsertChars
        - insertCharacter
    */

    /**
     * @param {String} character to match
     * @param {Number} searchCharIndex (0 or 1) denoting whether to match the
        starting (`{`) or the closing (`}`) characters of an auto-insert combo
        with the `character`
     * @returns {String[]} the auto insert pair if found, else
     */
    function searchAutoInsertChars(character, searchCharIndex) {
        const arr = Data.charsToAutoInsertUserList,
            defaultReturn = ["", ""];

        for (let i = 0, len = arr.length; i < len; i++) {
            if (arr[i][searchCharIndex] === character) {
                return arr[i];
            }
        }

        return defaultReturn;
    }

    // auto-insert character functionality
    function insertCharacter(node, characterStart, characterEnd) {
        if (pk.isContentEditable(node)) {
            insertCharacterContentEditable(node, characterStart, characterEnd);
        } else {
            let text = node.value,
                startPos = node.selectionStart,
                endPos = node.selectionEnd,
                textBefore = text.substring(0, startPos),
                textMid = text.substring(startPos, endPos),
                textAfter = text.substring(endPos),
                // handle trailing spaces
                trimmedSelection = textMid.match(/^(\s*)(\S?(?:.|\n|\r)*\S)(\s*)$/) || [
                    "",
                    "",
                    "",
                    "",
                ];

            textBefore += trimmedSelection[1];
            textAfter = trimmedSelection[3] + textAfter;
            textMid = trimmedSelection[2];

            textMid = Data.wrapSelectionAutoInsert ? textMid : "";
            startPos = textBefore.length + +!!characterEnd;
            endPos = startPos + textMid.length;

            node.value = textBefore + characterStart + textMid + (characterEnd || "") + textAfter;
            node.selectionStart = startPos;
            node.selectionEnd = endPos;
        }
    }

    function insertSingleCharacterContentEditable(
        rangeNode,
        position,
        singleCharacter,
        isStart,
        wasRangeCollapsed,
    ) {
        let textNode,
            positionIncrement = isStart ? 1 : 0;

        if (rangeNode.nodeType !== 3) {
            textNode = document.createTextNode(singleCharacter);
            rangeNode.insertBefore(textNode, rangeNode.childNodes[position]);
            return [positionIncrement, textNode];
        }

        const value = rangeNode.textContent,
            len = value.length;

        // do not shift whitespaces if there actually was no selection
        if (Data.wrapSelectionAutoInsert && !wasRangeCollapsed) {
            if (isStart) {
                while (/\s/.test(value[position]) && position < len) {
                    position++;
                }
            } else {
                // value[position] corresponds to one character out of the current selection
                while (/\s/.test(value[position - 1]) && position >= 1) {
                    position--;
                }
            }
        }

        // HTML entities are for HTML, so use \xA0 to insert &nbsp;
        rangeNode.textContent = value.substring(0, position)
            + singleCharacter.replace(/ /g, "\xA0")
            + value.substring(position);

        return [position + positionIncrement, rangeNode];
    }

    function insertCharacterContentEditable(node, characterStart, characterEnd) {
        let win = getNodeWindow(node),
            sel = win.getSelection(),
            range = sel.getRangeAt(0),
            startNode,
            endNode,
            startPosition,
            endPosition,
            newStartNode,
            newEndNode,
            rangeWasCollapsed = range.collapsed,
            singleCharacterReturnValue;

        if (!Data.wrapSelectionAutoInsert) {
            range.deleteContents();
        }

        startNode = range.startContainer;
        endNode = range.endContainer;
        startPosition = range.startOffset;
        endPosition = range.endOffset;

        // the rangeNode is a textnode EXCEPT when the node has no text
        // eg:https://stackoverflow.com/a/5258024
        singleCharacterReturnValue = insertSingleCharacterContentEditable(
            startNode,
            startPosition,
            characterStart,
            true,
            rangeWasCollapsed,
        );
        [startPosition, newStartNode] = singleCharacterReturnValue;

        // because this method is also used for inserting single tabkey
        if (characterEnd) {
            // they just inserted a character above
            if (startNode === endNode) {
                endPosition++;
            }

            singleCharacterReturnValue = insertSingleCharacterContentEditable(
                endNode,
                endPosition,
                characterEnd,
                false,
                rangeWasCollapsed,
            );
            [endPosition, newEndNode] = singleCharacterReturnValue;
        } else {
            startPosition--;
        }

        range.setStart(newStartNode, startPosition);
        if (characterEnd) {
            range.setEnd(newEndNode, endPosition);
        }
        sel.removeAllRanges();
        sel.addRange(range);
    }

    // returns user-selected text in content-editable element
    function getUserSelection(node) {
        let win,
            sel;

        if (pk.isTextNode(node) || pk.isContentEditable(node)) {
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
            return pk.getHTML(node).substring(node.selectionStart, node.selectionEnd);
        }
    }

    // classArray for CodeMirror and ace editors
    // parentSelector for others
    // max search upto 10 parent nodes (searchLimit)
    function isParent(node, parentSelector, classArray, searchLimit) {
        function classMatch(classToMatch) {
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

    function formatVariable(str) {
        return /date/i.test(str)
            ? Date.getFormattedDate()
            : /time/i.test(str)
                ? Date.getCurrentTimestamp()
                : /version/i.test(str)
                    ? navigator.userAgent.match(/Chrome\/[\d.]+/)[0].replace("/", " ")
                    : null;
    }

    /**
     * @param {Element} node whose caret to shift
     * @param {Number} shiftCount shift count (+tive towards right; -ive to left)
     */
    function shiftCaretByCount(node, shiftCount) {
        if (pk.isContentEditable(node)) {
            const win = getNodeWindow(node),
                sel = win.getSelection(),
                range = sel.getRangeAt(0),
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
    function provideDoubleBracketFunctionality(node, win) {
        let sel = win.getSelection(),
            range = sel.getRangeAt(0),
            rangeNode = range.startContainer,
            isCENode = pk.isContentEditable(node),
            caretPos = isCENode ? range.endOffset : node.selectionEnd,
            value = isCENode ? rangeNode.textContent : node.value,
            operate = true,
            evaluatedValue,
            valueToSet,
            caretPosToSet,
            i = caretPos;

        // check closing brackets are present
        if (value.substr(caretPos, 2) !== "]]") {
            operate = false;
        } else {
            // check opening brackets are present
            while (i >= 0 && value[i] !== "[") {
                i--;
            }

            if (i <= 0 || value[i - 1] !== "[") {
                operate = false;
            }
        }

        if (operate) {
            evaluatedValue = evaluateDoubleBrackets(value, i + 1, caretPos);
            [valueToSet, caretPosToSet] = evaluatedValue;

            if (isCENode) {
                rangeNode.textContent = valueToSet;
                range.setStart(rangeNode, caretPosToSet);
                range.setEnd(rangeNode, caretPosToSet);
                sel.removeAllRanges();
                sel.addRange(range);
            } else {
                node.value = valueToSet;
                node.selectionStart = node.selectionEnd = caretPosToSet;
            }
        }
    }

    /*
        Keyboard handling functions
    */

    function isNotMetaKey(event) {
        return !event.ctrlKey && !event.shiftKey && !event.metaKey && !event.altKey;
    }

    // that is, where we can perform
    // keypress, keydown functions
    function isUsableNode(node) {
        let tgN = node.tagName,
            inputNodeType,
            data,
            retVal;

        if (!node.dataset) {
            node.dataset = {};
        }

        data = node.dataset;

        if (data && typeof data[CACHE_DATASET_STRING] !== "undefined") {
            retVal = data[CACHE_DATASET_STRING] === "true";
        } else if (isParent(node, null, ["CodeMirror", "ace", "monaco-editor"], 3)) {
            retVal = false;
        } else if (tgN === "TEXTAREA" || pk.isContentEditable(node)) {
            retVal = true;
        } else if (tgN === "INPUT") {
            inputNodeType = node.attr("type");
            // "!inputNodeType" -> github issue #40
            retVal = !inputNodeType || allowedInputElms.indexOf(inputNodeType) > -1;
        } else {
            retVal = false;
        }

        node.dataset[CACHE_DATASET_STRING] = retVal;

        return retVal;
    }

    function getCharFollowingCaret(node) {
        if (pk.isContentEditable(node)) {
            const win = getNodeWindow(node),
                sel = win.getSelection(),
                range = sel.getRangeAt(0),
                caretPos = range.startOffset;
            let container = range.startContainer,
                text = pk.getHTML(container); // no .html() as can be text node

            if (caretPos < text.length) {
                return text[caretPos];
            }

            // caretPos was at the end of container
            container = range.startContainer.nextSibling;
            // so take the following node
            if (container) {
                text = pk.getHTML(container);
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
            previousChars,
            position,
            nodeValue;

        if (pk.isContentEditable(node)) {
            const win = getNodeWindow(node),
                sel = win.getSelection(),
                range = sel.getRangeAt(0),
                rangeNode = range.startContainer;
            position = range.startOffset;
            nodeValue = rangeNode.textContent;
        } else {
            nodeValue = node.value;
            position = node.selectionStart;
        }

        previousChars = nodeValue.substring(position - 2, position);

        return previousChars[1] === emojisChars[0] || previousChars === emojisChars[1];
    }

    let handleKeyPress,
        handleKeyDown;
    (function () {
        // boolean variable: if user types first letter of any auto-insert combo, like `(`,
        // then variable is set to true; now, if user types `)` out of habit, it will not become
        // `())` but rather `()` only. Variable is set to false on any keypress that is not
        // the first letter of any auto-insert combo and when autoInsertTyped's value is true.
        let autoInsertTyped = false;

        handleKeyPress = function (e) {
            let node = e.target,
                // holds integer on how much to increase
                // Placeholder.toIndex by during Placeholder.mode
                toIndexIncrease = 1,
                // //////
                // Why use `toIndexIncrease`?  Because of following bug:
                // Suppose, text is "%A% one two three %B%"
                // Placeholder.fromIndex is 0 and Placeholder.toIndex is 21 (length of string)
                // when user goes on %A% and types in text suppose 5 chars long
                // then the %B% moves 5 chars right, and thus the text that comes
                // within the range of Placeholder.fromIndex/Placeholder.toIndex becomes "12345 one two thre" -- missing "e %B%" ///
                // and thus this eliminated the placeholders
                // ///////

                // //////////////////////////////
                // Char insertion technique start
                charTyped = String.fromCharCode(e.keyCode),
                autoInsertPairFirstChar = searchAutoInsertChars(charTyped, 0),
                autoInsertPairSecondChar = searchAutoInsertChars(charTyped, 1);

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
                const win = getNodeWindow(node);
                setTimeout(provideDoubleBracketFunctionality, 10, node, win);
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
            const { keyCode } = e,
                node = e.target,
                // do not use `this` instead of node; `this` can be document iframe
                tgN = node.tagName,
                metaKeyNotPressed = isNotMetaKey(e);

            // possibly document iframe
            if (!tgN) {
                return;
            }

            // [Tab] key for tab spacing/placeholder shifting
            if (keyCode === 9 && metaKeyNotPressed) {
                if (pk.isGmail && isParent(node, "form")) {
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
            } else if (isSnippetSubstitutionKey(e, keyCode)) {
                // snippet substitution hotkey
                if (isSnippetPresent(node)) {
                    e.preventDefault();
                    e.stopPropagation();
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

    function isSnippetSubstitutionKey(event, keyCode) {
        const [modifierKey, actualKey] = Data.hotKey;

        return actualKey ? event[modifierKey] && keyCode === actualKey : keyCode === modifierKey;
    }

    function attachNecessaryHandlers(win, isBlocked) {
        win.addEventListener("contextmenu", (event) => {
            ctxElm = event.target;
            ctxTimestamp = Date.now();
            chrome.runtime.sendMessage({ ctxTimestamp }, checkRuntimeError("attachHandlers"));
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
        debugLog("handlers attached on", win.document);
    }

    function init() {
        // if DB is not loaded then
        // try again after 1 second
        if (!pk.DB_loaded) {
            setTimeout(init, 1000);
            return;
        }
        debugLog("init", document);

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

        const isBlocked = pk.isBlockedSite(URL);
        chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
            let timestamp;

            // when user updates snippet data, reloading page is not required
            if (typeof request.snippetList !== "undefined" && !pk.IN_OPTIONS_PAGE) {
                Data.snippets = Folder.fromArray(request.snippetList);
                Folder.setIndices();
            } else if (request.checkBlockedYourself) {
                sendResponse(isBlocked);
            } else if (request.task === "showModal" && ctxElm) {
                // ctxElm condition just to make sure that
                // the modal only appears in the window from where the block form intiated
                if (PAGE_IS_IFRAME) {
                    chrome.runtime.sendMessage(
                        { openBlockSiteModalInParent: true, data: request },
                        checkRuntimeError("showModal"),
                    );
                } else {
                    pk.showBlockSiteModal(request);
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
            } else if (request.giveFreshData) {
                sendResponse({ snippets: Data.snippets.toArray(), ctxEnabled: Data.ctxEnabled });
            } else if (request.showBlockSiteModal && !PAGE_IS_IFRAME) {
                // when "Block this site" is called in iframe, iframe sends message
                // to background.js to send msg to show dialog in parent window
                // cannot access parent window directly due to CORS
                pk.showBlockSiteModal(request.data);
            }
        });

        attachNecessaryHandlers(window, isBlocked);

        // do not operate on blocked sites
        if (isBlocked) {
            return;
        }

        setInterval(initiateIframeCheck, IFRAME_CHECK_TIMER, document);
        pk.updateAllValuesPerWin(window);
        debugLog("done initializing");

        pk.isGmail = /mail\.google/.test(window.location.href);
    }

    function setEssentialItemsOnDBLoad() {
        pk.DB_loaded = true;
        Data.snippets = Folder.fromArray(Data.snippets);
        Folder.setIndices();
        pk.snipNameDelimiterListRegex = new RegExp(
            `[${pk.escapeRegExp(Data.snipNameDelimiterList)}]`,
        );
    }

    DBLoad(() => {
        if (Data.snippets === false) {
            changeStorageType();
            DBLoad(setEssentialItemsOnDBLoad);

            return;
        }

        setEssentialItemsOnDBLoad();
    });
}());
