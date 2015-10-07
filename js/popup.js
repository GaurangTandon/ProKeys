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
			setText(dlog, "An error occurred! Please right-click on the \"Ok\" button below, select \"Inspect Element\" from the context menu, copy whatever is shown in the 'Console' tab and report it at my email: prokeys.feedback@gmail.com . This will help me improve my extension and resolve your issue. Thanks!");
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
				// get first snippet li
				// add highlighting class to it, which induces -webkit-animation
				$("#snips ul li")[0].toggleClass("highlighting");
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
		if([][sVal])
			return "Invalid snippet name! Please prefix it with a underscore and try again. For details please visit Help page";

		// A unique snippet with that name exists
		if(Object.prototype.toString.call(searchSnippets(sVal)) === "[object Object]")
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

		setText(this, formatHTML(string, mode));

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
		img.src = "../imgs/d.gif";
		img.setAttribute("alt", "Click to see the full snippet");
		img.setAttribute("title", "Click to see the full snippet");
		img.toggleClass("dropdown");
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
			div = $("#snips");

			div.innerHTML = "<p class='display_msg_to_user'>You currently have no snippets.<br>Why not <a class='trigger_create_new'>create a new snippet?</a></p>";

			$(".trigger_create_new").onclick = function(){
				$(".button.createSnipBtn").onclick();
			};

			return;
		}

		snip_array = !searchMode ? Data.snippets : snip_array;

		// in the `ul`; we will place snips as `li` elements
		snipsDiv = $("#snips");

		setText(snipsDiv, "");

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

			li.appendChild(divShort).toggleClass("short");

			// our `div` long element; with Snip body
			divLong = document.createElement("div");
			setTextareaText.call(divLong, snip.body);
			// appended after btnCollection

			// creating our collection of buttons
			btnCollection = document.createElement("div");

			// prepare and add buttons
			setText(btnCollection.appendChild(document.createElement("button")), "Edit");
			setText(btnCollection.appendChild(document.createElement("button")), "Delete");

			// prepare and add dropdown image
			btnCollection.appendChild(getDropDownElm());

			li.appendChild(btnCollection).toggleClass("buttons");

			// always append divLong after btnCollection
			li.appendChild(divLong).toggleClass("long");

			// Time stamp
			created_on = document.createElement("div");

			// set text to snip's timestamp
			setText(created_on, "Created on " + snip.timestamp);
			li.appendChild(created_on).toggleClass("timestamp");

			// now append our constructed li into ul
			ul.appendChild(li).toggleClass("snip");

			if(snip.name === sval_to_show)
				li.toggleClass("shown");
		}

		snipsDiv.appendChild(ul);
	}

	// called on "Edit" button click
	function editOnClick(){
		var parent = this.parentNode,
			divShort = parent.previousSibling,
			divLong = parent.nextSibling;

		setText(this, "Done");

		var cancel = document.createElement("button");
		setText(cancel, "Cancel");

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
			sVal = getText(divS),
			lVal = getText(divL),
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
					var elm = $("input[title='Search']");
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
		dlog.toggleClass("shown");
		dlog.toggleClass("hidden");
		dlog.style.top = "150px";
		document.body.toggleClass("darkened");
		dialogPoppedUp = true;
	}

	function removeDialog(){
		dlog.toggleClass("shown");
		dlog.toggleClass("hidden");
		dlog.style.top = "";
		document.body.toggleClass("darkened");
		dialogPoppedUp = false;
	}

	// called on "Delete" button click
	function deleteOnClick(){
		var btns = this.parentNode,
			divShort = btns.previousElementSibling;

		if(divShort.tagName === "P" || divShort.tagName === "TEXTAREA"){
			showDialog();
			setText(dlog, "You are in edit mode. Please click \"Cancel\" button and try again.<br>");
			var btn = document.createElement("button");
			btn.onclick = removeDialog;
			setText(btn, "Ok");
			dlog.appendChild(btn);
			return;
		}

		// this is when "Delete" was pressed once
		if(!dialogPoppedUp){
			showDialog();
			setText(dlog, "Delete '" + getText(divShort) + "'?<br>");

			var deleteBtn = document.createElement("button");
			deleteBtn.onclick = function(){
				deleteOnClick.call(this);
				removeDialog();
			}.bind(this);
			deleteBtn.tabIndex = 1;
			setText(deleteBtn, "Delete");

			var cancelBtn = document.createElement("button");
			cancelBtn.onclick = removeDialog;
			setText(cancelBtn, "Cancel");
			cancelBtn.tabIndex = 2;

			dlog.appendChild(deleteBtn);
			dlog.appendChild(cancelBtn);

			deleteBtn.focus();
		}
		// this is for that "Delete" inside dialog popup
		else{
			var sVal = (divShort.dataset && divShort.dataset.full) || getText(divShort);

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
			parentLI.toggleClass("shown");

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
		setText(btn, "Delete");
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
			snip.toggleClass("shown");
			this.setAttribute("title", "Click to show the full snippet");
			this.setAttribute("alt", "Click to show the full snippet");
		}
		// not shown? show it!
		else{
			snip.toggleClass("shown");
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
				setText(node.nextElementSibling, pass);
				node.style.border = "2px solid rgb(245, 79, 79)";
				node.nextElementSibling.toggleClass("red");
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
			$("#headArea .currentBytes").innerHTML = bytesInUse;
			
			// set number of snippets written
			$("#headArea .snippet_amount").innerHTML = Data.snippets.length;
			
			// set total bytes available
			$("#headArea .bytesAvailable").innerHTML = 
									storage.MAX_ITEMS ? /*sync*/ "102,400" : "5,242,880";
		});
	}

	function getPageZoom(){
		//RETURN: 1.0 for 100%, and so on
		var zoom = 1;

		try{
			var svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
			svg.setAttribute("xmlns", "http://www.w3.org/2000/svg");
			svg.setAttribute("version", "1.1");
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

	function resetBox(box, isLong){
		// reset border, outline and dataset, height
		box.style.outline = "initial";
		box.style.border = "1px solid rgb(169, 169, 169)";
		box.dataset.message = undefined;
		box.style.height = "";

		var nES = box.nextElementSibling;
		
		// reset `p` element text
		setText(nES, (isLong ? SNIP_BODY_LIMIT : SNIP_NAME_LIMIT) +
									" characters left");

		// removes the "red" class if present
		nES.className = "";

		// reset text
		setText(box, "");

		// reset the elongated height of the textbox
		box.toggleClass("active");
	}

	// checks the character length of textboxes; assumes
	// there is a `p` element following them which shows
	// the count
	function counterChecker(limit){
		// now update counter
		var currLength = getText(this).length,
			diff = Math.abs(currLength - limit),
			nextSibling = this.nextElementSibling;
		
		// if currLength exceeds limit
		var bool = currLength > limit;
		
		setText(nextSibling, bool ? "Too long by " + diff + " characters" : diff + " characters left");
		nextSibling.classList[bool ? "add" : "remove"]("red");
	}

	// changes type of storage: local-sync, sync-local
	function changeType(){
		// property MAX_ITEMS is present only in sync
		storage = storage.MAX_ITEMS ? chrome.storage.local : chrome.storage.sync;
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
		dlog = $(".message");

			// define element variables
		var searchButton = $(".searchSnipBtn"),
				searchField = $(".searchField"),
				createSnipButton = $(".createSnipBtn"),
				optionsButton = $(".settingsBtn"),
				// set to true if the .createSnipArea is flipped
				flipped_mode = false,
				snipSValBox = $("#sVal"),
				snipLValBox = $("#lVal"),
				backButton = $(".createSnipArea .back"),
				doneButton = $(".createSnipArea .done"),
				flipContainer = $(".flip-container");

		$("#headArea .bytesAvailable").on("click", function(){
				window.open("https://developer.chrome.com/extensions/storage#properties");
			});

		chrome.storage.onChanged.addListener(function(){
				updateStorageAmount();
			});

		window.on("resize", function(){
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
			});

		updateStorageAmount();

		function addListener(box, lim){
				box.on("keyup", function(){
					counterChecker.call(box, lim);
				});
			}
			
		addListener(snipLValBox, SNIP_BODY_LIMIT);
		addListener(snipSValBox, SNIP_NAME_LIMIT);

		optionsButton.on("click", function(){
				window.open("options.html");
			});

		backButton.on("click", function(){
				resetBox(snipLValBox, true);
				resetBox(snipSValBox, false);

				// flip back to the home page
				flipContainer.toggleClass("flipped");
				flipped_mode = false;
				// set tabIndices
				snipSValBox.tabIndex = -1;
				snipLValBox.tabIndex = -1;
				doneButton.tabIndex  = -1;
				backButton.tabIndex  = -1;

				return false;
			});

<<<<<<< HEAD
			// create snip area
		doneButton.on("click", function(){
				var sVal = getText(snipSValBox),
					lVal = getText(snipLValBox),
					vldS = validateSVal(sVal, sVal.length),
					vldL = validateLVal(lVal.length);
=======
			showErrors(snipSValBox, snipLValBox, vldS, vldL);
		});
		
		function searchButtonClick(title, textToSet, searchModeBool){
			var s = "shown", h = "hidden";
			
			this.toggleClass("shortened");
			text(this, textToSet);
			this.setAttribute("title", title);
>>>>>>> origin/master

				// disable the outlines
				snipSValBox.style.outline = "none";
				snipLValBox.style.outline = "none";

				// both inputs correct
				if(vldS === true && vldL === true){
					// store snippets
					setDataSnippet(sVal, lVal);

<<<<<<< HEAD
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
					resetBox(snipLValBox, true);
					resetBox(snipSValBox, false);

					// flip back to the home page
					flipContainer.toggleClass("flipped");
					flipped_mode = false;
					// set tabIndices
					snipSValBox.tabIndex = -1;
					snipLValBox.tabIndex = -1;
					doneButton.tabIndex  = -1;
					backButton.tabIndex  = -1;

					return false;
				}
=======
		searchButton.on("click", function(){			
			if(!this.hasClass("shortened")){
				searchButtonClick.call(this, "Click when done searching", "Done", true);
>>>>>>> origin/master

				showErrors(snipSValBox, snipLValBox, vldS, vldL);
			});
			
		function searchButtonClick(title, textToSet, searchModeBool){
				var s = "shown", h = "hidden";
				
				this.toggleClass("shortened");
				setText(this, textToSet);
				this.setAttribute("title", title);

				searchField.toggleClass(s);
				createSnipButton.toggleClass(h);
				optionsButton.toggleClass(h);

				searchMode = searchModeBool;
			}

		searchButton.on("click", function(){			
				if(!this.hasClass("shortened")){
					searchButtonClick.call(this, "Click when done searching", "Done", true);

					// 1000 => after animation finishes; focus searchField
					setTimeout(function(){
						searchField.focus();
					}, 1000);
				}else{
					searchButtonClick.call(this, "Search for snips", "Search for snips", false);
					setText(searchField, "");
					listSnippets(Data.snippets);
				}
			});

		searchField.on("keyup", function(){
				var searchText = getText(this),
					textLen = searchText.length,
					snips = $("#snips"),
					p = snips.querySelector("#snips p"),
					snipsLen = Data.snippets.length,
					displayPara = document.createElement("p"),
					ul, msg; // green colored message

				displayPara.toggleClass("display_msg_to_user");

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
					setText(displayPara, msg);
					snips.appendChild(displayPara);
				}
			});

		createSnipButton.onclick = function(){
				// work only if the #snips is not already flipped
				if(!flipped_mode){
					flipped_mode = true;

					// add flipped class
					flipContainer.toggleClass("flipped");

					snipSValBox.toggleClass("active");
					snipLValBox.toggleClass("active");

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
		document.on("click", function(){
				var node = event.target, func,
					funcMap = {
						"Edit" : editOnClick,
						"Delete": deleteOnClick,
						"Done": doneOnClick,
						"Cancel": cancelOnClick
					};

				// check to make sure node is a ".buttons > button"
				// in #snips li.snip
				if(node.parentNode && node.parentNode.hasClass &&
					node.parentNode.hasClass("buttons")){				
					func = funcMap[getText(node)];

					if(func) func.call(node);
				}
			});

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
				if(!Data.visited){ // first time user
					// "Got it" button
					var button = $(".new_user_msg button");
					button.parentNode.style.display = "block";

					// if the user clicks the button; he's no more a first time user
					button.onclick = function(){
						Data.visited = true;
						DB_save(function(){
							this.parentNode.style.display = "none";
							$("#headArea button:first-child").toggleClass("firstInstall");
						}.bind(this));
					};

					if(Data.snippets.length >= 5) return;

					// create introductory snippets
					var a = {
							name: "sampleSnippet",
							body: "Hello new user! Thank you for using ProKeys!\n\nThis is a sample snippet. Try using it on any webpage by typing 'sampleSnippet' (snippet name; without quotes), and press the hotkey (default: Shift+Space), and this whole text would come in place of it.",
							timestamp: "July 05, 2015"
						}, b = {
						name: "letter",
						body: "(Sample snippet to demonstrate the power of ProKeys snippets; for more detail on Placeholders, see the Help section)\n\nHello %name%,\n\nYour complaint number %complaint% has been noted. We will work at out best pace to get this issue solved for you. If you experience any more problems, please feel free to contact at me@organization.com.\n\nRegards,\n%my_name%,\nDate: [[%d(D-MM-YYYY)]]",
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
						name: "dateArithmetic",
						body: "Use this snippet in any webpage, and you'll see that the following: [[%d(Do MMMM YYYY hh:m:s)]] is replaced by the current date and time.\n\nMoreover, you can perform date/time arithmetic. The following: [[%d(D+5 MMMM+5 YYYY+5 hh-5 m-5 s-5)]] gives the date, month, year, forward by five; and hour, minutes, and seconds backward by 5.\n\nMore info on this in the Help section.",
						timestamp: "March 05, 2015"
					};

					Data.snippets.push(a, b, c, d, e);
					
					$("#headArea button:first-child").toggleClass("firstInstall");
					
					DB_save(function(){
						listSnippets();
					});
				}
			}

		check();
	}
})();