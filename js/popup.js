(function () {
	"use strict";

    window.onload = init;

	//////////////////////
	// Global variables
	//////////////////////

	var DataName = "UserSnippets",
		storage = chrome.storage.local,
		Data = {
			dataVersion: 1,
			snippets: [
				{
					name: "",
					body: "",
					timestamp: ""
				}
			], 
			language: "English",
			visited: false,
			// dictates whether tab key translates to "    "; set by user
			tabKey: false,
			blockedSites: [],
			charsToAutoInsertUserList: [
						["(", ")"],  
						["{", "}"],
						["\"", "\""],
						["[", "]"]],
			hotKey: ["shiftKey", 32] // added in 2.4.1
		},
		// max chars allowed
		SNIP_NAME_LIMIT = 25,
		// max chars allowed
		SNIP_BODY_LIMIT = 2000,

		// NOTE: snip_name/body_limit has been used in options.js
		// as magic numbers; so while updating the value of them here
		// please update it there over on options.js -> method areSnippetsValid

		// denotes that search is taking place
		searchMode = false,
		// true if DB has been loaded
		DB_loaded = false,
		// dialog is the div.message
		dialogPoppedUp = false,
		dlog;

	/////////////////////////
	// DataBase functions
	/////////////////////////
	//-> courtesy Ocanal from http://stackoverflow.com/questions/13941556/chrome-extension-and-local-storage

	// To insert new value, do : 
	// Data.snippets.push(
	// {name: "xyz", body: "123", "date" : getDate()}  );
	// DB_save();

	// returns a copy of the snippet
	function getSnippetCopy(snip) {
		return {
			name: snip.name,
			body: snip.body,
			timestamp: snip.timestamp
		};
	}

	function DB_setValue(name, value, callback) {
		var obj = {};
		obj[name] = value;

		storage.set(obj, function() {
			if(callback) callback();
		});
	}

	function DB_load(callback) {
		storage.get(DataName, function(r) {
			if (isEmpty(r[DataName])) 
				DB_setValue(DataName, Data, callback);
			else if (r[DataName].dataVersion != Data.dataVersion) 
				DB_setValue(DataName, Data, callback);
			else 
				Data = r[DataName];				
			
			if (callback) callback();
		});
	}

	function DB_save(callback) {
		DB_setValue(DataName, Data, function() {
			if(callback) callback();
		});
	}

	function isEmpty(obj) {
		for(var prop in obj) {
			if(obj.hasOwnProperty(prop))
				return false;
		}
		return true;
	}

	function checkRuntimeError(){
		if(chrome.runtime.lastError){
			showDialog();
			text(dlog, "An error occurred! Please right-click on the \"Ok\" button below, select \"Inspect Element\" from the context menu, copy whatever is shown in the 'Console' tab and report it at my email: prokeys.feedback@gmail.com . This will help me improve my extension and resolve your issue. Thanks!");
			var btn = document.createElement("button");
			btn.innerHTML = "Ok";
			btn.onclick = removeDialog;
			dlog.appendChild(btn);
			console.log(chrome.runtime.lastError);
		}
	}

	// set a new snippet/edit existing snippet in database
	function setDataSnippet(name, body, old_name){
		// check for duplicate
		var existing_snip = searchSnippets(old_name, undefined, "index"), snip;

		// if snip exists; its a call to edit snip
		// rather than create new one
		if(existing_snip){
			snip = existing_snip[0];
			var index = existing_snip[1];

			snip.name = name;
			snip.body = body;

			Data.snippets[index] = snip;
		}else{
			// dupe not found; create new snip
			snip = {};
			snip.name = name;
			snip.body = body;
			snip.timestamp = getFormattedDate();

			Data.snippets.unshift(getSnippetCopy(snip));

			// highlight first snippet after 3 seconds
			// so that: 1) listSnippets is complete
			// 2) the newest snippet is listed at top
			setTimeout(function(){
				// highlight so the user may notice it #ux
				highlightFirstSnippet();
			}, 500);
		}

		return snip;
	}

	function notifySnippetDataChanges(){
		chrome.tabs.query({}, function(tabs){
			var tab; 
			for (var i = 0, len = tabs.length; i < len; i++) {
				tab = tabs[i];
				if(!tab || !tab.id) continue;

				chrome.tabs.sendMessage(tab.id, Data.snippets);
			}
		});
	}

	//////////////////////
	// Helper functions
	//////////////////////

	function highlightFirstSnippet(){
		// get first li.snip
		var firstSnippetLI = 
					document.querySelector("#snips ul li");

		// add highlighting class to it, which induces -webkit-animation
		firstSnippetLI.classList.add("highlighting");

		// remove after some time
		setTimeout(function(){
			firstSnippetLI.classList.remove("highlighting");
		}, 5000);
	}

	function escapeRegExp(str) {
		return str.replace(/[\-\[\]\/\{\}\(\)\*\+\?\.\\\^\$\|]/g, "\\$&");
	}

	function validateSVal(sVal, len){
		if(len > SNIP_NAME_LIMIT)
			return "Length of snip name cannot exceed " + SNIP_NAME_LIMIT + " (" + (len - SNIP_NAME_LIMIT) + " excess characters present)";

		if(len === 0) return "Empty snippet name field";

		if( /^%.+%$/.test(sVal)) return "Snippet name cannot be of the form '%abc%'";
		if( /\n/.test(sVal)    ) return "Snippet name cannot have newlines";
		if( /\s+/.test(sVal)   ) return "Snippet name cannot contain spaces. Use a dot or underscore instead";

		// ([][word]) because
		// because Data.snippets contains a constructor which replaces the thing with 
		// `function Object(){ [native code] }` and similar others include
		// forEach and so on
		if( [][sVal] )
			return "Invalid snippet name! Please prefix it with a underscore and try again. For details please visit Help page";

		// A unique snippet with that name exists
		if( Object.prototype.toString.call(searchSnippets(sVal)) === '[object Object]' )
			return "A snippet with name '" + sVal + "' already exists";

		return true;
	}

	function validateLVal(len){
		if(len > SNIP_BODY_LIMIT)
			return "Length of snip body cannot exceed " + SNIP_BODY_LIMIT+ " (" + (len - SNIP_NAME_LIMIT) + " excess characters present)";

		if(len === 0) return "Empty snippet body field";

		return true;
	}

	// checks if textarea exceeds number of chars; and sets its text and dataset.full accordingly
	function setTextareaText(string, length){
		var bool, mode;

		bool = length ? string.length > length : false;

		this.dataset.full = string;

		// for element nodes, it is make entity for others it is makeHTML
		mode = this.isTextBox() ? "makeHTML" : "makeEntity";

		text( this, formatHTML(string, mode) );

		return bool;
	}

	// reutnrs date for using in timestamp
	function getFormattedDate(){
		var m_names = ["January", "February", "March", 
					"April", "May", "June", "July", "August", "September", 
					"October", "November", "December"];

		var d = new Date(),
			date = parseInt(d.getDate(), 10);

		if(date <= 9) date = "0" + date;

		return m_names[d.getMonth()] + " " + date + ", " + d.getFullYear();
	}

	// returns an array of matched snip objects; or unique snip object
	// based on 2 optional parameters
	// `return_val` is `"index"` when index of the matched unique snip
	// is required; else it is omitted
	function searchSnippets(name, body, return_val){
		var result = [], snip; // stores the finals snips

		name = name && escapeRegExp(name);
		body = body && escapeRegExp(body);

		for(var i = 0, len = Data.snippets.length; i < len; i++){
			snip = Data.snippets[i];

			// names give unique match; return immediately
			if(name && new RegExp("^" + name + "$", "i").test(snip.name))
				// check of `name &&` is important as
				// it can be undefined and 
				// new RegExp(undefined, "i")
				// would match every string

				return return_val === "index" ? [snip, i] : snip;

			// searching is case-insensitive
			if((body && new RegExp(body, "i").test(snip.body)) || 
				(name && new RegExp(name, "i").test(snip.name)))
				result.push(snip);
		}

		// `return` all the snips that matched some criteria; 
		// if array is empty, return false
		return result[0] ? result : false;
	}

	function getDropDownElm(){
		var img = document.createElement("img");
		img.src = "../imgs/dropdown.gif";
		img.setAttribute("alt", "Click to see the full snippet");
		img.setAttribute("title", "Click to see the full snippet");
		img.classList.add("dropdown");
		img.onclick = onDropDownClick;

		return img;
	}

	// receives array of snippet objects, and lists them in popup.html > div#snips
	function listSnippets(snip_array, sval_to_show) {
		// note that snip_array can be actual Data.snippets
		// or smaller array from searchMode

		var div, snipsDiv, ul, snip, li,
			divShort, divLong, btnCollection, created_on;

		if(!DB_loaded){ // no data
			// try after 500ms
			setTimeout(listSnippets, 250, Data.snippets);
			return;
		}
		// user does not have any snips
		else if(!Data.snippets[0]){
			div = document.getElementById("snips");

			div.innerHTML = "<p class='display_msg_to_user'>You currently have no snippets.<br>Why not <a class='trigger_create_new'>create a new snippet?</a></p>";

			document.querySelector(".trigger_create_new").onclick = function(){
				document.querySelector('.button[aria-label="Create new Snippet"]').onclick();
			};

			return;
		}

		snip_array = !searchMode ? Data.snippets : snip_array;

		// in the `ul`; we will place snips as `li` elements
		snipsDiv = document.getElementById("snips");

		text(snipsDiv, "");

		ul = document.createElement("ul");

		// now loop and display
		for(var i = 0, len = snip_array.length; i < len; i++){
			snip = snip_array[i];

			//////
			// Here we will check the length of both `i` and `data[i]`
			// if any exceeds recommended length
			// cut them and store a data-attribute
			// in the respective `div.short` or `div.long`
			/////

			li = document.createElement("li");

			// creating the short `div` element
			divShort = document.createElement("div");

			setTextareaText.call(divShort, snip.name);

			li.appendChild(divShort).classList.add("short");

			// our `div` long element; with Snip body
			divLong = document.createElement("div");
			setTextareaText.call(divLong, snip.body);
			// appended after btnCollection

			// creating our collection of buttons
			btnCollection = document.createElement("div");

			// prepare and add buttons
			text(btnCollection.appendChild(document.createElement("button")), "Edit");
			text(btnCollection.appendChild(document.createElement("button")), "Delete");

			// prepare and add dropdown image
			btnCollection.appendChild(getDropDownElm());

			li.appendChild(btnCollection).classList.add("buttons");

			// always append divLong after btnCollection
			li.appendChild(divLong).classList.add("long");

			// Time stamp
			created_on = document.createElement("div");

			// set text to snip's timestamp
			text(created_on, "Created on " + snip.timestamp);
			li.appendChild(created_on).classList.add("timestamp");

			// now append our constructed li into ul
			ul.appendChild(li).classList.add("snip");

			if(snip.name === sval_to_show)
				li.classList.add("shown");
		}

		snipsDiv.appendChild(ul);
	}

	// replaces string's `<` with `&gt' or reverse; sop to render html as text and not html
	// in snip names and bodies
	function formatHTML(string, mode){
		// gt-to-> = makeHTML

		if(mode == "makeHTML"){
			return string.replace(/&gt;/g, ">").replace(/&lt;/g, "<");
		}else{
			return string.replace(/>/g, "&gt;").replace(/</g, "&lt;");
		}
	}

	// called on "Edit" button click
	function editOnClick(){
		var parent = this.parentNode,
			divShort = parent.previousSibling,
			divLong = parent.nextSibling;

		text(this, "Done");

		var cancel = document.createElement("button");
		text(cancel, "Cancel");

		// remove down arrow img
		parent.removeChild(parent.querySelector(".dropdown"));
		// remove delete button
		parent.removeChild(this.nextElementSibling);

		this.insertAfter(cancel);

		// replace div with textarea and insert in latter the full text fro div's dataset
		var textareaS = divShort.replaceWith("input", "editSnName", undefined, divShort.dataset.full);
		var textareaL = divLong.replaceWith("textarea", "editSnBody", undefined, divLong.dataset.full);

		// set their common properties
		setEditTextareaProps.call(textareaS);
		setEditTextareaProps.call(textareaL);

		textareaS.onkeyup = function(){
			counterChecker.call(this, SNIP_NAME_LIMIT);
		};

		textareaL.onkeyup = function(){
			counterChecker.call(this, SNIP_BODY_LIMIT);
		};

		// call counter checker
		textareaS.onkeyup();
		textareaL.onkeyup();

		textareaS.focus();
	}

	// sets textarea properties
	function setEditTextareaProps(){
		// store previous value
		this.dataset.oldText = this.value;

		var pCounter = document.createElement("p");

		this.insertAfter(pCounter);
	}

	// called on "Done" button click; after "Edit"
	function doneOnClick(){
		// will have to send the new details to popup.js
		// and also the name of the old snip to delete

		var btns = this.parentNode,
			divS = btns.previousElementSibling.previousElementSibling,
			divL = btns.nextElementSibling,
			sVal = text(divS),
			lVal = text(divL),
			oldSVal = divS.dataset.oldText,
			vldS = validateSVal(sVal, sVal.length),
			vldL = validateLVal(lVal.length);

		// user doesn't change sVal but error got #workaround
		if(vldS === "A snippet with name '" + sVal + "' already exists" &&
				sVal === oldSVal)
			vldS = true;

		// validation passed
		if(vldS === true && vldL === true){
			// do not do if(validationS) as then 
			// strings would be considered true

			// set new snippet replacing old snippet
			setDataSnippet(sVal, lVal, oldSVal);

			// save this in Database
			DB_save(function(){
				// list only if no search mode
				if(!searchMode)
					// the data is saved; now list the items in popup.html
					// while showing only the recently saved one
					listSnippets(Data.snippets, sVal);
				else {// invoke the onkeyup of search box to list snippets again
					var elm = document.querySelector("input[title='Search']");
					elm.onkeyup({});
				}

				notifySnippetDataChanges();

				checkRuntimeError();
			});
		}else{
			// disable the outlines
			divS.style.outline = "none";
			divL.style.outline = "none";

			showErrors(divS, divL, vldS, vldL);
		}
	}

	// used to show dialog div.message
	function showDialog(){
		dlog.classList.add("shown");
		dlog.classList.remove("hidden");
		dlog.style.top = "150px";
		document.body.classList.add("darkened");
		dialogPoppedUp = true;
	}

	function removeDialog(){
		dlog.classList.remove("shown");
		dlog.classList.add("hidden");
		dlog.style.top = "";
		document.body.classList.remove("darkened");
		dialogPoppedUp = false;
	}

	// called on "Delete" button click
	function deleteOnClick(){
		var btns = this.parentNode,
				divShort = btns.previousElementSibling;

		if(divShort.tagName === "P" || divShort.tagName === "TEXTAREA"){
			showDialog();
			text(dlog, "You are in edit mode. Please click \"Cancel\" button and try again.<br>");
			var btn = document.createElement("button");
			btn.onclick = removeDialog;
			text(btn, "Ok");
			dlog.appendChild(btn);
			return;
		}

		// this is when "Delete" was pressed once
		if(!dialogPoppedUp){
			showDialog();
			text(dlog, "Delete '" + text(divShort) + "'?<br>");

			var deleteBtn = document.createElement("button");
			deleteBtn.onclick = function(){
				deleteOnClick.call(this);
				removeDialog();
			}.bind(this);
			deleteBtn.tabIndex = 1;
			text(deleteBtn, "Delete");

			var cancelBtn = document.createElement("button");
			cancelBtn.onclick = removeDialog;
			text(cancelBtn, "Cancel");
			cancelBtn.tabIndex = 2;

			dlog.appendChild(deleteBtn);
			dlog.appendChild(cancelBtn);

			deleteBtn.focus();
		}
		// this is for that "Delete" inside dialog popup
		else{
			var sVal = (divShort.dataset && divShort.dataset.full) || text(divShort);

			// SNIP REMOVAL START

			// get snip index
			var snip = searchSnippets(sVal, false, "index");

			// the index
			var index = snip[1];

			// remove the snip
			Data.snippets.splice(index, 1);

			// save these changes in Database
			DB_save(function(){
				// the data is saved; now list the items in popup.html
				if(!searchMode) // list only if no search taking place
					listSnippets(Data.snippets);

				notifySnippetDataChanges();

				checkRuntimeError();
			});

			// SNIP REMOVAL END

			var parentLI = btns.parentNode;
			var snips = parentLI.parentNode;
			snips.removeChild(parentLI);
		}
	}

	// called on "Cancel" button click (after "Edit" button)
	function cancelOnClick(){
		var parent = this.parentNode,
			textaS = parent.previousElementSibling.previousElementSibling,
			textaL = parent.nextElementSibling,
			parentLI = parent.parentNode;

		// temp vars used on line 316, 317
		var old1 = textaS.dataset.oldText;
		var old2 = textaL.dataset.oldText;

		parentLI.removeChild(textaS.nextElementSibling);
		parentLI.removeChild(textaL.nextElementSibling);

		// replace with div.(short/long) by replacing the original text
		setTextareaText.call(textaS.replaceWith("div", "short"), old1);
		setTextareaText.call(textaL.replaceWith("div", "long"), old2);

		// remove `height` to get back min-height and max-height in action
		parentLI.style.height = "";

		// show .snip .long if not shown
		if(!parentLI.hasClass("shown"))
			parentLI.classList.add("shown");

		/*
			Current .buttons:
			[Done] [Cancel]
		*/

		// remove the "Done" button
		parent.removeChild(this.previousElementSibling);

		/*
			Current .buttons:
			[Cancel]
		*/

		// replace "Cancel" with "Edit" button
		this.replaceWith("button", undefined, undefined, "Edit");
		// add delete button
		var btn = document.createElement("button");
		text(btn, "Delete");
		parent.appendChild(btn);
		// add dropdown button
		parent.appendChild(getDropDownElm());

		/*
			Final .buttons:
			[Edit] [Delete] [.dropdown]
		*/
	}

	function onDropDownClick(){
		var snip = this.parentNode.parentNode;

		// shown currently, hide it!
		if(snip.hasClass("shown")){
			snip.classList.remove("shown");
			this.setAttribute("title", "Click to show the full snippet");
			this.setAttribute("alt", "Click to show the full snippet");
		}
		// not shown? show it!
		else{
			snip.classList.add("shown");
			this.setAttribute("title", "Click to hide the snippet");
			this.setAttribute("alt", "Click to hide the snippet");
		}
	}

	function showErrors(sValNode, lValNode, sValidation, lValidation){
		function passOrFailNode(pass, node, name){
			if(pass === true){
				node.style.border = "2px solid rgb(94, 224, 94)";
				counterChecker.call(node, name === "n" ? SNIP_NAME_LIMIT : SNIP_BODY_LIMIT);
			}else{
				text(node.nextElementSibling, pass);
				node.style.border = "2px solid rgb(245, 79, 79)";
				node.nextElementSibling.classList.add("red");
			}
		}

		passOrFailNode(sValidation, sValNode, "n");
		passOrFailNode(lValidation, lValNode, "b");
	}

	// updates the storage header in #headArea
	// "You have x bytes left out of y bytes"
	function updateStorageAmount(){
		storage.getBytesInUse(function(bytesInUse){
			// set current bytes
			document.querySelector("#headArea .currentBytes").innerHTML = bytesInUse;
			
			// set number of snippets written
			document.querySelector("#headArea .snippet_amount").innerHTML = Data.snippets.length;
			
			// set total bytes available
			document.querySelector("#headArea .bytesAvailable").innerHTML = 
									storage.MAX_ITEMS ? /*sync*/ "102,400" : "5,242,880";
		});
	}

	function getPageZoom(){
		//RETURN: 1.0 for 100%, and so on
		var zoom = 1;

		try{
			var svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
			svg.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
			svg.setAttribute('version', '1.1');
			document.body.appendChild(svg);
			zoom = svg.currentScale;
			document.body.removeChild(svg);
		}
		catch(e){
			console.error("Zoom method failed: " + e.message);
		}

		return zoom;
	}

	//////////////////////////////
	// Element.prototype functions
	//////////////////////////////

	// decides whether to use ".innerHTML" or ".value" and gets/sets text.
	function text(node, newVal){
		var name = node.tagName;

		if(name === "TEXTAREA" || name === "INPUT")
			return newVal !== undefined ? (node.value = newVal) : node.value;
		else if(newVal !== undefined)
			node.innerHTML =
				newVal.replace(/ {2}/g, " &nbsp;").replace(/\n/g, "<br>");
		else
			return node.innerHTML
				.replace(/&nbsp;/g, " ").replace(/<br>/g, "\n");
	}

	// replaces `this` with `newElm`; `newElm` is a string; returns new element
	Element.prototype.replaceWith = function(newElm, newClass, id, textToReplace){
		// string newClass, id, textToReplace (optional: to dictate which text should be in replaced element)
		// string event containing innerHTML of element

		var parent = this.parentNode,
			// new element ready
			newElement = document.createElement(newElm);

		if(newClass){
			newClass = newClass.split(" ");
			for(var i = 0; newClass[i]; i++)
				newElement.classList.add(newClass[i]);
		}

		if(id) newElement.id = id;

		var mode = newElement.isTextBox() ? "makeHTML" : "makeEntity";

		// if should `replaceText`, get text from old and set it in new; always `formatHTML`
		if(textToReplace)
			text(newElement, formatHTML(textToReplace, mode));
		else 
			text(newElement, formatHTML(text(this), mode));

		// perform replace function
		parent.replaceChild(newElement, this);

		// return original element
		return newElement;
	};
	
	Element.prototype.isTextBox = function(){
		return this.tagName === "INPUT" || this.tagName === "TEXTAREA";
	};

	// returns true if element has class; usage: Element.hasClass("class")
	Element.prototype.hasClass = function(className) {
		return this.className && new RegExp("(^|\\s)" + className + "(\\s|$)").test(this.className);
	};

	// vanilla JS equivalent of jQuery $.offset()
	Element.prototype.offset = function () {
		var rect = this.getBoundingClientRect();

		return {
			top: rect.top + document.body.scrollTop,
			left: rect.left + document.body.scrollLeft
		};
	};

	// inserts the newNode after `this`
	Element.prototype.insertAfter = function(newNode){
		this.parentNode.insertBefore(newNode, this.nextSibling);
	};

	function resetBox(box, name){
		// reset border, outline and dataset, height
		box.style.outline = "initial";
		box.style.border = "1px solid rgb(169, 169, 169)";
		box.dataset.message = undefined;
		box.style.height = "";

		// reset `p` element text
		text(box.nextElementSibling, name === "long" ? 
									SNIP_BODY_LIMIT + " characters left" :
									SNIP_NAME_LIMIT + " characters left");

		// removes classes like "charCountRed", or "charCountYellow"
		box.nextElementSibling.className = "";

		// reset text
		text(box, "");

		// reset the elongated height of the textbox
		box.classList.remove("active");
	}

	// checks the character length of textboxes; assumes
	// there is a `p` element following them which shows
	// the count
	function counterChecker(limit){
		// now update counter
		var currLength = text(this).length,
			diff = Math.abs(currLength - limit),
			nextSibling = this.nextElementSibling;

		// if length exceeds limit
		if(currLength > limit){
			text(nextSibling, "Too long by " + diff + " characters");
			nextSibling.classList.add("red");
		}else{
			text(nextSibling, diff + " characters left");
			nextSibling.classList.remove("red");
		}
	}

	// changes type of storage: local-sync, sync-local
	function changeType(){
		// property MAX_ITEMS is present only in sync

		storage = !!storage.MAX_ITEMS ? chrome.storage.local : chrome.storage.sync;
	}

	// first load DB and set DB_loaded to true
	DB_load(function(){ // asynchronous; use callback for post-load operations
		// wrong storage mode
		if(Data.snippets === false){
			// get data from popup
			// change storage to other type
			changeType();
			
			DB_load(function(){
				DB_loaded = true;
			});
		}else		
			DB_loaded = true;
	});

	////////////////////////////////////
	// Main init function called on load
	/////////////////////////////////////

    function init() {
		if(!DB_loaded) {
			setTimeout(init, 1000);
			return true;
		}

		// needs to be global
		dlog = document.querySelector(".message");

		// define element variables
		var searchButton = document.querySelector(".button[title='Search for snippets']"),
			searchField = document.querySelector("input[aria-label='Search']"),
			createSnipButton = document.querySelector('.button[aria-label="Create new Snippet"]'),
			optionsButton = document.querySelector('.button[title="Settings or Help"]'),
			// set to true if the .createSnipArea is flipped
			flipped_mode = false,
			snipSValBox = document.getElementById("sVal"),
			snipLValBox = document.getElementById("lVal"),
			backButton = document.querySelector(".createSnipArea .back"),
			doneButton = document.querySelector(".createSnipArea .done"),
			flipContainer = document.querySelector(".flip-container");

		document.querySelector("#headArea .bytesAvailable").onclick = function(){
			window.open("https://developer.chrome.com/extensions/storage#properties");
		};

		chrome.storage.onChanged.addListener(function(){
			updateStorageAmount();
		});

		window.onresize = function(){
			// zoom is in zoom% (100, 125, etc.)
			var zoom = getPageZoom() * 100,
				elm = document.documentElement;

			if(zoom >= 125){
				elm.className = "zoom125";
			}else if(zoom <= 75){
				elm.className = "zoom75";
			}else{
				elm.className = "";
			}
		};

		updateStorageAmount();

		// text box should auto resize on key up
		snipLValBox.onkeyup = function(){
			// now check char length
			counterChecker.call(snipLValBox, SNIP_BODY_LIMIT);
		};

		snipSValBox.onkeyup = function(){
			counterChecker.call(snipSValBox, SNIP_NAME_LIMIT);
		};

		optionsButton.onclick = function(){
			window.open("options.html");
		};

		backButton.onclick = function(){
			resetBox(snipLValBox, "long", true);
			resetBox(snipSValBox, "short", true);

			// flip back to the home page
			flipContainer.classList.remove("flipped");
			flipped_mode = false;
			// set tabIndices
			snipSValBox.tabIndex = -1;
			snipLValBox.tabIndex = -1;
			doneButton.tabIndex  = -1;
			backButton.tabIndex  = -1;

			return false;
		};

		// create snip area
		doneButton.onclick = function(){
			var sVal = text(snipSValBox),
				lVal = text(snipLValBox),
				vldS = validateSVal(sVal, sVal.length),
				vldL = validateLVal(lVal.length);

			// disable the outlines
			snipSValBox.style.outline = "none";
			snipLValBox.style.outline = "none";

			// both inputs correct
			if(vldS === true && vldL === true){
				// store snippets
				setDataSnippet(sVal, lVal);

				// save data
				DB_save(function(){
					// the data is saved; now list the items in popup.html
					listSnippets(Data.snippets);

					// notify all content scripts about the change
					notifySnippetDataChanges();

					checkRuntimeError();
				});

				// reset boxes to remove the green/red formatting
				// and text that user entered
				resetBox(snipLValBox, "long", true);
				resetBox(snipSValBox, "short", true);

				// flip back to the home page
				flipContainer.classList.remove("flipped");
				flipped_mode = false;
				// set tabIndices
				snipSValBox.tabIndex = -1;
				snipLValBox.tabIndex = -1;
				doneButton.tabIndex  = -1;
				backButton.tabIndex  = -1;

				return false;
			}

			showErrors(snipSValBox, snipLValBox, vldS, vldL);
		};

		searchButton.onclick = function(){
			if(text(this) === "Search for snips"){
				// button
				this.classList.add("shortened");
				text(this, "Done");
				this.setAttribute("title", "Click when done searching.");

				searchField.classList.add("shown");
				createSnipButton.classList.add("hidden");
				optionsButton.classList.add("hidden");

				// 1000 => after animation finishes; focus searchField
				setTimeout(function(){
					searchField.focus();
				}, 1000);

				searchMode = true;
			}else{
				searchButton.classList.remove("shortened");
				searchButton
					.setAttribute("title", "Search for snippets");

				searchField.classList.remove("shown");
				createSnipButton.classList.remove("hidden");
				optionsButton.classList.remove("hidden");

				text(searchButton, "Search for snips");
				text(searchField, "");

				listSnippets(Data.snippets);

				searchMode = false;
			}
		};

		searchField.onkeyup = function(){
			var searchText = text(this),
				textLen = searchText.length,
				snips = document.getElementById("snips"),
				p = snips.querySelector("#snips p"),
				snipsLen = Data.snippets.length,
				displayPara = document.createElement("p"),
				ul, msg; // green colored message

			displayPara.classList.add("display_msg_to_user");

			// if p then remove p as
			// p might the error message
			// shown to the user previously
			if(p && p.parentNode === snips) snips.removeChild(p);

			ul = snips.querySelector("#snips ul");

			// TODO: get rid of .parentNode?
			// if ul then remove ul
			// ul contains snippets
			if(ul && ul.parentNode === snips) snips.removeChild(ul);

			// if no more than 3 snippets
			// do not search
			if(snipsLen <= 3)
				msg =  "You must have at least 4 snippets<br>for the search to\
					function.<br>Currently, you have " + snipsLen + " snippet" + (snipsLen>1?"s.":".");
			// at least 3 characters should be there
			else if(textLen >= 3){
				var result = searchSnippets(searchText, searchText);
				result = Object.prototype.toString.call(result) === "[object Object]" ? [result] : result;

				// nothing in result array; means nothing was found
				if( !(result[0]) )
					msg = "No snippet found.<br>Please rephrase your search query.";
				else
					// at least one snippet is there
					listSnippets(result);
			}else // less than 3 characters are there
				msg = "Need to type " + (3 - textLen) + (" more character" +
												((3 - textLen !== 1) ? "s." : "."));


			if(typeof msg === "string"){
				text(displayPara, msg);
				snips.appendChild(displayPara);
			}
		};

		createSnipButton.onclick = function(){
			// work only if the #snips is not already flipped
			if(!flipped_mode){
				flipped_mode = true;

				// add flipped class
				flipContainer.classList.add("flipped");

				snipSValBox.classList.add("active");
				snipLValBox.classList.add("active");

				// set tabIndices
				snipSValBox.tabIndex = 1;
				snipLValBox.tabIndex = 3;
				doneButton.tabIndex  = 5;
				backButton.tabIndex  = 7;

				snipSValBox.style.border = "";
				snipLValBox.style.border = "";

				// focus the #sVal input, so user can start typing
				snipSValBox.focus();
			}
		};

		// list the existing data;
		// as extension is called for first time;
		listSnippets(Data.snippets);

		// use event delegation for edit, delete, etc. buttons
		// since they are dynamically added
		document.onclick = function(){
			var node = event.target;

			// check to make sure node is a ".buttons > button"
			// in #snips li.snip
			if(node.parentNode && node.parentNode.hasClass &&
				node.parentNode.hasClass("buttons")){
				var textNode = text(node);

				var func = 
				// "Edit" button
				textNode === "Edit" ? editOnClick :
				// "Done" button
				textNode === "Done" ? doneOnClick :
				// "Delete" button
				textNode === "Delete" ? deleteOnClick :
				// "Cancel" button 
				textNode === "Cancel" ? cancelOnClick :
				// or nothing
				undefined;

				if(func) func.call(node);
			}
		};

        if (!chrome.runtime) {
            // Chrome 20-21
            chrome.runtime = chrome.extension;
        } else if (!chrome.runtime.onMessage) {
            // Chrome 22-25
            chrome.runtime.onMessage = chrome.extension.onMessage;
            chrome.runtime.sendMessage = chrome.extension.sendMessage;
            chrome.runtime.onConnect = chrome.extension.onConnect;
            chrome.runtime.connect = chrome.extension.connect;
        }
   
		// now check if the user is first time user; get that data
		function check(){
			// if DB not loaded
			if(!DB_loaded){
				// check again after 500ms
				setTimeout(check, 500);
				return;
			}else if(!Data.visited){ // first time user
				// "Got it" button
				var button = document.querySelector(".new_user_msg button");
				button.parentNode.style.display = "block";

				// if the user clicks the button; he's no more a first time user
				button.onclick = function(){
					Data.visited = true;
					DB_save(function(){
						this.parentNode.style.display = "none";
					}.bind(this));
				};

				if(Data.snippets.length >= 5) return;

				// create introductory snippets
				var a = {
					name: "sample_snippet_read_me",
					body: "Hello new user!\n\nThis is a sample snippet. A snippet can be activated by typing the snippet name (abbreviation) on any website's textbox and pressing Shift+Space.\n\nThis bit (%abcd%) is a placeholder. It will be auto-highlighted once you activate the snippet. It's useful when you want to insert fields like %first_name% or %email% in your snippet. Use [Tab] to go through each placeholder.\nBe sure to check out the settings page. Press 'Create new Snip' button to create a new snippet.\n\n\nContact me prokeys.feedback@gmail.com for any feedback! Thank you for using ProKeys!",
					timestamp: "June 26, 2014"
				}, b = {
					name: "placeholder_guide",
					body: "When you use this snippet, %this_text% will be highlighted. Press [Tab] and then %this_text% will be highlighted. Press [Tab] again to highlight %me%.\nThis is useful for fields like %first_name% in snippets.",
					timestamp: "June 26, 2014"
				}, c = {
					name: "brb",
					body: "be right back",
					timestamp: "June 26, 2014"
				}, d = {
					name: "my_sign",
					body: "<b>Gaurang Tandon</b>\n<i>Creator Of ProKeys</i>\n<u>prokeys.feedback@gmail.com</u>",
					timestamp: "June 26, 2014"
				}, e = {
					name: "date_time_macros_sample",
					body: "First of all use this snippet in a website and notice the output of the following line:\n[[%d(hh:m:s h+h Do-MMMM-YYYY D-MMM date time dddd ddd a)]]\n\nAs you could see, these symbols are replaced by their current date and time related data. More info about them is in Help section.",
					timestamp: "March 05, 2015"
				};

				Data.snippets.push(a, b, c, d, e);

				DB_save(function(){
					listSnippets();
				});
			}
		}

		check();

		DB_save(function(){
			chrome.runtime.sendMessage("inject");
		});
	}
})();
