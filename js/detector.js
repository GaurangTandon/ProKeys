/* global $, getHTML, DB_loaded, Folder, Snip, showBlockSiteModal*/
/* global setHTML, MONTHS, chrome, Data, setText, getFormattedDate, isTextNode */
/* global escapeRegExp, getText, isContentEditable, DAYS, padNumber*/

/* #quickNotes
1. http://stackoverflow.com/questions/15980898/why-doesnt-this-jquery-event-to-fire-in-gmail
2. http://stackoverflow.com/questions/27893300/gmail-chrome-extension-and-document-readystate
3. with reference to tab key problems:
	look, binding the event straight to the element
	whose tab you want to avoid and then using e.preventDef() won't work
	instead, bind the event to the container (div or document) of the elm
	and then use preventDefault
	see http://stackoverflow.com/questions/5961333/prevent-default-action-for-tab-key-in-chrome
*/
(function () {
	// when the script is injected, init is
	// not called as window.onload is not fired!
	// so use this better solution
	var windowLoadChecker = setInterval(function(){
		if(window.document.readyState === "complete"){
			init();
			clearInterval(windowLoadChecker);
		}
	}, 250);

	////////////////////////
	// Global variables
	////////////////////////

	var isGoogle, isGmail,
		/* should be "span"; if "p" is used, then it gets appended inside 
			another "p" which the webpage was using. this can cause styling
			problems for that rich editor */
		TAGNAME_SNIPPET_HOLDER_ELM = "SPAN",
		// class of span element holding entire snippet
		SPAN_CLASS = "prokeys-snippet-text",
		// class of span element holding placeholders
		PLACE_CLASS = "prokeys-placeholder",
		macros = [
			["\\bs([+-]\\d+)?\\b", [function(date){           // secs
				return padNumber(date.getSeconds());
			}, 1000]],
			["\\bm([+-]\\d+)?\\b", [function(date){           // minutes
				return padNumber(date.getMinutes());
			}, 60000]],
			["\\bh([+-]\\d+)?\\b", [function(date){           // 12h
				return padNumber(to12Hrs(date.getHours())[0]);
			}, 3600000]],
			["\\bhh([+-]\\d+)?\\b", [function(date){          // 24h
				return padNumber(date.getHours());
			}, 3600000]],
			["\\ba\\b", [function(date){                      // am or pm
				return to12Hrs(date.getHours())[1];
			}, 86400000]],
			["\\bDo([+-]\\d+)?\\b", [function(date){          // date (14th)
				return formatDate(date.getDate());
			}, 86400000]],
			["\\bD([+-]\\d+)?\\b", [function(date){           // date (14)
				return padNumber(date.getDate());
			}, 86400000]],
			["\\bdddd([+-]\\d+)?\\b", [function(date){        // day (sunday)
				return parseDay(date.getDay(), "full");
			}, 86400000]],
			["\\bddd([+-]\\d+)?\\b", [function(date){         // day (sun)
				return parseDay(date.getDay(), "half");
			}, 86400000]],
			["\\bMMMM([+-]\\d+)?\\b", [function(date){        // month (february)
				return parseMonth(date.getMonth(), "full");
			}, 86400000 * 30]],
			["\\bMMM([+-]\\d+)?\\b", [function(date){         // month (feb)
				return parseMonth(date.getMonth(), "half");
			}, 86400000 * 30]],
			["\\bMM([+-]\\d+)?\\b", [function(date){          // numeric month
				return padNumber(date.getMonth() + 1);
			}, 86400000 * 30]],
			["\\bYY([+-]\\d+)?\\b", [function(date){        // year (2015)
				return date.getFullYear() % 100;
			}, 86400000 * 365]],
			["\\bYYYY([+-]\\d+)?\\b", [function(date){        // year (2015)
				return date.getFullYear();
			}, 86400000 * 365]],
			["\\bdate\\b", [getFormattedDate, 0]],
			["\\btime\\b", [getTimestamp, 0]]
		],
		// contains all Placeholder related variables
		Placeholder = {
			// from is where the snippet starts; to is where it ends;
			// used for specifying from where to where to search and place placeholders
			fromIndex: 0, toIndex: 0,
			mode: false,     // false initially, made true only by checkSnippetPresence function
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
		// unique key to tell content script running in document
		uniqCSKey = "PROKEYS_RUNNING",
		docIsIframeKey = "PROKEYS_ON_IFRAME",
		ctxElm = null, ctxTimestamp = 0,
		PASTE_REGEX = /\[\[%p\]\]/ig;

	/*
	Helper functions for iframe related work
		- initiateIframeCheckForSpecialWebpages
		- getNodeWindow
	*/

	function initiateIframeCheck(doc){
		var iframes = doc.querySelectorAll("iframe");

		iframes.forEach(function(iframe){
			try{
				doc = iframe.contentDocument;
				// make sure handler's not already attached
				if(!doc[uniqCSKey]){
					doc[uniqCSKey] = true;
					doc[docIsIframeKey] = true;
					attachNecessaryHandlers(iframe.contentWindow);
					setInterval(initiateIframeCheck, 500, doc);
				}
			}catch(e){
				// CORS :(
			}
		});
	}

	// in certain web apps, like mailchimp
	// node refers to the editor inside iframe
	// while `window` refers to top level window
	// so selection and other methods do not work
	// hence the need to get the `node's window`
	function getNodeWindow(node){
		return node.ownerDocument.defaultView;
	}

	/*
		Date/Time Macro related helper functions
		- to12Hrs
		- parseDay
		- parseMonth
		- formatDate
		- get31stDays
		- getFormattedDate
		- getTimestamp
	*/

	// receives 24 hour; comverts to 12 hour
	// return [12hour, "am/pm"]
	function to12Hrs(hour){
		if(hour === 0) return [12, "am"];
		else if(hour == 12) return [12, "pm"];
		else if(hour >= 1 && hour < 12) return [hour, "am"];
		else return [hour - 12, "pm"];
	}

	function parseDay(day_num, type){
		return type === "full" ? DAYS[day_num] : DAYS[day_num].slice(0, 3);
	}

	// accepts num (0-11); returns month
	// type means full, or half
	function parseMonth(month, type){
		return type === "full" ? MONTHS[month] : MONTHS[month].slice(0, 3);
	}

	// appends th, st, nd, to date
	function formatDate(date){
		var rem = date % 10, str = "th";

		if(rem === 1 && date !== 11) str = "st";
		else if(rem === 2 && date !== 12) str = "nd";
		else if(rem === 3 && date !== 13) str = "rd";

		return date + str;
	}

	// get number of 31st days starting from
	// next month until `num` months
	// subtracting 1/2 for february (account for leap year)
	function get31stDays(num){
		var d = new Date(),
			count = 0,
			curr = d.getMonth(),
			year = d.getFullYear(),
			i = 0,
			lim = Math.abs(num),
			isNegative = num < 0,
			incr = isNegative ? 1 : -1;

		while(i <= lim){
			curr += incr;

			if(curr > 11) {curr = 0; year++;}
			else if(curr < 0) {curr = 11; year--;}

			switch(MONTHS[curr]){
				case "January":
				case "March":
				case "May":
				case "July":
				case "August":
				case "October":
				case "December":
					count++; break;
				case "February":
					// leap year 29 days; one less than 30 days
					if(year % 400 === 0 || (year % 100 !== 0 && year % 4 === 0))
						count--;
					else count -= 2;
			}

			i++;
		}

		return isNegative ? -count : count;
	}

	function getTimestamp(){
		var date = new Date();

		var hours = padNumber(date.getHours()),
			minutes = padNumber(date.getMinutes()),
			seconds = padNumber(date.getSeconds());

		return hours + ":" + minutes + ":" + seconds;
	}

	/*
		Snippet/Placeholder functions
		- resetPlaceholderVariables
		- isProKeysNode
		- formatMacros
		- insertSpace
		- checkPlaceholdersInNode
		- checkSnippetPresence
		- formatNextTextNode
		- insertTextContentEditable
		- testPlaceholderPresence
		- setPlaceholderSelection
	*/

	function resetPlaceholderVariables(){
		Placeholder.mode = false;
		Placeholder.fromIndex = Placeholder.toIndex = 0;
		Placeholder.isCENode = false;
		Placeholder.node = null;
		Placeholder.array = null;
	}

	// checks if the span node is added by prokeys
	function isProKeysNode(node){
		return node.tagName === TAGNAME_SNIPPET_HOLDER_ELM &&
				(node && node.hasClass(SPAN_CLASS) || isGoogle);

		// in plus.google.com, the span elements which
		// are added by prokeys do not retain their
		// SPAN_CLASS no matter what I do
	}

	// formats macros present in snipBody
	function formatMacros(snipBody, callback){
		// find the %d macro text and call replace function on it
		// sameTimeFlag: indicates whether all calculations will be dependent (true)
		// on each other or independent (false) of each other
		snipBody = snipBody.replace(/\[\[\%d\((!?)(.*?)\)\]\]/g, function(wholeMatch, sameTimeFlag, text){
			var reg, regex, elm, date = new Date(),
				// `text` was earlier modifying itself
				// due to this, numbers which became shown after
				// replacement got involved in dateTime arithmetic
				// to avoid it; we take a `subs`titute
				subs = text;

			sameTimeFlag = !!sameTimeFlag;

			// operate on text (it is the one inside brackets of %d)
			for(var i = 0, len = macros.length; i < len; i++){ // macros has regex-function pairs
				regex = macros[i][0];
				elm = macros[i][1];
				reg = new RegExp(regex, "g");

				text.replace(reg, function(match, $1){
					var change = 0;

					// date arithmetic
					if($1){
						$1 = parseInt($1, 10);

						// if it is a month
						if(/M/.test(regex))
							change += get31stDays($1) * 86400000;

						// in milliseonds
						change += elm[1] * $1;
					}
					else regex = regex.replace(/[^a-zA-Z\\\/]/g, "").replace("\\d", "");

					if(sameTimeFlag)
						date.setTime(date.getTime() + change);

					subs = subs.replace(new RegExp(regex), elm[0](sameTimeFlag ? date : new Date(Date.now() + change)));
				});
			}

			return subs;
		});

		if(PASTE_REGEX.test(snipBody)){
			chrome.extension.sendMessage("givePasteData", function(pasteData){
				callback(snipBody.replace(PASTE_REGEX, pasteData));
			});
		}
		else callback(snipBody);
	}

	function setCaretAtEndOf(node, pos){
		var win = getNodeWindow(node),
			sel = win.getSelection(),
			range = sel.getRangeAt(0);

		if(isProKeysNode(node)){
			range.selectNodeContents(node);
			range.collapse(false);
			sel.removeAllRanges();
			sel.addRange(range);
		}
		// textarea
		else node.selectionEnd = node.selectionStart = pos || Placeholder.toIndex;
	}

	function deleteSelectionTextarea(node){
		var nSS = node.selectionStart,
			nSE = node.selectionEnd, val;

		if(nSS !== nSE){
			val = node.value;

			node.value = val.substring(0, nSS) + val.substring(nSE);
			node.selectionStart = node.selectionEnd = nSS;
		}
	}

	function prepareSnippetBodyForCENode(snipBody, node, callback){
		// on disqus thread the line break
		// is represented by </p>
		var	isDisqusThread = isParent(node, "#disqus_thread"),
			lineSeparator = "<br>" + (isDisqusThread ? "</p>" : "");

		formatMacros(snipBody, function(snipBody){
			snipBody = 
					Snip.makeHTMLValidForExternalEmbed(snipBody)
						.replace(/\n/g, lineSeparator)
						.replace(/(%[_A-Za-z0-9]+%)/g, function(w, $1){
							return "<span class='" + PLACE_CLASS + "'>" + $1 + "</span>";
						});
			callback(snipBody);
		});
	}

	function populatePlaceholderObject(snipElmNode){
		Placeholder.mode = true;
		Placeholder.node = snipElmNode;
		Placeholder.isCENode = true;
		// convert the NodeList of <span.prokeys-placeholder> to array and store
		Placeholder.array = [].slice.call(snipElmNode.querySelectorAll("." + PLACE_CLASS) || [], 0);
	}

	function insertSnippetInContentEditableNode(range, snipBody, node){		
		prepareSnippetBodyForCENode(snipBody, node, function(snipBody){
			var snipElmNode = $.new(TAGNAME_SNIPPET_HOLDER_ELM);
			snipElmNode.html(snipBody)
				.addClass(SPAN_CLASS); // identification
			console.log(snipBody);
			console.log(snipElmNode.innerHTML);
			
			range.insertNode(snipElmNode);

			populatePlaceholderObject(snipElmNode);

			checkPlaceholdersInContentEditableNode();
		});
	}

	function checkSnippetPresenceContentEditable(node){
		function onSnipFound(){
			// remove snippet name from container
			range.setStart(container, caretPos - snip.name.length);
			range.setEnd(container, caretPos);
			range.deleteContents();

			insertSnippetInContentEditableNode(range, snip.body, node);
		}

		var win = getNodeWindow(node),
			sel = win.getSelection(),
			range = sel.getRangeAt(0);

		if(!range.collapsed) return false;

		var	container = range.startContainer,
			// pos relative to container (not node)
			caretPos = range.startOffset,
			snip = Data.snippets.getUniqueSnippetAtCaretPos(container, caretPos);

		// snippet found
		if(snip !== null) {
			setTimeout(onSnipFound, 10);

			// first prevent space from being inserted
			return true;
		}
	}

	function insertSnippetInTextarea(start, caretPos, snipBody, nodeText, node){
		var textBeforeSnipName = nodeText.substring(0, start),
			textAfterSnipName = nodeText.substring(caretPos);

		formatMacros(snipBody, function(snipBody){
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
	function checkSnippetPresence(node){
		if(isContentEditable(node))
			return checkSnippetPresenceContentEditable(node);

		var caretPos = node.selectionStart,
			snip = Data.snippets.getUniqueSnippetAtCaretPos(node, caretPos), // holds current snippet object
			start;

		// if the start and end points are not the same
		// break and insert some character there
		if(caretPos !== node.selectionEnd) return false;

		if(snip !== null){
			// start of snippet body
			// for placeholder.fromIndex
			start = caretPos - snip.name.length;

			setTimeout(insertSnippetInTextarea, 10, start, caretPos, snip.body, node.value, node);

			// first prevent space from being inserted
			return true;
		}
	}

	// only used by textarea
	function testPlaceholderPresence(node, snipBody, start){
		var endLength = start + snipBody.length;

		if(Placeholder.regexAnywhere.test(snipBody)){
			Placeholder.mode = true;
			Placeholder.fromIndex = start; // this is the org. length just before snip name
			Placeholder.toIndex = endLength; // this just after snip body
			checkPlaceholdersInNode(node, Placeholder.fromIndex, Placeholder.toIndex, true);
		}
		else{
			setCaretAtEndOf(node, endLength);

			resetPlaceholderVariables();
		}
	}

	function checkPlaceholdersInContentEditableNode(){
		var pArr = Placeholder.array, currND;
		//console.log(Placeholder);
		if(pArr && pArr.length > 0){
			currND = pArr[0];

			selectEntireTextIn(currND);
			pArr.shift();
			return true;
		}else{
			setCaretAtEndOf(Placeholder.node);
			resetPlaceholderVariables();
			return false;
		}
	}

	// jumps from one `%asd%` to another (does not warp from last to first placeholder)
	// notCheckSelection avoids recursion
	function checkPlaceholdersInNode(node, from, to, notCheckSelection){
		var selectedText, // in node
			bool; // bool indicates if placeholder was found (true) or not (false)

		// might have been called from keyEventhandler
		if(Placeholder.isCENode) checkPlaceholdersInContentEditableNode();

		// text area logic
		if(notCheckSelection){
			selectedText = getUserSelection(node);

			if(Placeholder.regex.test(selectedText)){
				checkPlaceholdersInNode(node, node.selectionEnd, to, false);
				return false;
			}
		}

		bool = setPlaceholderSelection(node, from, to);

		// now probably the end of the snippet's placeholders has been reached
		// as no placeholder was found
		if(!bool){
			// but set this prop to make sure next tab
			// jumps after snippet body
			setCaretAtEndOf(node, to);
			resetPlaceholderVariables();
		}
	}

	// always content editable
	// used by span.prokeys-placeholder
	function selectEntireTextIn(node){
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
	function setPlaceholderSelection(node, from, to){
		var foundPlaceholder = false;

		// text of node (from `from` to `to`)
		var nodeText = node.value,
			// index of placeholder
			index = nodeText.substring(from, to).search(Placeholder.regexAnywhere);

		// one placeholder exists
		if(index > -1){
			// increase by `from` since
			// we had substring string at start
			index += from;

			foundPlaceholder = true;

			node.selectionStart = index;

			// first get whole placeholder length
			for(var j = index + 1; nodeText[j] !== "%"; j++);
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
	function insertSnippetFromCtx(snip, node){
		if(isContentEditable(node))
			return insertSnippetFromCtxContentEditable(snip, node);

		var caretPos = node.selectionStart,
			val = node.value;

		if(caretPos !== node.selectionEnd)
			val = val.substring(0, caretPos) + val.substring(node.selectionEnd);

		insertSnippetInTextarea(caretPos, caretPos, snip.body, val, node);
	}

	// fired by insertSnippetFromCtx
	function insertSnippetFromCtxContentEditable(snip, node){
		var win = getNodeWindow(node),
			sel = win.getSelection(),
			range = sel.getRangeAt(0);

		if(!range.collapsed) range.deleteContents();

		insertSnippetInContentEditableNode(range, snip.body, node);
	}

	/*
		Auto-Insert Character functions
		- searchAutoInsertChars
		- insertCharacter
	*/

	/* searchCharIndex : int value: 0 or 1 - denoting whether to match the
		starting (`{`) or the closing (`}`) characters of an auto-insert combo
		with the `character` */
	function searchAutoInsertChars(character, searchCharIndex){
		var arr = Data.charsToAutoInsertUserList;

		for(var i = 0, len = arr.length; i < len; i++)
			if(arr[i][searchCharIndex] === character)
				return arr[i];

		return null;
	}

	// auto-insert character functionality
	function insertCharacter(node, character){
		// if some text was selected at this time
		// then that text would be deleted

		if(isContentEditable(node)) insertCharacterContentEditable(node, character);
		else {
			deleteSelectionTextarea(node);

			var text = node.value,
				caretPos = node.selectionEnd;

			text = text.substring(0, caretPos) + character + text.substring(caretPos);

			// set the text
			node.value = text;

			// reset selection indices
			node.selectionStart = node.selectionEnd = caretPos;
		}
	}

	function insertCharacterContentEditable(node, character){
		var win = getNodeWindow(node),
			sel = win.getSelection(),
			range = sel.getRangeAt(0);

		// first delete exising selection
		range.deleteContents();

		var	rangeNode = range.startContainer,
			//originalNode = rangeNode,
			isCENode = rangeNode.nodeType === 1,
			caretPos = range.startOffset;
		/*console.dir(range);
		console.dir(caretPos);*/
		var text = getText(rangeNode), // can't use .text() since it may be textnode
			textBefore = text.substring(0, caretPos),
			textAfter = text.substring(caretPos),
			textToSet = textBefore + character + textAfter,
			$caretSetElm;

		setHTML(rangeNode, textToSet);

		$caretSetElm = isCENode ? rangeNode.firstChild : rangeNode;

		/*console.log(text + "\n--\n" + caretPos + "\n--\n" + textBefore + "\n--\n" + textAfter + "\n--\n" + caretPosToSet + "\n--\n" + textToSet);

		console.dir(workElm.firstChild); 
		console.dir(workElm); 
		console.log(workElm); 
		console.log("---------"); */

		range.setStart($caretSetElm, caretPos);
		range.setEnd($caretSetElm, caretPos);
		sel.removeAllRanges();
		sel.addRange(range);
	}

	// returns whether site is blocked by user
	function isBlockedSite(url){
		var domain = url.replace(/^(ht|f)tps?:\/\/(www\.)?/, ""),
			arr = Data.blockedSites, regex;

		for(var i = 0, len = arr.length; i < len; i++){
			regex = new RegExp("^" + escapeRegExp(arr[i]));

			if(regex.test(domain))	return true;
		}

		return false;
	}

	// returns user-selected text in content-editable element
	function getUserSelection(node){
		var win, sel;

		if(isTextNode(node) || isContentEditable(node)){
			win = getNodeWindow(node);
			sel = win.getSelection();

			try{
				return sel.getRangeAt(0).toString();
			}catch(e){ // possibly no range exists
				node.focus();

				return win.getSelection()
						.getRangeAt(0).toString();
			}
		}
		// textarea
		else
			return getHTML(node)
						.substring(node.selectionStart, node.selectionEnd);
	}

	// classArray for CodeMirror and ace editors
	// parentSelector for others
	// max search upto 10 parent nodes (searchLimit)
	function isParent(node, parentSelector, classArray, searchLimit) {
		function classMatch(classToMatch){
			var c = node.className;

			if(!c) return false;
			c = c.split(" ");

			for(var i = 0, len = c.length; i < len; i++)
				if(c[i].search(classToMatch) === 0)
					return true;

			return false;
		}

		node = node.parentNode;

		// tackle optionals
		if(!classArray || classArray.length === 0) classArray = [];
		searchLimit = searchLimit || 10;

		var count = 1;

		while (node && count++ <= searchLimit) {
			// 'node.matches' is important condition for MailChimp
			// it shows "BODY" as node but doesn't allow match :/
			if(parentSelector && node.matches && 
					node.matches(parentSelector) ||
				classArray.some(classMatch))
				return true;

			node = node.parentNode;
		}

		return false;
	}

	function formatVariable(str){
		return  /date/i.test(str)     ? getFormattedDate() :
				/time/i.test(str)     ? getTimestamp() :
				/version/i.test(str) ?
					navigator.userAgent.match(/Chrome\/[\d.]+/)[0].replace("/", " ") :
					null;
	}

	function insertTabChar(node){
		var tabValue = "    ";

		insertCharacter(node, tabValue);
		shiftCursor(node, tabValue.length);
	}

	function evaluateMathExpression(expression){
		// remove all non-expected characters
		var result = expression.replace(/[^\d\^\*\/\.\-\+\%\(\)]/g, "");

		// invalid string
		if(!result) return expression;
		else{
			try{
				// replace for ^ exponent operators
				result = result.replace(/(\d+)\^(\d+)/g, function(wMatch, $1, $2){
					return "Math.pow(" + $1 + "," + $2 + ")";
				});
				// replace for % operator
				result = eval(result.replace(/%/g, "/100"));
			}catch(e){ // possible syntax error on `eval`
				result = expression;
			}

			result = parseFloat(result);

			// if number has decimal digits
			if(result % 1 !== 0){
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

	// gets string containing `[[text=]]`
	// returns the string having evaluated the text
	function evaluateDoubleBrackets(wholeValue, startOfText, endOfText){
		var orgValue = wholeValue.substring(startOfText, endOfText),
			// result is of String form
			result = (formatVariable(orgValue) || evaluateMathExpression(orgValue));

		if(result === orgValue)
			result = "[[ERROR! Check ProKeys help to properly operate Mathomania/Variables]]";

		// replace the `[[expression]]` with rValue
		wholeValue = wholeValue.substring(0, startOfText - 2) +
					result + wholeValue.substring(endOfText + 2);

		return [wholeValue, startOfText - 2 + result.length];
	}

	// provides double bracket functionality
	// i.e. replacement of text of mathomania/variable
	// with their required value after `=` has been pressed
	// which has been detected by handleKeyPress
	function provideDoubleBracketFunctionality(node, win){
		var sel = win.getSelection(),
			range = sel.getRangeAt(0), // get the new range
			isCENode = isContentEditable(node);

		if(isCENode) node = range.endContainer;

		var	caretPos = isCENode ? range.endOffset : node.selectionEnd,
			value = isCENode ? node.textContent : getHTML(node),
			operate = true,
			returnValue, valueToSet, caretPosToSet;

		// check if closing brackets are there
		if(value.substr(caretPos, 2) !== "]]")
			operate = false;

		// check if opening brackets are present
		if(operate){
			for(var i = caretPos; 
				i >= 0 && value[i] !== "["; i--);

			// bracket not found
			if(i === -1) operate = false;
		}

		if(operate){
			returnValue = evaluateDoubleBrackets(value, i + 1, caretPos);
			valueToSet = returnValue[0]; caretPosToSet = returnValue[1];

			setText(node, valueToSet);

			if(isCENode){
				range.setStart(node, caretPosToSet);
				range.setEnd(node, caretPosToSet);
				sel.removeAllRanges();
				sel.addRange(range);
			}
			else node.selectionStart = node.selectionEnd = caretPosToSet;
		}
	}

	/*
		description: moves caret present in `node` by `shiftAmount`
		`shiftAmount`: +tive or -tive integer. +tive if shift to right, else -tive.
	*/ 
	function shiftCursor(node, shiftAmount){
		var win, sel, range, loc;

		if(isContentEditable(node)){
			win = getNodeWindow(node);
			sel = win.getSelection(); range = sel.getRangeAt(0);
			loc = range.startOffset + shiftAmount;
			//console.dir(node);console.dir(range);
			range.setStart(range.startContainer, loc);
			range.setEnd(range.endContainer, loc);
			sel.removeAllRanges();
			sel.addRange(range);
		}
		else node.selectionStart = node.selectionEnd = node.selectionEnd + shiftAmount;
	}

	/*
		Keyboard handling functions
	*/

	function isNotMetaKey(event){
		return !event.ctrlKey && !event.shiftKey && 
				!event.metaKey && !event.altKey;
	}

	// that is, where we can perform
	// keypress, keydown functions
	function isUsableNode(node){
		var tgN = node.tagName,
			inputNodeType, data, retVal;

		if(!node.dataset) node.dataset = {};

		data = node.dataset;

		if(data && typeof data[CACHE_DATASET_STRING] !== "undefined")
			retVal = data[CACHE_DATASET_STRING] === "true";

		else if(isParent(node, null, ["CodeMirror", "ace"], 3))
			retVal = false;

		else if(tgN === "TEXTAREA" || isContentEditable(node))
			retVal = true;

		else if(tgN === "INPUT"){
			inputNodeType = node.attr("type");
			// "!inputNodeType" -> github issue #40
			retVal = !inputNodeType ||
						allowedInputElms.indexOf(inputNodeType) > -1;
		}
		else retVal = false;

		node.dataset[CACHE_DATASET_STRING] = retVal;

		return retVal;
	}

	function getCharFollowingCaret(node){
		var win, sel, range, container, text, caretPos;

		if(isContentEditable(node)){
			win = getNodeWindow(node);
			sel = win.getSelection();
			range = sel.getRangeAt(0);
			container = range.startContainer;
			caretPos = range.startOffset;
			text = getHTML(container); // no .html() as can be text node

			if(caretPos < text.length)
				return text[caretPos];
			else{ // caretPos was at the end of container
				container = range.startContainer.nextSibling;
				// so take the following node
				if(container){
					text = getHTML(container);
					if(text.length !== 0) return text[0];
				}
			}

			return "";
		}
		else return node.value[node.selectionStart] || "";
	}

	var handleKeyPress, handleKeyDown;
	(function(){
		// need a variable specific to keypress/down, hence using closure

		// boolean variable: if user types first letter of any auto-insert combo, like `(`,
		// then variable is set to true; now, if user types `)` out of habit, it will not become
		// `())` but rather `()` only. Variable is set to false on any keypress that is not
		// the first letter of any auto-insert combo and when autoInsertTyped's value is true.
		var autoInsertTyped = false;

		handleKeyPress = function(e){
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
				autoInsertPair = searchAutoInsertChars(charTyped, 0);

			if (autoInsertPair !== null){
				insertCharacter(node, autoInsertPair[1]);

				toIndexIncrease = 2;

				autoInsertTyped = true;
			}
			else if(autoInsertTyped){
				autoInsertPair = searchAutoInsertChars(charTyped, 1);

				// if charTyped is a valid second part in auto-inserts
				if(autoInsertPair !== null &&
					getCharFollowingCaret(node) === charTyped){
					e.preventDefault();

					shiftCursor(node, 1);

					autoInsertTyped = false;
				}
			}

			// Char insertion technique end
			////////////////////////////////

			// to type date, we do [[date=]] and for time we do [[time=]]
			// so check for that
			if(charTyped === "=")
				// wait till the = sign actually appears in node value
				setTimeout(provideDoubleBracketFunctionality, 10, node, win);

			// this logic of Placeholder only for textarea
			// about adjusting toIndex to match typed text
			if(!Placeholder.isCENode){
				var caretPos = node.selectionStart;

				if( Placeholder.mode &&
					caretPos >= Placeholder.fromIndex && caretPos <= Placeholder.toIndex){

					// when you select text of length 10, and press one key
					// I have to subtract 9 chars in toIndex
					if(Placeholder.justSelected){
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
			if(!tgN) return;

			// [Tab] key for tab spacing/placeholder shifting
			if(keyCode === 9 && metaKeyNotPressed){
				if((isGmail || isGoogle) && isParent(node, "form"))
					// in Gmail, the subject and to address field
					// should not have any tab function.
					// These two fields have a "form" as their parent.
					// thus, we check if the node has a form as a parent
					// if it is, then it is a to or subject field node
					// and we will not perform operation (return false)
					return false;

				// in placeholder mode, tab => jumping of placeholders
				if(Placeholder.mode){
					e.stopPropagation();
					e.preventDefault();

					if(Placeholder.isCENode)
						checkPlaceholdersInContentEditableNode();
					else{
						// when user has finished writing one placeholder
						// the next placeholder lies beyond the caret position
						Placeholder.fromIndex = node.selectionStart;
						checkPlaceholdersInNode(node, Placeholder.fromIndex, Placeholder.toIndex, true);
					}
				}
				// normal tab spacing if user specifies
				else if(Data.tabKey && tgN !== "INPUT"){
					e.preventDefault();
					e.stopPropagation();

					insertTabChar(node);
					resetPlaceholderVariables();
				}
				else resetPlaceholderVariables();
			}
			// snippet substitution hotkey
			else if(isSnippetSubstitutionKey(e, keyCode)){
				if(checkSnippetPresence(node)){
					e.preventDefault();
					e.stopPropagation();
				}
			}
			// pressing up/down arrows breaks out of placeholder mode
			// and prevents proper-bracket functionality (issues#5)
			else if([38, 40].indexOf(keyCode) >  -1){
				autoInsertTyped = false;
				resetPlaceholderVariables();
			}
		};
	})();

	// attaches event to document receives
	// `this` as the function to call on event
	function keyEventAttacher(handler){
		return function(event){
			var node = event.target;

			if(isUsableNode(node))
				handler.call(node, event);
		};
	}

	var onKeyDownFunc = keyEventAttacher(handleKeyDown),
		onKeyPressFunc = keyEventAttacher(handleKeyPress);

	function isSnippetSubstitutionKey(event, keyCode){
		var hk0 = Data.hotKey[0],
			hk1 = Data.hotKey[1];

		return hk1 ? event[hk0] && keyCode === hk1 :
				keyCode === hk0;
	}

	function attachNecessaryHandlers(win, isBlocked){
		win.oncontextmenu = function(event){
			ctxElm = event.target;
			ctxTimestamp =  Date.now();
			chrome.runtime.sendMessage({ctxTimestamp: ctxTimestamp});
		};

		win.onerror = function(){
			console.log("Error occurred in ProKeys. Mail a screen shot to prokeys.feedback@gmail.com to help me fix it! Thanks!");
		};

		if(isBlocked) return;

		// attaching listeners to `document` to listen to
		// both normal and dynamically attached input boxes
		win.document.on("keydown", onKeyDownFunc, true);
		win.document.on("keypress", onKeyPressFunc, true);
	}

	/*
		called when document.readyState is "complete"
		to initialize work
	*/

	function init(){
		// if DB is not loaded then
		// try again after 1 second
		if(!DB_loaded){ setTimeout(init, 1000); return; }
		// another instance is already running, time to escape
		if(document[uniqCSKey] === true) return;

		// in case of iframes, to avoid multiple detector.js instances
		// in one same document, see initiateIframeCheck function
		document[uniqCSKey] = true;

		// url of page
		var URL;

		try{
			PAGE_IS_IFRAME = window.location != window.parent.location;

			URL =  PAGE_IS_IFRAME ? document.referrer : window.location.href;
		}
		// CORS :(
		catch(e){
			URL = window.location.href;
		}

		var isBlocked = isBlockedSite(URL);

		chrome.runtime.onMessage.addListener(function(request, sender, sendResponse) {
			var timestamp;

			// when user updates snippet data, reloading page is not required
			if(typeof request.snippetList !== "undefined" && !window.IN_OPTIONS_PAGE){
				Data.snippets = Folder.fromArray(request.snippetList);
				Folder.setIndices();
			}

			else if(request.checkBlockedYourself)
				sendResponse(isBlocked);
			// ctxElm condition just to make sure that
			// the modal only appears in the window from where the block form intiated
			else if(request.task === "showModal" && ctxElm){
				if(PAGE_IS_IFRAME) 
					chrome.runtime.sendMessage({openBlockSiteModalInParent: true, data: request});
				else showBlockSiteModal(request);
			}

			else if(typeof request.clickedSnippet !== "undefined"){
				timestamp = parseInt(request.ctxTimestamp, 10);

				if(ctxTimestamp === timestamp){
					if(isUsableNode(ctxElm)) insertSnippetFromCtx(request.clickedSnippet, ctxElm);
					else alert("Unsupported textbox! Snippet cannot be inserted.");
				}
			}

			else if(request.giveSnippetList)
				sendResponse(Data.snippets.toArray());

			// when "Block this site" is called in iframe, iframe sends message
			// to background.js to send msg to show dialog in parent window
			// cannot access parent window directly due to CORS
			else if(request.showBlockSiteModal && !PAGE_IS_IFRAME)
				showBlockSiteModal(request.data);
		});

		attachNecessaryHandlers(window, isBlocked);

		// do not operate on blocked sites
		if(isBlocked) return true;

		setInterval(initiateIframeCheck, 500, document);

		window.isGoogle = /(inbox\.google)|(plus\.google\.)/.test(window.location.href);
		window.isGmail = /mail\.google/.test(window.location.href);
	}
})();