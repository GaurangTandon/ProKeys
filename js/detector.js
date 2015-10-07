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
	"use strict";

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

	var DataName = "UserSnippets",
		storage = chrome.storage.local,
		Data = {
			dataVersion: 1,
			snippets: [
				/*{
					name: "",
					body: "",
					timestamp: ""
				}*/
			],
			language: "English",
			visited: false,
			// to convert [tab] to 4 spaces or not
			tabKey: false,
			blockedSites: [],
			charsToAutoInsertUserList: [
						["(", ")"],
						["{", "}"],
						["\"", "\""],
						["[", "]"]],
			hotKey: ["shiftKey", 32] // added in 2.4.1
		},
		DB_loaded = false,
		// all below received from DB_load (in init method)
		Snippets, // snippet array
		blockedSites, // array of blocked sites URLS (string)
		charsToAutoInsertUserList, // array of charsToAutoInsert
		tabKeySpace, // boolean whether tab key --> "    "
		isGoogle, isGmail,
		SPAN_CLASS = "prokeys-snippet-text",
		months = ["January", "February", "March",
					"April", "May", "June", "July", "August", "September",
					"October", "November", "December"],
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
				return formatDate(padNumber(date.getDate()));
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
			container: null, // the text node containing the start placeholder
			regex: /^%[A-Z0-9_]+%$/i,
			regexAnywhere: /%[A-Z0-9_]+%/i,
			index: null, // the index of the current text node in the array
			array: null // array of all the text nodes
		},
		// prokeys cannot work in there input elements
		// they don't support caret manipulration
		bannedInputElms = ["password", "number", "email"];

	/*
	 DataBase functions
	 - DB_setValue
	 - DB_save
	 - DB_load
	 - isEmpty
	 - changeStorageType
	 - setEssentialItemsOnDBLoad
	*/

	function DB_setValue(name, value, callback) {
		var obj = {};
		obj[name] = value;

		storage.set(obj, function() {
			if(callback) callback();
		});
	}

	function DB_save(callback) {
		DB_setValue(DataName, Data, function() {
			if(callback) callback();
		});
	}

	function DB_load(callback) {
		storage.get(DataName, function(r) {
			if (isEmpty(r[DataName])) {
				DB_setValue(DataName, Data, callback);
			} else if (r[DataName].dataVersion != Data.dataVersion) {
				DB_setValue(DataName, Data, callback);
			} else {
				Data = r[DataName];
				if (callback) callback();
			}
		});
	}

	// changes type of storage: local-sync, sync-local
	function changeStorageType(){
		// property MAX_ITEMS is present only in sync

		if(storage.MAX_ITEMS)
			storage = chrome.storage.local;
		else
			storage = chrome.storage.sync;
	}

	function setEssentialItemsOnDBLoad(){
		DB_loaded = true;
		Snippets = Data.snippets;
		blockedSites = Data.blockedSites;
		tabKeySpace = Data.tabKey;
		charsToAutoInsertUserList = Data.charsToAutoInsertUserList;
	}

	/*
	 Helper functions for iframe related work
	 - initiateIframeCheckForSpecialWebpages
	 - checkIfSpecialPage
	 - getNodeWindow
	*/

	function initiateIframeCheckForSpecialWebpages(prop, sel){
		var uniq = "uniqIDForProKeys",
			iframes,
			doc;

		// evernote hack
		if(sel){
			iframes = document.querySelectorAll("iframe").filter(function(ifr){
				return ifr[prop].search(sel) > -1;
			});
		}else
			iframes = document.querySelectorAll(prop);

		iframes.forEach(function(iframe){
			doc = iframe.contentDocument;

			// make sure handler's not already attached
			if(!doc[uniq]){
				doc[uniq] = true;
				doc.on("keydown", onKeyDownFunc, true);
				doc.on("keypress", onKeyPressFunc, true);
			}
		});
	}

	// if any of some known web apps,
	// which are not caught in "all_frames": "true"
	// declaration; then look for them
	// and initiateIframeCheck for them
	function checkIfSpecialPage(){
		var loc = window.location.href, sel,
			obj = [
				[/admin\.mailchimp\.com/, "iframe.cke_wysiwyg_frame"],
				[/\.atlassian\.net/, "#wysiwygTextarea_ifr"],
				[/basecamp\.com/, "iframe.wysihtml5-sandbox"]
			];

		for(var i = 0; i < obj.length; i++){
			if(obj[i][0].test(loc)) {
				sel = obj[i][1];

				(function(sel){
					setInterval(initiateIframeCheckForSpecialWebpages, 500, sel);
				})(sel);

				return true;
			}
		}

		// Evernote keep changing their iframe's id, but
		// keep entinymce word always, so test for that
		if(/evernote\.com/.test(loc)){
			setInterval(initiateIframeCheckForSpecialWebpages, 500,
							"id", "entinymce");
			return true;
		}

		return false; // not a special webpage
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
		Miscellanous helper functions
		- passedThrough
	*/

	// Traverse DOM from event target up to parent, searching for selector
	function passedThrough(event, selector, stopAt) {
		var currentNode = event.target;

		while(true) {
			if(currentNode.matches(selector))
				return currentNode;
			else if(currentNode != stopAt && currentNode != document.body)
				currentNode = currentNode.parentNode;
			else return false;
		}
	}

	// prepends 0 to single digit num and returns it
	function padNumber(num){
		num = parseInt(num, 10);
		return (num >= 1 && num <= 9 ? "0" : "") + num;
	}

	/*
	  Date/Time Macro related helper functions
	  - to12Hrs
	  - parseDay
	  - parseMonth
	  - formatDate
	  - get31stDays
	  - getFormattedData
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
		var days = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

		return type === "full" ? days[day_num] : days[day_num].slice(0, 3);
	}

	// accepts num (0-11); returns month
	// type means full, or half
	function parseMonth(month, type){
		return type === "full" ? months[month] : months[month].slice(0, 3);
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

			switch(months[curr]){
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

	function getFormattedDate(){
		var d = new Date(),
			date = padNumber(d.getDate());

		return  parseMonth(d.getMonth(), "full") + " " + date + ", " + d.getFullYear();
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
	  - checkPlaceholderPresence
	  - checkSnippetPresence
	  - formatNextTextNode
	  - insertTextContentEditable
	  - testPlaceholderPresence
	  - setPlaceholderSelection
	*/

	function resetPlaceholderVariables(){
		Placeholder.mode = false;
		Placeholder.fromIndex = Placeholder.toIndex = 0;
		Placeholder.container = null;
		Placeholder.index = null;
		Placeholder.array = null;
	}

	// checks if the span node is added by prokeys
	function isProKeysNode(node){
		return node.tagName === "SPAN" &&
				(node && node.hasClass(SPAN_CLASS) || isGoogle);

		// in plus.google.com, the span elements which
		// are added by prokeys do not retain their
		// SPAN_CLASS no matter what I do
	}

	// formats macros present in snipBody
	function formatMacros(snipBody){

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
					}else
						regex = regex.replace(/[^a-zA-Z\\\/]/g, "").replace("\\d", "");

					if(sameTimeFlag)
						date.setTime(date.getTime() + change);

					subs = subs.replace(new RegExp(regex), elm[0](sameTimeFlag ? date : new Date(Date.now() + change)));
				});
			}

			return subs;
		});

		return snipBody;
	}

	// called by checkSnippetPresence for setting text node content
	// as it breaks on newlines so for each newline
	// create a <span> element
	function insertTextContentEditable(node, start, snipBody, snipName){
		// start is index just before snip name relative to node

		// get the array of strings for textnodes to be inserted
		var win = getNodeWindow(node),
			lines = snipBody.split("\n"),
			// content of text node
			val = node.textContent,
			// number of textnodes seen
			counter = 0,
			// the ending text of node after the snip name
			preservedEndText = val.substring(start),
			sel = win.getSelection(),
			range = sel.getRangeAt(0),
			// array of all the snip elements
			spanArray = [],
			// the first span element node
			snipElmNode = document.createElement("span"),
			// the first element node
			firstNode = snipElmNode,
			// on disqus thread the line break
			// is represented by </p>
			isDisqusThread = isParent(node, "#disqus_thread"),
			// fragment is a div to be inserted after each span node
			fragment;

		// make content of the textnode only till start
		node.textContent = val.substring(0, start - snipName.length);

		setText(snipElmNode, lines[0].replace(/ {2}/g, "&nbsp;&nbsp;"));
		snipElmNode.classList.add(SPAN_CLASS); // identification purpose

		node.insertAfter(snipElmNode); // and insert it after textnode
		counter += 1; // one textnode
		spanArray.push(snipElmNode); // insert node in array

		// i starts at 1 because we already inserted 1st span
		for(var i = 1, len = lines.length; i < len; i++){
			fragment = document.createElement("div");

			// if previous node had nothing, then add a <br>
			// element to fragment
			// as multiple divs in gmail collapse into one
			if(snipElmNode.innerHTML === "")
				fragment.innerHTML = isDisqusThread ? "<br></p>" : "<br>";

			// set end after current node
			range.setStartAfter(snipElmNode);
			range.setEndAfter(snipElmNode);

			// insert fragment at caret's place
			range.insertNode(fragment);
			range.setStartAfter(fragment);
			range.setEndAfter(fragment);

			// create new span node to isnert
			snipElmNode = document.createElement("span");
			setText(snipElmNode, lines[i].replace(/ {2}/g, "&nbsp;&nbsp;"));
			snipElmNode.classList.add(SPAN_CLASS);

			// insert node after fragment
			range.insertNode(snipElmNode);

			counter++;
			spanArray.push(snipElmNode);
		}

		// insert the text we had preserved
		setText(snipElmNode, getText(snipElmNode) + preservedEndText.replace(/ /g, "&nbsp;"));

		// populate Placeholder object
		Placeholder.array = spanArray.slice(0);
		Placeholder.index = 0;
		Placeholder.container = spanArray[0];
		Placeholder.mode = true;

		// return [lastNode, offset of snippet body end in last node, first node]
		return [counter === 1 ? null : snipElmNode,
					snipElmNode.innerText.length - preservedEndText.length, firstNode];
	}

	function testPlaceholderPresence(node, arr, valueND, snipBody, start, sel, range){
		var endLength = start + snipBody.length, offset, nd, lastNode;

		if(arr){
			// offset is the end of snippet in lastNode
			offset = arr[1];
			nd = arr[2];
			// can be null in case snipBody is only one line
			lastNode = arr[0] || arr[2];
		}else
			nd = node;

		if(Placeholder.regexAnywhere.test(snipBody)){
			Placeholder.mode = true;
			Placeholder.fromIndex = start; // this is the org. length w/o snip name
			Placeholder.toIndex = isProKeysNode(nd) ? offset : endLength; // this is with snip body
			// true below means text node is first
			checkPlaceholderPresence(nd, valueND, Placeholder.fromIndex, Placeholder.toIndex, true);
		}else{
			resetPlaceholderVariables();

			// set caret position just after snippet name
			if(lastNode){
				lastNode.focus();

				// getting the textnode inside lastnode
				var firstChild = lastNode.firstChild;
				while(firstChild && firstChild.nodeType !== 3)
					firstChild = firstChild.firstChild;

				if(firstChild == null)
					lastNode.firstChild = "";

				range.setStart(firstChild || lastNode.firstChild, offset);
				range.setEnd(firstChild || lastNode.firstChild, offset);
				sel.removeAllRanges();
				sel.addRange(range);
			}else
				nd.selectionEnd = nd.selectionStart = endLength;
		}
	}

	function insertSpace(node, sel, range){
		var charToInsert = Data.hotKey[1] || Data.hotKey[0],
			elm, val, initialString, endString, caretPos;

		charToInsert = charToInsert === 13 ? "\n" :
						charToInsert === 32 ? " " :
						String.fromCharCode(charToInsert);

		deleteSelection(node, sel, range);

		if(isContentEditable(node)){
			// prepare char to insert
			elm = document.createElement("span");
			elm.innerHTML = charToInsert === "\n" ? "<br>" :
							charToInsert === " "  ? "&nbsp;" :
							charToInsert;

			range.insertNode(elm); // insert character
			range.setStart(elm, 1); // set caret at
			range.setEnd(elm, 1); // end of character
			sel.removeAllRanges();
			sel.addRange(range); // add this range
		}else{
			val = node.value;
			caretPos = node.selectionEnd;
			initialString = val.substring(0, caretPos);
			endString = val.substring(caretPos);

			setText(node, initialString + charToInsert + endString);

			node.selectionEnd = node.selectionStart = caretPos + 1;
		}
	}

	function deleteSelection(node, sel, range){
		var nSE, nSS, val, selectedText;

		if(isContentEditable(node)){
			if(!range.collapsed)
				range.deleteContents();
		}else{
			nSS = node.selectionStart;
			nSE = node.selectionEnd;

			if(nSS !== nSE){
				val = node.value;
				selectedText = val.substring(nSS, nSE);

				node.value = val.substring(0, nSS) + val.substring(nSE);
				node.selectionStart = node.selectionEnd = nSS;
			}
		}
	}

	// check snippet's presence and intiate
	// another function to insert snippet body
	function checkSnippetPresence(node){
		var win = getNodeWindow(node),
			value = getText(node),
			snip,           // holds current snippet object
			snipNameLength, // length of snippet.name
			snipBody,
			snipped = false, // any snippet is found or not
			sel = win.getSelection(),
			range;

		try{
			if(sel && sel.getRangeAt)
				range = sel.getRangeAt(0);
		}catch(error){
			node.focus();
			range = sel.rangeCount > 0 ? sel.getRangeAt(0) : null;
		}

		if(!range) return;

		// textnode or textarea
		var nd = range.startContainer,
			// where cursor is placed (in respect to container)
			offset = isContentEditable(node) || nd.nodeType === 3 ?
				range.endOffset : node.selectionEnd,
			// value of text node
			valueND = nd.nodeType === 3 ? nd.textContent : value,
			arr, beginValue, endValue, start;

		// if the start and end points are not the same
		// break and insert some character there
		if(!range.collapsed) return insertSpace(node, sel, range);

		for(var i = 0, len = Snippets.length; i < len; i++){
			snip = Snippets[i];
			snipNameLength = snip.name.length;
			snipBody = snip.body;

			if(valueND.substring(offset - snipNameLength, offset) === snip.name){
				// there is a snippet
				snipped = true;

				// start of snippet body
				// for placeholder.fromIndex
				start = offset - snipNameLength;
				// value before snip name
				beginValue = valueND.substring(0, start);
				// value after snip name end
				endValue = valueND.substring(offset);

				// format the macros first
				snipBody = formatMacros(snipBody);

				if(nd && (nd.nodeType === 3 || isContentEditable(node)))
					// insert the value at the offset after text node
					// inserting new span element nodes as necessary
					arr = insertTextContentEditable(nd, offset, snipBody, snip.name);
				else
					// textareas
					setText(node, beginValue + snipBody + endValue);

				testPlaceholderPresence(node, arr, valueND, snipBody, start, sel, range);
			}
		} // for-loop end

		// if there was no snip
		if(!snipped)
			insertSpace(node, sel, range);
	}

	// calls checkSnippetPresence for next text node with
	// all the requirements
	function formatNextTextNode(){
		var from = Placeholder.index === 0 ?
					Placeholder.fromIndex : // first node
					0; // not first node

		var to = Placeholder.index === 0 ?
					Placeholder.toIndex : // first node
					Placeholder.container.textContent.length; // not first node

		var bool = setPlaceholderSelection(Placeholder.container, from, to);

		// a placeholder was found in the existing node
		// and it is now selected
		if(bool){
			return; // no need to check for next node
		}

		// one node will increase
		Placeholder.index += 1;

		// we are possibly on a text node other than that of snippet
		// as we have gone on more text nodes than limit
		if(Placeholder.index === Placeholder.array.length){
			resetPlaceholderVariables(); // end placeholder mode
			return;
		}

		var next = Placeholder.array[Placeholder.index];
		Placeholder.container = next;

		// on the last text node; the `to` setting would apply
		// a b c d
		//   ^- from
		// e f g h // full
		// i j k l // full
		// m n o p
		//     ^- end
		if(Placeholder.index === Placeholder.array.length - 1){ // last text node
			to = Placeholder.toIndex;
		}else{
			to = 0;
		}

		// from is set to zero as we are on a new textnode and hence have
		// to start at start of content
		checkPlaceholderPresence(next, next.textContent, 0, to, false);
	}

	// jumps from one `%asd%` to another (does not warp from last to first placeholder)
	function checkPlaceholderPresence(nd, value, from, to, notCheckSelection){
		// nd is textnode
		// check if there is %asd% in nd
		// - yes
		// - - highlight it
		// - no
		// - - move to next until Placeholder.toIndex
		// notCheckSelection avoids recursion

		var text = getUserSelection(nd);

		// if the `%A%` is selected, move to next
		if(Placeholder.regex.test(text) && notCheckSelection){
			if(isProKeysNode(nd)) formatNextTextNode();
			else // textarea
				checkPlaceholderPresence(nd, nd.value, nd.selectionEnd, to, false);

			return false;
		}

		if(isProKeysNode(nd) && Placeholder.array[Placeholder.index + 1])
			// this if condition means that if there is a next node
			// so we can set `to` to nd.length as the current node covers all the line
			to = nd.length;


		// bool indicates if placeholder was found (true) or not (false)
		var bool = setPlaceholderSelection(nd, from, to);

		// span node
		if(isProKeysNode(nd)){
			// if no placeholder in current node, format next node
			if(!bool) formatNextTextNode();
		}else{ // textareas
			// now probably the end of the snippet's placeholders has been reached
			// as no placeholder was found
			if(!bool)
				// now Placeholder.mode has ended
				resetPlaceholderVariables();
		}
	}

	// set selection of next placeholder
	// returns false if no placeholder else true
	function setPlaceholderSelection(node, from, to){
		var foundPlaceholder = false;

		// text of node (from `from` to `to`)
		var nodeText = isProKeysNode(node) ?
						node.textContent : getText(node),
			index,
			win = getNodeWindow(node),
			sel = win.getSelection(),
			range;

		if(isProKeysNode(node)){ // textnodes
			range = sel.getRangeAt(0);

			// if something is selected in the same node
			if(!range.collapsed && range.endContainer == node)
				from = range.endOffset;

			index = nodeText.substring(from, to).search(Placeholder.regexAnywhere);

			if(index > -1){ // placeholder found
				foundPlaceholder = true;

				// since we took a substring, so
				// we have to bring index in terms of
				// the actual whole node.textContent
				// and not the substringed part
				index += from;

				var str = "";
				// first get whole placeholder length
				for(var i = index + 1; nodeText[i] !== "%"; i++){
					str += nodeText[i];
				}
				// increase i by 2 (because condition of loop ignores both `%`)
				i += 2;
				// subtract one because end has already started
				// at first `%`
				i -= 1;

				range = sel.getRangeAt(0);

				/*
				`node` can:

				<span>"adasdasd" "asdasdasd" "asdasdasdasd"</span>
				// having three text nodes
				so, here, node.firstChild would return first textnode
				and offset index would be greater than its length
				so, in case this happens (usually in evernote)
				that's why getNodeAtOffset is needed
				*/

				var arrStart = getNodeAtOffset(node, index),
					arrEnd = getNodeAtOffset(node, i),
					startNode = arrStart[0],
					endNode = arrEnd[0],
					lenSkipped1 = arrStart[1],
					lenSkipped2 = arrEnd[1];

				range.setStart(startNode, index - lenSkipped1);
				range.setEnd(endNode, i - lenSkipped2);
				sel.removeAllRanges();
				sel.addRange(range);
			}
		}else{ // textareas
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
				// increase i by 2 (because condition of loop ignores both `%`)
				j += 2;
				// subtract one because end has already started
				// at first `%`
				j -= 1;

				node.selectionEnd = j;
			}
		}

		return foundPlaceholder;
	}

	/*
		Auto-Insert Character functions
		- searchAutoInsertChars
		- insertChar
	*/

	function searchAutoInsertChars(firstChar, index){
		var arr = charsToAutoInsertUserList;

		for(var i = 0, len = arr.length; i < len; i++)
			if(arr[i][0] === firstChar)
				return index ? [i, arr[i][1]] : arr[i][1];

		return -1;
	}

	// auto-insert character functionality
	function insertChar(character, node){
		// if some text was selected at this time
		// then that text would be deleted

		var win = getNodeWindow(node),
			sel, range, textNode;

		if(isContentEditable(node)){
			sel = win.getSelection();

			if (sel.rangeCount > 0) {
				// First, delete the existing selection
				range = sel.getRangeAt(0);
				range.deleteContents();

				// Create a textnode
				textNode = document.createTextNode(character);
				range.insertNode(textNode);

				// Move the selection to the middle of the text node
				range.setStart(textNode, 1);
				range.setEnd(textNode, 1);
				sel.removeAllRanges();
				sel.addRange(range);
			}
		}else{ // textarea
			var val = getText(node),
				text = character[1],
				curPos = getCaretPosition(node);

			var nSS = node.selectionStart,
				nSE = node.selectionEnd;

			// get length of selection
			var length = val.substring(nSS, nSE).length;

			// subtract selection length from it
			curPos -= length;

			// delete existing selection
			val = val.substring(0, nSS)	+ val.substring(nSE);

			// insert char now
			val = val.substring(0, curPos) + text + val.substring(curPos);

			// set the text
			setText(node, val);

			// reset selection indices
			node.selectionStart = node.selectionEnd = curPos;
		}
	}

	// gets complete page URL including all URLS
	// of all iframes to make blocked sites
	// work in gmail, etc.
	function getCompletePageURL(currWindow){
		var URL = currWindow.location.href;

		// catches any errors while moving over iframes
		// which raise content security policy
		try{
			// window.parent is a reference to self in case no parent is present :(
			while(currWindow.parentNode || (currWindow.parent != currWindow)){
				currWindow = currWindow.parentNode || currWindow.parent;

				URL += currWindow.location.href;
			}
		}catch(e){}

		return URL;
	}

	// returns whether site is blocked by user
	function isBlockedSite(win){
		var domain = getCompletePageURL(win).replace(/^(ht|f)tps?:\/\/(www\.)?/, ""),
			arr = blockedSites;

		for(var i = 0, len = arr.length; i < len; i++){
			var str = arr[i],
				regex = new RegExp("^" + escapeRegExp(str));

			if(regex.test(domain))	return true;
		}

		return false;
	}

	function getSelectionStart(node){
		if(isContentEditable(node)){
			var caretOffset = 0,
				win = getNodeWindow(node);

			node.focus();

			var sel = win.getSelection();

			if(!(sel && sel.rangeCount > 0)) return;

			node.focus();

			var range = sel.getRangeAt(0),
				preCaretRange = range.cloneRange();

			preCaretRange.selectNodeContents(node);
			preCaretRange.setEnd(range.endContainer, range.endOffset);

			caretOffset = preCaretRange.toString().length;

			return caretOffset;
		}else{
			return node.selectionStart;
		}
	}

	// returns user-selected text in content-editable element
	function getUserSelection(node){
		var win, sel;

		if(node.nodeType === 3 || isContentEditable(node)){
			win = getNodeWindow(node);
			sel = win.getSelection();

			try{
				return sel.getRangeAt(0).toString();
			}catch(e){
				node.focus();

				return win.getSelection()
						.getRangeAt(0).toString();
			}
		}
		// textarea
		else{
			return getText(node)
						.substring(node.selectionStart, node.selectionEnd);
		}
	}

	// for getting range.setStart/End to work
	// refer docs: https://developer.mozilla.org/en-US/docs/Web/API/range/setStart
	function getNodeAtOffset(elmNode, offset){
		var children = elmNode.childNodes, child, childTextLen,
			lengthSkipped = 0;

		for(var i = 0, len = children.length; i < len; i++){
			child = children[i];
			childTextLen  = getText(child).length;

			if(childTextLen >= offset){
				return [child, lengthSkipped];
			}else{
				offset -= childTextLen;
				lengthSkipped += childTextLen;
			}
		}

		return [null, lengthSkipped];
	}

	// get caret pos, or rather where it ends
	function getCaretPosition(node) {
		var range, preCaretRange, caretOffset,
			win = getNodeWindow(node);

		if(isContentEditable(node)){
			range = win.getSelection().getRangeAt(0);
			preCaretRange = range.cloneRange();

			preCaretRange.selectNodeContents(node);
			preCaretRange.setEnd(range.endContainer, range.endOffset);
			caretOffset = preCaretRange.innerText.length;

			return caretOffset;
		}else{
			return node.selectionEnd;
		}
	}

	// classArray for CodeMirror and ace editors
	// parentSelector for others
	// max search upto 10 parent nodes (searchLimit)
	function isParent(node, parentSelector, classArray, searchLimit) {
		function classMatch(classToMatch){
			var c = node.className;
			if(!c) return false;
			c = c.split(" ");
			
			for(var i = 0, len = c.length; 
				i < len; i++)
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

	function isContentEditable(node){
		var tgN = node && node.tagName,
			attr, parentCount, parent;

		// insanity checks first
		if(!node || tgN === "TEXTAREA" || tgN === "INPUT" || !node.getAttribute)
			return false;
		else{
			attr = node.getAttribute("contenteditable");

			// empty string to support <element contenteditable> markup
			if(attr === "" || attr === "true" || attr === "plaintext-only")
				return true;

			// important part below
			// note that if we introduce a snippet
			// then it generates <span> elements in contenteditable `div`s
			// but they don't have content-editable true attribute
			// so they fail the test, hence, here is a new check for them
			// search if their parents are contenteditable
			// but only do this if the current node is not a textarea
			// which we have checked above

			parentCount = 1; // only two parents allowed
			parent = node;

			do{
				parent = parent.parentNode;
				parentCount++;

				if(!parent) return false;
				if(isContentEditable(parent)) return true;
			}while(parentCount <= 2);

			return false;
		}
	}

	function formatVariable(str){
		if(/date/i.test(str))
			return getFormattedDate();
		else if(/time/i.test(str))
			return getTimestamp();
		else if(/version/i.test(str))
			return navigator.userAgent.match(/Chrome\/[\d.]+/)[0].replace("/", " ");

		return null;
	}

	// gets string containing `[[something=]]`
	// returns the string having evaluated the something
	function evaluateDoubleBrackets(wholeValue, start, end){
		var rValue; // value to replace in the brackets

		// and then, start and end should correspond
		// to start and end of value inside the brackets
		// and not include the brackets, so adjust the
		// values below
		end -= 2;
		start += 2;

		var orgValue = wholeValue.substring(start, end);
		rValue = orgValue.replace(/[\[\]]/g, "");

		var variable = formatVariable(rValue);

		if(variable) rValue = variable;
		else{ // no date or time; I can safely remove all non-expected symbols
			rValue = rValue.replace(/[^\d\^\*\/\.\-\+\%\(\)]/g, "");

			// empty string
			if(!rValue) rValue = orgValue;
			else{
				try{
					// replace for ^ exponent operators
					rValue = rValue.replace(/(\d+)\^(\d+)/g, function(wMatch, $1, $2){
						return "Math.pow(" + $1 + "," + $2 + ")";
					});
					// replace for % operator
					rValue = rValue.replace(/%/g, "/100");
					rValue = eval(rValue);
				}catch(e){
					rValue = orgValue;
				}

				// convert to float of 5 point precision and to string
				rValue = parseFloat(rValue).toFixed(5).toString();

				// remove the extraneous zeros after decimal
				rValue = rValue.replace(/\.(\d*?)0+$/, ".$1");

				// remove the dot if no digits are there after it
				rValue = rValue.replace(/\.$/, "");

				if(isNaN(rValue))
					rValue = orgValue;
			}
		}

		// rValue changed
		if(rValue !== orgValue){
			// replace the `[[expression]]` with rValue
			wholeValue = wholeValue.replace(wholeValue.substring(start - 2, end + 2), rValue);
		}else{
			// add brackets to set that
			// so that the handleKeyPress can detect anomaly
			rValue = "[[" + rValue + "]]";
		}

		return [wholeValue, rValue];
	}

	function insertTabChar(node){
		var win = getNodeWindow(node),
			sel = win.getSelection(),
			range = sel.getRangeAt(0),
			span, value, caretPos;

		deleteSelection(node, sel, range);

		// in GMail share box, attrbute is plain-text only
		if(isContentEditable(node)){
			// create span with four spaces as text
			// (or use contextualFragment)
			span = document.createElement("span");
			span.innerHTML = "&nbsp;&nbsp;&nbsp;&nbsp;";

			// insert 4 spaces at cursor position
			range.insertNode(span);

			// now all 4 characters are selected
			// set caret at end
			range.collapse(false);

			sel.removeAllRanges();
			sel.addRange(range);
		}else{ // textarea
			caretPos = node.selectionStart;
			value = getText(node);

			setText(node,
				value.substring(0, caretPos) + "    " + value.substring(caretPos));

			node.selectionStart = node.selectionEnd = caretPos + 4;
		}

		resetPlaceholderVariables(); // no placeholder mode (tab-key branch)
	}

	// returns value between txt1 and txt2 nodes
	function getValueBetweenNodes(txt1, txt2, lastInclusive){
		var val = txt1.textContent,
			next = txt1.nextSibling;

		// get value of all nodes except
		// txt2
		while(next !== txt2){
			val += next.textContent;
			next = next.nextSibling;
		}

		// only add txt2 if mode is till
		if(lastInclusive) val += txt2.textContent;

		return val;
	}

	// gets the node in right direction from currNode
	// which has the closing bracket `]`
	// limited to 10 iterations of while loop
	function getClosingNode(currNode){
		var next = currNode.nextSibling,
			iterations = 0,
			bracketCount = 0;

		// if last character is a `]`
		if(currNode.textContent[currNode.textContent.length - 1] === "]"){
			bracketCount = 1;
		}

		// search for the text node
		while(next && next.textContent !== "]" && iterations < 10) {
			iterations += 1;
			next = next.nextSibling;
		}

		// found textnode having bracket
		if(next && /\]/.test(next.textContent)) bracketCount += 1;

		// if only one bracket found
		// might be that we had parentheses within our expression
		// which inserted more nodes
		// and so the current next node contains the second-last `]`
		// we get the last `]` below
		if(next && bracketCount === 1)
			next = next.nextSibling;

		return next || false;
	}

	// gets the node in left direction from currNode
	// which has the open bracket `[`
	// limited to 10 iterations of while loop
	function getFirstNode(currNode){
		var prev = currNode.previousSibling,
			iterations = 0,
			bracketCount = 0;

		if(currNode.textContent[0] === "[")
			bracketCount = 1;

		// search for the text node
		while(prev && prev.textContent !== "[" && iterations < 10) {
			iterations += 1;
			prev = prev.previousSibling;
		}

		if(prev && prev.textContent === "[")
			bracketCount += 1;

		// if only one bracket found
		// might be that we had parentheses within our expression
		// which inserted more nodes
		// and so the current prev node contains the second `[`
		// we get the first `[` below
		if(prev && bracketCount === 1 && prev.previousSibling)
			prev = prev.previousSibling;

		return prev || false;
	}

	// empty nodes start and end and all others
	// in between them
	function emptyNodes(start, end){
		var next = start;

		while(next !== end){
			next.textContent = "";
			next = next.nextSibling;
		}

		end.textContent = "";
	}

	// provides double bracket functionality
	// i.e. replacement of text of mathomania/variable
	// with their required value after `=` has been pressed
	// which has been detected by handleKeyPress
	function provideDoubleBracketFunctionality(node, win){
		var sel = win.getSelection(),
			range = sel.getRangeAt(0), // get the new range
			caretPos = isContentEditable(node) || node.nodeType === 3 ?
					range.endOffset : node.selectionEnd,
			value = isContentEditable(node) || node.nodeType === 3 ?
					node.textContent : getText(node),
			// index of start and close brackets `[ and `]`
			startBracketIndex, closeBracketIndex, closeNode, firstNode,
			operate = true;

		// if it is a text node, then possibly
		// the structure of brackets is "[" "[42=]" "]"
		// this shows three text nodes
		// we need to join them to get actual value
		if(node.nodeType === 3){
			closeNode = getClosingNode(node);
			firstNode = getFirstNode(node);

			if(!closeNode || !firstNode) operate = false;
			else{
				var val1 = getValueBetweenNodes(firstNode, node, false),
					val2 = getValueBetweenNodes(node, closeNode, true);

				if(!val1 || !val2) operate = false;
				else value = val1 + val2;
			}

			startBracketIndex = 0;
			closeBracketIndex = value.length;
		}else{ // textareas
			// first get index of start bracket `[`
			for(startBracketIndex = caretPos;
					value[startBracketIndex] !== "[" && startBracketIndex >= 0;
							startBracketIndex--);

			// if the index we got and its before index
			// are not `[`, do not operate
			if(value[startBracketIndex] !== "[" ||
				value[startBracketIndex - 1] !== "[")
					operate = false;
				
			// set index to the first bracket of the `[[` pair
			else
				startBracketIndex -= 1;

			if(value[caretPos] + value[caretPos + 1] !== "]]")
				operate = false;
			else closeBracketIndex = caretPos + 2;
		}
		
		if(operate){
			// get value to set
			var rValue = evaluateDoubleBrackets(value, startBracketIndex, closeBracketIndex);
			value = rValue[0]; //  used in setting value for textarea
			rValue = rValue[1];

			// set value
			if(node.nodeType === 3){
				// empty the nodes containing the expression
				// a whole
				emptyNodes(firstNode, node);
				emptyNodes(node, closeNode);

				// set value in main node
				node.textContent = rValue;

				// set cursor after the rValue
				// note that node is a textnode containing
				// only the rValue
				range.setStart(node, rValue.length);
				range.setEnd(node, rValue.length);
				range.collapse(true);
				sel.removeAllRanges();
				sel.addRange(range);
			}else{
				setText(node, value);

				// let expression = 900
				// [[ 900=]]
				// ^     ^  ^- closeBracketIndex
				// ^      ^- caretPos (after =)
				// - startBracketIndex

				node.selectionEnd = node.selectionStart = startBracketIndex + rValue.length;
			}
		}
	}

	/*
		Keyboard handling functions:
		- isUsableNode
		- handleKeyDown
		- handleKeyPress
		- keyEventAttacher
		- onKeyDownFunc
		- onKeyPressFunc
		- isSnippetSubstitutionKey
	*/

	// that is, where we can perform
	// keypress, keydown functions
	function isUsableNode(node){
		var tgN = node.tagName,
			inputNodeType;
			
		// node having reactid is operated upon
		// by ReactJS and ProKeys can't work simultaneously
		if(node.dataset && typeof node.dataset.reactid !== "undefined")
			return console.log("A") && 0;
		else if(isParent(node, null, ["CodeMirror", "ace"], 3))
			return console.log("B") && 0;
		else if(tgN === "INPUT"){
			inputNodeType = node.getAttribute("type");
			return bannedInputElms.indexOf(inputNodeType) === -1;
		}else return tgN === "TEXTAREA" || isContentEditable(node);
	}

	function handleKeyDown(e) {
		var keyCode = e.keyCode,
			node = e.target,
			// do not use `this` instead of node; `this` can be document iframe
			tgN = node.tagName;

		// document iframe
		if(!tgN) return;

		if(isGmail && isParent(node, "form"))
			// in Gmail, the subject and to address field
			// should not have any function.
			// These two fields have a "form" as their parent.
			// thus, we check if the node has a form as a parent
			// if it is, then it is a to or subject field node
			// and we will not perform operation (return false)
			return false;


		node = isContentEditable(node) ?
			(Placeholder.container || node)
			: node;

		tgN = node.tagName;

		// [Tab] key for tab spacing/placeholder shifting
		if(keyCode === 9 && !e.shiftKey && !e.ctrlKey){
			// in placeholder mode, tab => jumping of placeholders
			if(Placeholder.mode){
				e.stopPropagation();
				e.preventDefault();

				checkPlaceholderPresence(node, getText(node), Placeholder.fromIndex, Placeholder.toIndex, true);
			}
			// normal tab spacing if user specifies
			else if(tabKeySpace && tgN !== "INPUT"){
				e.preventDefault();
				e.stopPropagation();

				insertTabChar(node);
			}
			else resetPlaceholderVariables();
		}
		// snippet substitution hotkey
		else if(isSnippetSubstitutionKey(e, keyCode)){
			e.preventDefault();
			e.stopPropagation();
			checkSnippetPresence(node);
		}
		// pressing arrows breaks out of placeholder mode
		else if([37, 38, 39, 40].indexOf(keyCode) >  -1)
			resetPlaceholderVariables();
	}

	// Calls appropriate functions based on key pressed
	function handleKeyPress(e){
		var node = e.target,
			// holds integer on how much to increase Placeholder.toIndex by during Placeholder.mode : bug-fix
			toIndexIncrease = 1,
			win = getNodeWindow(node);

		////////////////////////////////////////////////////////////////////////////////////////////
		// Why use `toIndexIncrease` ?  Because of following bug:                                ///
		// Suppose, text is "%A% one two three %B%"                                              ///
		// Placeholder.fromIndex is 0 and Placeholder.toIndex is 21 (length of string)           ///
		// when user goes on %A% and types in text suppose 5 chars long                          ///
		// then the %B% moves 5 chars right, and thus the text that comes                        ///
		// within the range of Placeholder.fromIndex/Placeholder.toIndex becomes "12345 one two thre" -- missing "e %B%" ///
		// and thus this eliminated the placeholders    										 ///
		////////////////////////////////////////////////////////////////////////////////////////////

		////////////////////////////////
		// Char insertion technique start
		var charTyped = String.fromCharCode(e.keyCode),
			index = searchAutoInsertChars(charTyped, true),
			text;

		if (index !== -1){
			// create text
			text = charsToAutoInsertUserList[index[0]];
			text = text[0] + text[1];

			// no text shall be inserted
			if(isContentEditable(node))
				e.preventDefault();

			// insert char
			insertChar(text, node);
		}

		// Char insertion technique end
		////////////////////////////////

		if(index !== -1)
			toIndexIncrease = 2;
		else
			toIndexIncrease = 1;

		var caretPos = getSelectionStart(node);

		// due to aforementioned bug
		if( Placeholder.mode &&
			caretPos > Placeholder.fromIndex && caretPos < Placeholder.toIndex)
			Placeholder.toIndex += toIndexIncrease;

		var sel, range,
			operate = true, // to operate or not operate
			value;

		// to type date, we do [[date=]] and for time we do [[time=]]
		// so check for that
		if(charTyped === "="){
			node = isContentEditable(node) ?
					win.getSelection().getRangeAt(0).endContainer : node;

			// wait till the = sign actually appears in node value
			setTimeout(provideDoubleBracketFunctionality, 10, node, win);
		}
	}

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

		if(hk1)
			return event[hk0] && keyCode === hk1;
		else
			return keyCode === hk0;
	}

	// asynchoronous function call
	// to load data
	DB_load(function(){
		// wrong storage Placeholder.mode
		if(Data.snippets === false){
			// change storage to other type
			changeStorageType();

			DB_load(setEssentialItemsOnDBLoad);

			return;
		}

		// if hotkey array is not present initially
		if(typeof Data.hotKey === typeof void0){
			Data.hotKey = ["shiftKey", 32];
			DB_save();
		}

		setEssentialItemsOnDBLoad();
	});

<<<<<<< HEAD
	/*
		called when document.readyState is "complete"
		to initialize work
	*/
=======
	// insert element after node
	function insertAfter(node, elm){
		node.parentNode.insertBefore(elm, node.nextSibling);
	}

	// check class for node
	function hasClass(node, className) {
		if(!node.className) return false;
        return node.className.search('(\\s|^)' + className + '(\\s|$)') != -1 ? true : false;
   }

	// attaches event to document receives
	// `this` as the function to call on event
	function eventAttacher(event){
		var node = event.target;

		if(	node.tagName === "TEXTAREA" || 
			node.tagName === "INPUT" ||
			isContentEditable(node))
			this.call(node, event);
	}
>>>>>>> origin/master

	function init(){
		// if DB is not loaded then
		// try again after 1 second
		if(!DB_loaded){ setTimeout(init, 1000); return; }

		// do not operate on blocked sites
		if(isBlockedSite(window)) return;

		window.onerror = function(){
			console.log("Error occurred in ProKeys. Mail a screen shot to prokeys.feedback@gmail.com to help me fix it! Thanks!");
		};

		isGoogle = /(inbox\.google)|(plus\.google\.)/.test(window.location.href);
		isGmail = /mail\.google/.test(window.location.href);
/*
		var siteRegex = /(\.atlassian\.net)|(basecamp\.com)|(mail\.yahoo\.com)|(evernote\.com)|(salesforce\.com)|(slack\.com)|(mailchimp\.com)|(workflowy\.com)/;

		// these sites require continuous check for dynamically loaded iframes
		if(isGoogle || siteRegex.test(window.location.href)){
			(function checkForNewIframe(doc, uniq) {
				var listenerAdded = false;
				try {
					if (!doc) return; // document does not exist. Cya
					// ^^^ For this reason, it is important to run the content script
					//    at "run_at": "document_end" in manifest.json

					// Unique variable to make sure that we're not binding multiple times
					if (!doc.rwEventsAdded9424550) {
						// add listener iff not already present
						// listenerAdded stores false if listener was not added
						listenerAdded = doc.addEventListener("keydown", onKeyDownFunc, true);
						doc.addEventListener("keypress", onKeyPressFunc, true);

						// only set property if event listener was added
						if(listenerAdded)
							doc.rwEventsAdded9424550 = uniq;
					} else if (doc.rwEventsAdded9424550 !== uniq) {
						// Conflict: Another script of the same type is running
						// Do not make further calls.
						return;
					}

					var iframes = doc.getElementsByTagName("iframe"), contentDocument;

					for (var i = 0, len = iframes.length; i < len; i++) {
						contentDocument = iframes[i].contentDocument;

						if (contentDocument && !contentDocument.rwEventsAdded9424550) {
							// Add poller to the new iframe
							checkForNewIframe(contentDocument);
						}
					}
				} catch(e) {
					// Error: Possibly a frame from another domain?
				}
				setTimeout(checkForNewIframe, 1500, doc, uniq); //<-- delay of 1.5 second
			})(document, 1 + Math.random()); // Initiate recursive function for the document.
			return;
		}*/

		/*
		var interval = setInterval(function(){
			var elm = $("div.aoI"); // see reason quicknotes

			if(elm){
				clearInterval(interval);
				elm.on("keydown", onKeyDownFunc, true);
				elm.on("keypress", onKeyPressFunc, true);
			}
		}, 250);*/

		// attaching listeners to `document` to listen to
		// both normal and dynamically attached input boxes
		document.on("keydown", onKeyDownFunc, true);
		document.on("keypress", onKeyPressFunc, true);

		checkIfSpecialPage();

		/* to send a message to HTMLjs.js
		chrome.runtime.sendMessage({greeting: "hello"}, function(response) {
			console.log(response.farewell);
		});
		syntax for message receival
		chrome.runtime.onMessage.addListener(function(request, sender, sendResponse) {

		});
		*/

		chrome.runtime.onMessage.addListener(function(request, sender, sendResponse) {
			var s = request["blockSite"];
			
			/*if(s){
				Data.blockedSites = s;
				DB_save(function(){
					console.log(s);
				});
			}else */if(typeof request == "object"){
				// changes in snippet data; save temporarily
				Snippets = request.slice(0);
			}
		});
	}
})();