/* global $, getHTML, DB_loaded, Folder, Snip, showBlockSiteModal, updateAllValuesPerWin*/
/* global chrome, Data, getFormattedDate, isTextNode */
/* global escapeRegExp, isContentEditable, debugDir, debugLog */

(function() {
	var windowLoadChecker = setInterval(function() {
		if (window.document.readyState === "complete") {
			init();
			clearInterval(windowLoadChecker);
		}
	}, 250);

	////////////////////////
	// Global variables
	////////////////////////

	var isGoogle,
		isGmail,
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
			selectionLength: 0
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

	function initiateIframeCheck(parentDoc) {
		var iframes = parentDoc.querySelectorAll("iframe"),
			win,
			doc;

		iframes.forEach(function(iframe) {
			try {
				doc = iframe.contentDocument;
				win = iframe.contentWindow;

				// make sure handler's not already attached
				if (!doc[UNIQ_CS_KEY]) {
					doc[UNIQ_CS_KEY] = true;
					doc[DOC_IS_IFRAME_KEY] = true;
					updateAllValuesPerWin(win);
					attachNecessaryHandlers(win);
					setInterval(initiateIframeCheck, IFRAME_CHECK_TIMER, doc);
				}
			} catch (e) {
				//debugDir(e);
			}
		});
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
		return node.tagName === TAGNAME_SNIPPET_HOLDER_ELM && ((node && node.hasClass(SPAN_CLASS)) || isGoogle);

		// in plus.google.com, the span elements which
		// are added by prokeys do not retain their
		// SPAN_CLASS no matter what I do
	}

	function setCaretAtEndOf(node, pos) {
		var win = getNodeWindow(node),
			sel = win.getSelection(),
			range = sel.getRangeAt(0);

		if (isProKeysNode(node)) {
			range.selectNodeContents(node);
			range.collapse(false);
			sel.removeAllRanges();
			sel.addRange(range);
		}
		// textarea
		else {
			node.selectionEnd = node.selectionStart = pos || Placeholder.toIndex;
		}
	}

	function prepareSnippetBodyForCENode(snip, node, callback) {
		// on disqus thread the line break
		// is represented by </p>
		var isDisqusThread = isParent(node, "#disqus_thread"),
			lineSeparator = "<br>" + (isDisqusThread ? "</p>" : "");

		snip.formatMacros(function(snipBody) {
			snipBody = Snip.makeHTMLValidForExternalEmbed(snipBody)
				.replace(/\n/g, lineSeparator)
				.replace(/(%[_A-Za-z0-9]+%)/g, function(w, $1) {
					return "<span class='" + PLACE_CLASS + "'>" + $1 + "</span>";
				});
			callback(snipBody);
		});
	}

	function populatePlaceholderObject(snipElmNode) {
		Placeholder.mode = true;
		Placeholder.node = snipElmNode;
		Placeholder.isCENode = true;
		// convert the NodeList of <span.prokeys-placeholder> to array and store
		Placeholder.array = [].slice.call(snipElmNode.querySelectorAll("." + PLACE_CLASS) || [], 0);
	}

	function insertSnippetInContentEditableNode(range, snip, node) {
		prepareSnippetBodyForCENode(snip, node, function(snipBody) {
			var snipElmNode = $.new(TAGNAME_SNIPPET_HOLDER_ELM);
			snipElmNode.html(snipBody).addClass(SPAN_CLASS); // identification

			range.insertNode(snipElmNode);

			populatePlaceholderObject(snipElmNode);

			checkPlaceholdersInContentEditableNode();
		});
	}

	function checkSnippetPresenceContentEditable(node) {
		function onSnipFound() {
			// remove snippet name from container
			range.setStart(container, caretPos - snip.name.length);
			range.setEnd(container, caretPos);
			range.deleteContents();

			insertSnippetInContentEditableNode(range, snip, node);
		}

		var win = getNodeWindow(node),
			sel = win.getSelection(),
			range = sel.getRangeAt(0);

		if (!range.collapsed) return false;

		var container = range.startContainer,
			// pos relative to container (not node)
			caretPos = range.startOffset,
			snip = Data.snippets.getUniqueSnippetAtCaretPos(container, caretPos);

		// snippet found
		if (snip !== null) {
			setTimeout(onSnipFound, 10);

			// first prevent space from being inserted
			return true;
		}
	}

	function insertSnippetInTextarea(start, caretPos, snip, nodeText, node) {
		var textBeforeSnipName = nodeText.substring(0, start),
			textAfterSnipName = nodeText.substring(caretPos);

		Snip.fromObject(snip).formatMacros(function(snipBody) {
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
	function checkSnippetPresence(node) {
		if (isContentEditable(node)) return checkSnippetPresenceContentEditable(node);

		var caretPos = node.selectionStart,
			snip = Data.snippets.getUniqueSnippetAtCaretPos(node, caretPos), // holds current snippet object
			start;

		// if the start and end points are not the same
		// break and insert some character there
		if (caretPos !== node.selectionEnd) return false;

		if (snip !== null) {
			// start of snippet body
			// for placeholder.fromIndex
			start = caretPos - snip.name.length;

			setTimeout(insertSnippetInTextarea, 10, start, caretPos, snip, node.value, node);

			// first prevent space from being inserted
			return true;
		}
	}

	/**
	 * @param {Element} node a textarea
	 * @param {String} snipBody text
	 * @param {Integer} start index of snippet
	 */
	function testPlaceholderPresence(node, snipBody, start) {
		var endLength = start + snipBody.length;

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
		var pArr = Placeholder.array,
			currND;
		//debugLog(Placeholder);
		if (pArr && pArr.length > 0) {
			currND = pArr[0];

			selectEntireTextIn(currND);
			pArr.shift();
			return true;
		} else {
			setCaretAtEndOf(Placeholder.node);
			resetPlaceholderVariables();
			return false;
		}
	}

	// jumps from one `%asd%` to another (does not warp from last to first placeholder)
	// notCheckSelection avoids recursion
	function checkPlaceholdersInNode(node, from, to, notCheckSelection) {
		var selectedText, // in node
			bool; // bool indicates if placeholder was found (true) or not (false)

		// might have been called from keyEventhandler
		if (Placeholder.isCENode) checkPlaceholdersInContentEditableNode();

		// text area logic
		if (notCheckSelection) {
			selectedText = getUserSelection(node);

			if (Placeholder.regex.test(selectedText)) {
				checkPlaceholdersInNode(node, node.selectionEnd, to, false);
				return false;
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
		var win = getNodeWindow(node),
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
		var foundPlaceholder = false;

		// text of node (from `from` to `to`)
		var nodeText = node.value,
			// index of placeholder
			index = nodeText.substring(from, to).search(Placeholder.regexAnywhere);

		// one placeholder exists
		if (index > -1) {
			// increase by `from` since
			// we had substring string at start
			index += from;

			foundPlaceholder = true;

			node.selectionStart = index;

			// first get whole placeholder length
			for (var j = index + 1; nodeText[j] !== "%"; j++);
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

	// fired by the window.contextmenu event
	function insertSnippetFromCtx(snip, node) {
		if (isContentEditable(node)) return insertSnippetFromCtxContentEditable(snip, node);

		var caretPos = node.selectionStart,
			val = node.value;

		if (caretPos !== node.selectionEnd) val = val.substring(0, caretPos) + val.substring(node.selectionEnd);

		insertSnippetInTextarea(caretPos, caretPos, snip, val, node);
	}

	// fired by insertSnippetFromCtx
	function insertSnippetFromCtxContentEditable(snip, node) {
		var win = getNodeWindow(node),
			sel = win.getSelection(),
			range = sel.getRangeAt(0);

		if (!range.collapsed) range.deleteContents();

		insertSnippetInContentEditableNode(range, snip, node);
	}

	/*
		Auto-Insert Character functions
		- searchAutoInsertChars
		- insertCharacter
	*/

	/* searchCharIndex : int value: 0 or 1 - denoting whether to match the
		starting (`{`) or the closing (`}`) characters of an auto-insert combo
		with the `character` */
	function searchAutoInsertChars(character, searchCharIndex) {
		var arr = Data.charsToAutoInsertUserList;

		for (var i = 0, len = arr.length; i < len; i++) if (arr[i][searchCharIndex] === character) return arr[i];

		return null;
	}

	// auto-insert character functionality
	function insertCharacter(node, characterStart, characterEnd) {
		if (isContentEditable(node)) insertCharacterContentEditable(node, characterStart, characterEnd);
		else {
			var text = node.value,
				startPos = node.selectionStart,
				endPos = node.selectionEnd,
				textBefore = text.substring(0, startPos),
				textMid = text.substring(startPos, endPos),
				textAfter = text.substring(endPos),
				// handle trailing spaces
				trimmedSelection = textMid.match(/^(\s*)(\S?(?:.|\n|\r)*\S)(\s*)$/) || ["", "", "", ""];

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

	function insertSingleCharacterContentEditable(rangeNode, position, singleCharacter, isStart, wasRangeCollapsed) {
		var textNode,
			positionIncrement = isStart ? 1 : 0;

		if (rangeNode.nodeType !== 3) {
			textNode = document.createTextNode(singleCharacter);
			rangeNode.insertBefore(textNode, rangeNode.childNodes[position]);
			return [positionIncrement, textNode];
		}

		var value = rangeNode.textContent,
			len = value.length;

		// do not shift whitespaces if there actually was no selection
		if (Data.wrapSelectionAutoInsert && !wasRangeCollapsed) {
			if (isStart) {
				while (/\s/.test(value[position]) && position < len) position++;
			} else {
				// value[position] corresponds to one character out of the current selection
				while (/\s/.test(value[position - 1]) && position >= 1) position--;
			}
		}

		// HTML entities are for HTML, so use \xA0 to insert &nbsp;
		rangeNode.textContent =
			value.substring(0, position) + singleCharacter.replace(/ /g, "\xA0") + value.substring(position);

		return [position + positionIncrement, rangeNode];
	}

	function insertCharacterContentEditable(node, characterStart, characterEnd) {
		var win = getNodeWindow(node),
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
			rangeWasCollapsed
		);
		startPosition = singleCharacterReturnValue[0];
		newStartNode = singleCharacterReturnValue[1];

		// because this method is also used for inserting single tabkey
		if (characterEnd) {
			// they just inserted a character above
			if (startNode === endNode) endPosition++;

			singleCharacterReturnValue = insertSingleCharacterContentEditable(
				endNode,
				endPosition,
				characterEnd,
				false,
				rangeWasCollapsed
			);
			endPosition = singleCharacterReturnValue[0];
			newEndNode = singleCharacterReturnValue[1];
		} else {
			startPosition--;
		}

		range.setStart(newStartNode, startPosition);
		if (characterEnd) range.setEnd(newEndNode, endPosition);
		sel.removeAllRanges();
		sel.addRange(range);
	}

	// returns whether site is blocked by user
	function isBlockedSite(url) {
		var domain = url.replace(/^(ht|f)tps?:\/\/(www\.)?/, ""),
			arr = Data.blockedSites,
			regex;

		for (var i = 0, len = arr.length; i < len; i++) {
			regex = new RegExp("^" + escapeRegExp(arr[i]));

			if (regex.test(domain)) return true;
		}

		return false;
	}

	// returns user-selected text in content-editable element
	function getUserSelection(node) {
		var win, sel;

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
		}
		// textarea
		else return getHTML(node).substring(node.selectionStart, node.selectionEnd);
	}

	/**
	 * issues#106
	 * @param {Element} textarea in which keydown is simulated
	
	function simulateTextareaKeydown(textarea) {
		textarea.focus();
		document.execCommand("insertText", false, "a");
		debugDir(textarea);
		//textarea.triggerKeypress(8);
	}
*/
	/**
	 * issues#106
	 * @param {Element} node in which keydown is simulated
	 */
	/*
	function simulateCEKeydown(node) {
		node.focus();
		document.execCommand("insertHTML", false, "a");
		debugDir(node);
	}*/

	// classArray for CodeMirror and ace editors
	// parentSelector for others
	// max search upto 10 parent nodes (searchLimit)
	function isParent(node, parentSelector, classArray, searchLimit) {
		function classMatch(classToMatch) {
			var c = node.className;

			if (!c) return false;
			c = c.split(" ");

			for (var i = 0, len = c.length; i < len; i++) if (c[i].search(classToMatch) === 0) return true;

			return false;
		}

		node = node.parentNode;

		// tackle optionals
		if (!classArray || classArray.length === 0) classArray = [];
		searchLimit = searchLimit || 10;

		var count = 1;

		while (node && count++ <= searchLimit) {
			// 'node.matches' is important condition for MailChimp
			// it shows "BODY" as node but doesn't allow match :/
			if ((parentSelector && node.matches && node.matches(parentSelector)) || classArray.some(classMatch))
				return true;

			node = node.parentNode;
		}

		return false;
	}

	function formatVariable(str) {
		return /date/i.test(str)
			? getFormattedDate()
			: /time/i.test(str)
				? Date.getCurrentTimestamp()
				: /version/i.test(str)
					? navigator.userAgent.match(/Chrome\/[\d.]+/)[0].replace("/", " ")
					: null;
	}

	function insertTabChar(node) {
		insertCharacter(node, TAB_INSERTION_VALUE);
		shiftCursor(node, TAB_INSERTION_VALUE.length);
	}

	function evaluateMathExpression(expression) {
		// remove all non-expected characters
		var result = expression.replace(/[^\d\^\*\/\.\-\+\%\(\)]/g, "");

		// invalid string
		if (!result) return expression;
		else {
			try {
				// replace for ^ exponent operators
				result = result.replace(/(\d+)\^(\d+)/g, function(wMatch, $1, $2) {
					return "Math.pow(" + $1 + "," + $2 + ")";
				});
				// replace for % operator
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

			return isNaN(result) ? expression : result.toString();
		}
	}

	// returns string with evaluated `[[text=]]` and the new caretPosition
	function evaluateDoubleBrackets(wholeValue, startOfText, endOfText) {
		var orgValue = wholeValue.substring(startOfText, endOfText),
			// result is of String form
			result = formatVariable(orgValue) || evaluateMathExpression(orgValue);

		if (result === orgValue) result = "[[ERROR! Check ProKeys help to properly operate Mathomania/Variables]]";

		// replace the `[[expression]]` with rValue
		wholeValue = wholeValue.substring(0, startOfText - 2) + result + wholeValue.substring(endOfText + 2);

		return [wholeValue, startOfText - 2 + result.length];
	}

	// replacement of text of mathomania/variable
	// with their required value after `=` has been pressed
	// which has been detected by handleKeyPress
	function provideDoubleBracketFunctionality(node, win) {
		var sel = win.getSelection(),
			range = sel.getRangeAt(0),
			rangeNode = range.startContainer,
			isCENode = isContentEditable(node);

		var caretPos = isCENode ? range.endOffset : node.selectionEnd,
			value = isCENode ? rangeNode.textContent : node.value,
			operate = true,
			evaluatedValue,
			valueToSet,
			caretPosToSet;

		// check closing brackets are present
		if (value.substr(caretPos, 2) !== "]]") {
			operate = false;
		}
		// check opening brackets are present
		else {
			for (var i = caretPos; i >= 0 && value[i] !== "["; i--);

			if (i <= 0 || value[i - 1] !== "[") operate = false;
		}

		if (operate) {
			evaluatedValue = evaluateDoubleBrackets(value, i + 1, caretPos);
			valueToSet = evaluatedValue[0];
			caretPosToSet = evaluatedValue[1];

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
		description: moves caret present in `node` by `shiftAmount`
		`shiftAmount`: +tive or -tive integer. +tive if shift to right, else -tive.
	*/
	function shiftCursor(node, shiftAmount) {
		var win, sel, range, loc;

		if (isContentEditable(node)) {
			win = getNodeWindow(node);
			sel = win.getSelection();
			range = sel.getRangeAt(0);
			loc = range.startOffset + shiftAmount;
			//debugDir(node);debugDir(range);
			range.setStart(range.startContainer, loc);
			range.setEnd(range.endContainer, loc);
			sel.removeAllRanges();
			sel.addRange(range);
		} else node.selectionStart = node.selectionEnd = node.selectionEnd + shiftAmount;
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
		var tgN = node.tagName,
			inputNodeType,
			data,
			retVal;

		if (!node.dataset) node.dataset = {};

		data = node.dataset;

		if (data && typeof data[CACHE_DATASET_STRING] !== "undefined") retVal = data[CACHE_DATASET_STRING] === "true";
		else if (isParent(node, null, ["CodeMirror", "ace"], 3)) retVal = false;
		else if (tgN === "TEXTAREA" || isContentEditable(node)) retVal = true;
		else if (tgN === "INPUT") {
			inputNodeType = node.attr("type");
			// "!inputNodeType" -> github issue #40
			retVal = !inputNodeType || allowedInputElms.indexOf(inputNodeType) > -1;
		} else retVal = false;

		node.dataset[CACHE_DATASET_STRING] = retVal;

		return retVal;
	}

	function getCharFollowingCaret(node) {
		var win, sel, range, container, text, caretPos;

		if (isContentEditable(node)) {
			win = getNodeWindow(node);
			sel = win.getSelection();
			range = sel.getRangeAt(0);
			container = range.startContainer;
			caretPos = range.startOffset;
			text = getHTML(container); // no .html() as can be text node

			if (caretPos < text.length) return text[caretPos];
			else {
				// caretPos was at the end of container
				container = range.startContainer.nextSibling;
				// so take the following node
				if (container) {
					text = getHTML(container);
					if (text.length !== 0) return text[0];
				}
			}

			return "";
		} else return node.value[node.selectionStart] || "";
	}

	function previousCharactersForEmoji(node) {
		var emojisChars = [":", ":-"],
			previousChars,
			win,
			sel,
			range,
			rangeNode,
			position,
			nodeValue;

		if (isContentEditable(node)) {
			win = getNodeWindow(node);
			sel = win.getSelection();
			range = sel.getRangeAt(0);
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

	var handleKeyPress, handleKeyDown;
	(function() {
		// boolean variable: if user types first letter of any auto-insert combo, like `(`,
		// then variable is set to true; now, if user types `)` out of habit, it will not become
		// `())` but rather `()` only. Variable is set to false on any keypress that is not
		// the first letter of any auto-insert combo and when autoInsertTyped's value is true.
		var autoInsertTyped = false;

		handleKeyPress = function(e) {
			var node = e.target,
				// holds integer on how much to increase
				// Placeholder.toIndex by during Placeholder.mode
				toIndexIncrease = 1,
				win = getNodeWindow(node);

			////////////////////////////////////////////////////////////////////////////////////////////
			// Why use `toIndexIncrease` ?  Because of following bug:                                ///
			// Suppose, text is "%A% one two three %B%"                                              ///
			// Placeholder.fromIndex is 0 and Placeholder.toIndex is 21 (length of string)           ///
			// when user goes on %A% and types in text suppose 5 chars long                          ///
			// then the %B% moves 5 chars right, and thus the text that comes                        ///
			// within the range of Placeholder.fromIndex/Placeholder.toIndex becomes "12345 one two thre" -- missing "e %B%" ///
			// and thus this eliminated the placeholders											///
			////////////////////////////////////////////////////////////////////////////////////////////

			////////////////////////////////
			// Char insertion technique start
			var charTyped = String.fromCharCode(e.keyCode),
				autoInsertPairFirstChar = searchAutoInsertChars(charTyped, 0),
				autoInsertPairSecondChar = searchAutoInsertChars(charTyped, 1);

			if (autoInsertTyped && autoInsertPairSecondChar !== null && getCharFollowingCaret(node) === charTyped) {
				e.preventDefault();

				shiftCursor(node, 1);

				autoInsertTyped = false;
			} else if (autoInsertPairFirstChar !== null) {
				// #197: disable auto-inserts for emojis
				if (!("({".indexOf(autoInsertPairFirstChar[0]) > -1 && previousCharactersForEmoji(node))) {
					e.preventDefault();
					insertCharacter(node, autoInsertPairFirstChar[0], autoInsertPairFirstChar[1]);

					toIndexIncrease = 2;

					autoInsertTyped = true;
				}
			}

			// Char insertion technique end
			////////////////////////////////

			// to type date, we do [[date=]] and for time we do [[time=]]
			// so check for that
			if (charTyped === "=")
				// wait till the = sign actually appears in node value
				setTimeout(provideDoubleBracketFunctionality, 10, node, win);

			// this logic of Placeholder only for textarea
			// about adjusting toIndex to match typed text
			if (!Placeholder.isCENode) {
				var caretPos = node.selectionStart;

				if (Placeholder.mode && caretPos >= Placeholder.fromIndex && caretPos <= Placeholder.toIndex) {
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

		handleKeyDown = function(e) {
			var keyCode = e.keyCode,
				node = e.target,
				// do not use `this` instead of node; `this` can be document iframe
				tgN = node.tagName,
				metaKeyNotPressed = isNotMetaKey(e);

			// possibly document iframe
			if (!tgN) return;

			// [Tab] key for tab spacing/placeholder shifting
			if (keyCode === 9 && metaKeyNotPressed) {
				if ((isGmail || isGoogle) && isParent(node, "form"))
					// in Gmail, the subject and to address field
					// should not have any tab function.
					// These two fields have a "form" as their parent.
					// thus, we check if the node has a form as a parent
					// if it is, then it is a to or subject field node
					// and we will not perform operation (return false)
					return false;

				// in placeholder mode, tab => jumping of placeholders
				if (Placeholder.mode) {
					e.stopPropagation();
					e.preventDefault();

					if (Placeholder.isCENode) checkPlaceholdersInContentEditableNode();
					else {
						// when user has finished writing one placeholder
						// the next placeholder lies beyond the caret position
						Placeholder.fromIndex = node.selectionStart;
						checkPlaceholdersInNode(node, Placeholder.fromIndex, Placeholder.toIndex, true);
					}
				}
				// normal tab spacing if user specifies
				else if (Data.tabKey && tgN !== "INPUT") {
					e.preventDefault();
					e.stopPropagation();

					insertTabChar(node);
					resetPlaceholderVariables();
				} else resetPlaceholderVariables();
			}
			// snippet substitution hotkey
			else if (isSnippetSubstitutionKey(e, keyCode)) {
				if (checkSnippetPresence(node)) {
					e.preventDefault();
					e.stopPropagation();
				}
			}
			// pressing up/down arrows breaks out of placeholder mode
			// and prevents proper-bracket functionality (issues#5)
			else if ([38, 40].indexOf(keyCode) > -1) {
				autoInsertTyped = false;
				resetPlaceholderVariables();
			}
		};
	})();

	// attaches event to document receives
	// `this` as the function to call on event
	function keyEventAttacher(handler) {
		return function(event) {
			var node = event.target;

			if (isUsableNode(node)) handler.call(node, event);
		};
	}

	var onKeyDownFunc = keyEventAttacher(handleKeyDown),
		onKeyPressFunc = keyEventAttacher(handleKeyPress);

	function isSnippetSubstitutionKey(event, keyCode) {
		var hk0 = Data.hotKey[0],
			hk1 = Data.hotKey[1];

		return hk1 ? event[hk0] && keyCode === hk1 : keyCode === hk0;
	}

	function attachNecessaryHandlers(win, isBlocked) {
		win.oncontextmenu = function(event) {
			ctxElm = event.target;
			ctxTimestamp = Date.now();
			chrome.runtime.sendMessage({ ctxTimestamp: ctxTimestamp });
		};

		win.onerror = function() {
			console.log(
				"Error occurred in ProKeys. Mail a screen shot to prokeys.feedback@gmail.com to help me fix it! Thanks!"
			);
		};

		if (isBlocked) return;

		// attaching listeners to `document` to listen to
		// both normal and dynamically attached input boxes
		win.document.on("keydown", onKeyDownFunc, true);
		win.document.on("keypress", onKeyPressFunc, true);
	}

	/*
		called when document.readyState is "complete"
		to initialize work
	*/

	function init() {
		// if DB is not loaded then
		// try again after 1 second
		if (!DB_loaded) {
			setTimeout(init, 1000);
			return;
		}

		// another instance is already running, time to escape
		if (document[UNIQ_CS_KEY] === true) return;

		// in case of iframes, to avoid multiple detector.js instances
		// in one same document, see initiateIframeCheck function
		document[UNIQ_CS_KEY] = true;

		// url of page
		var URL;

		try {
			PAGE_IS_IFRAME = window.location != window.parent.location;

			URL = PAGE_IS_IFRAME ? document.referrer : window.location.href;
		} catch (e) {
			// CORS :(
			URL = window.location.href;
		}

		var isBlocked = isBlockedSite(URL);

		chrome.runtime.onMessage.addListener(function(request, sender, sendResponse) {
			var timestamp;

			// when user updates snippet data, reloading page is not required
			if (typeof request.snippetList !== "undefined" && !window.IN_OPTIONS_PAGE) {
				Data.snippets = Folder.fromArray(request.snippetList);
				Folder.setIndices();
			} else if (request.checkBlockedYourself) sendResponse(isBlocked);
			// ctxElm condition just to make sure that
			// the modal only appears in the window from where the block form intiated
			else if (request.task === "showModal" && ctxElm) {
				if (PAGE_IS_IFRAME) chrome.runtime.sendMessage({ openBlockSiteModalInParent: true, data: request });
				else showBlockSiteModal(request);
			} else if (typeof request.clickedSnippet !== "undefined") {
				timestamp = parseInt(request.ctxTimestamp, 10);
				

				if (ctxTimestamp === timestamp) {
					if (isUsableNode(ctxElm)) insertSnippetFromCtx(request.clickedSnippet, ctxElm);
					else alert("Unsupported textbox! Snippet cannot be inserted.");
				}
			} else if (request.giveSnippetList) sendResponse(Data.snippets.toArray());
			// when "Block this site" is called in iframe, iframe sends message
			// to background.js to send msg to show dialog in parent window
			// cannot access parent window directly due to CORS
			else if (request.showBlockSiteModal && !PAGE_IS_IFRAME) showBlockSiteModal(request.data);
		});

		attachNecessaryHandlers(window, isBlocked);

		// do not operate on blocked sites
		if (isBlocked) return true;

		setInterval(initiateIframeCheck, IFRAME_CHECK_TIMER, document);
		updateAllValuesPerWin(window);

		window.isGoogle = /(inbox\.google)|(plus\.google\.)/.test(window.location.href);
		window.isGmail = /mail\.google/.test(window.location.href);
	}
})();
