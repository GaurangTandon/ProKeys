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
		// dialog is the div.dlog
		dialogPoppedUp = false,
		dlog,
		btnFuncMap = {
			"Edit" : editOnClick,
			"Delete": deleteOnClick,
			"Save": saveOnClick,
			"Cancel": cancelOnClick
		};

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

	function checkRuntimeError(){
		if(chrome.runtime.lastError){
			console.log(chrome.runtime.lastError);
			showDialog();
			dlog.html("An error occurred! Please right-click on the \"Ok\" button below, select \"Inspect Element\" from the context menu, copy whatever is shown in the 'Console' tab and report it at my email: prokeys.feedback@gmail.com . This will help me improve my extension and resolve your issue. Thanks!");
			
			var btn = document.createElement("button");
			btn.html("Ok")
				.on("click", removeDialog);
				
			dlog.appendChild(btn);			
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
			return "Length of snip body cannot exceed " + SNIP_BODY_LIMIT+ " (" + (len - SNIP_BODY_LIMIT) + " excess characters present)";

		if(len === 0) return "Empty snippet body field";

		return true;
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
		var img = document.createElement("img"),
			msg = "Click to see the full snippet";
			
		img.src = "../imgs/d.gif";
		img.setAttribute("alt", msg);
		img.setAttribute("title", msg);
		img.addClass("dropdown").on("click", onDropDownClick);

		return img;
	}

	// receives array of snippet objects, and lists them in popup.html > div#snips
	function listSnippets(snip_array, sValToShow) {
		// note that snip_array can be actual Data.snippets
		// or smaller array from searchMode

		var snipsDiv, ul, snip, li,
			divShort, divLong, btnCollection, created_on;

		if(!DB_loaded){ // no data
			// try after 500ms
			setTimeout(listSnippets, 250, Data.snippets);
			return;
		}
		// user does not have any snips
		else if(!Data.snippets[0]){
			$("#snips").html("<p class='display_msg_to_user'>You currently have no snippets.<br>Why not <a class='trigger_create_new'>create a new snippet?</a></p>");
			
			$(".trigger_create_new").on("click", function(){
				$(".button.createSnipBtn").trigger("click");
			});
			
			return;
		}

		snip_array = searchMode ? snip_array : Data.snippets;

		// in the `ul`; we will place snips as `li` elements
		snipsDiv = $("#snips");

		snipsDiv.html("");

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
			setTextForNode(divShort, snip.name);

			li.appendChild(divShort.addClass("short"));

			// our `div` long element; with Snip body
			divLong = document.createElement("div");
			setTextForNode(divLong, snip.body);
			// appended after btnCollection

			// creating our collection of buttons
			btnCollection = document.createElement("div");

			// prepare and add buttons
			transformButtonTo(btnCollection.appendChild(document.createElement("button")),
				"Edit");
			transformButtonTo(btnCollection.appendChild(document.createElement("button")),
				"Delete");

			// prepare and add dropdown image
			btnCollection.appendChild(getDropDownElm());

			li.appendChild(btnCollection.addClass("buttons"));

			// always append divLong after btnCollection
			li.appendChild(divLong.addClass("long"));

			// Time stamp
			created_on = document.createElement("div");

			// set text to snip's timestamp
			created_on.html("Created on " + snip.timestamp);
			li.appendChild(created_on.addClass("timestamp"));

			// now append our constructed li into ul
			ul.appendChild(li.addClass("snip"));

			if(snip.name === sValToShow){
				li.addClass("shown");
				
				// highlight snippet after 0.5 seconds
				// so that: 1) listSnippets is complete
				// 2) the newest snippet is listed at top
				setTimeout(function(){
					// highlight so the user may notice it #ux
					// add highlighting class, which induces -webkit-animation
					this.addClass("highlighting");
				}.bind(li), 500);
			}
		}

		snipsDiv.appendChild(ul);
	}

	function attachCounterChecker(node, limit){
		var p = document.createElement("P");
		
		node.on("keyup", function(){			
			var len = getHTML(node).length,
				diff = Math.abs(limit - len),			
				// if currLength exceeds limit
				bool = len > limit;
			
			p.html(bool ? "Too long by " + diff + " characters" : diff + " characters left")
				.classList[bool ? "add" : "remove"]("red");
		})
			.insertAfter(p)		
			// trigger once
			.trigger("keyup");
	}
	
	// Edit-> Save; Delete-> Cancel
	// and reverse button transformations
	function transformButtonTo(btn, newName){		
		btn.html(newName).on("click", btnFuncMap[newName]);		
	}
	
	// called on "Edit" button click
	function editOnClick(){
		function perform(node, name){
			var bool = name === "Name";
			
			node = node.replaceWith(bool ? "input" : "textarea", "editSn" + name);			
			
			node.dataset.previous = getHTML(node);			
			attachCounterChecker(node, snipLimits[name]);
			
			return node;
		}
		
		var parent = this.parentNode,
			// the name, body elements
			snipNameElm = parent.previousSibling,
			snipBodyElm = parent.nextSibling;

		// remove down arrow img
		parent.removeChild(parent.querySelector(".dropdown"));

		// Edit -> Save
		transformButtonTo(this, "Save");
		// Delete -> Cancel
		transformButtonTo(this.nextElementSibling, "Cancel");
		
		perform(snipBodyElm, "Body");
		perform(snipNameElm, "Name").focus(); // focus the new textarea
	}

	function displayHighlightUsingVld(node, vld){		
		var p = node.nextElementSibling;
		
		// passed
		if(vld === true)
			node.addClass("passed");
		else{			
			node.addClass("failed");
			p.html(vld).addClass("red");
		}
	}
	
	// called on "Done" button click; after "Edit"
	function saveOnClick(){
		// will have to send the new details to popup.js
		// and also the name of the old snip to delete

		var btns = this.parentNode,
			snipNameElm = btns.previousElementSibling.previousElementSibling,
			snipBodyElm = btns.nextElementSibling,
			sVal = getHTML(snipNameElm),
			lVal = getHTML(snipBodyElm),
			oldSVal = snipNameElm.dataset.previous,
			vldS = validateSVal(sVal, sVal.length),
			vldL = validateLVal(lVal.length);

		// user doesn't change sVal but error got #workaround
		if(sVal === oldSVal) vldS = true;

		// validation passed
		if(vldS === true && vldL === true){
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
					elm.trigger("keyup");
				}

				notifySnippetDataChanges();

				checkRuntimeError();
			});
		}else{
			displayHighlightUsingVld(snipNameElm, vldS);
			displayHighlightUsingVld(snipBodyElm, vldL);
		}
	}

	// used to show dialog div.dlog
	function showDialog(){
		dlog.addClass("shown");
		document.body.addClass("darkened");
		dialogPoppedUp = true;
	}

	function removeDialog(){
		dlog.removeClass("shown");
		document.body.removeClass("darkened");
		dialogPoppedUp = false;
	}

	// called on "Delete" button click
	function deleteOnClick(){
		var parent = this.parentNode,
			divShort = parent.previousElementSibling;
		
		// this is "Delete" button outside delete popup
		if(!dialogPoppedUp){
			showDialog();			

			var deleteBtn = document.createElement("button");			
			deleteBtn.html("Delete")
				.on("click", deleteOnClick.bind(this))
				.tabIndex = 1;

			var cancelBtn = document.createElement("button");			
			cancelBtn.html("Cancel")
				.on("click", removeDialog)
				.tabIndex = 2;

			dlog.html("Delete '" + getHTML(divShort) + "'?<br>")
				.appendChild(deleteBtn);
			dlog.appendChild(cancelBtn);

			deleteBtn.focus();
		}
		// this is for that "Delete" inside dialog popup
		// which comes when you had clicked previous delete
		else{
			var sVal = getHTML(divShort),
				snip = searchSnippets(sVal, false, "index"),
				index = snip[1];

			// remove the snip
			Data.snippets.splice(index, 1);

			// save these changes in Database
			DB_save(function(){
				// remove the open dialog
				removeDialog();
			
				// the data is saved; now list the items in popup.html
				if(!searchMode) // list only if no search taking place
					listSnippets(Data.snippets);
				else{
					var parentLI = parent.parentNode,
						snips = parentLI.parentNode;
					snips.removeChild(parentLI);
				}

				notifySnippetDataChanges();

				checkRuntimeError();
			});			
		}
	}

	// called on "Cancel" button click (after "Edit" button)
	function cancelOnClick(){		
		var parent = this.parentNode,
			snipNameElm = parent.previousElementSibling.previousElementSibling,
			snipBodyElm = parent.nextElementSibling,
			parentLI = parent.parentNode;
		
		// small helper
		function perform(node, name){			
			// remove counter checker
			parentLI.removeChild(node.nextElementSibling);
			// convert to div and set text
			setTextForNode(node.replaceWith("div", name), node.dataset.previous);
		}		
		
		perform(snipNameElm, "short");		
		perform(snipBodyElm, "long");
			
		// remove `height` to get back min-height and max-height in action
		parentLI.style.height = "";

		// show .snip .long
		parentLI.addClass("shown");
	
		// Cancel -> Delete
		transformButtonTo(this, "Delete");
	
		// Save -> Edit
		transformButtonTo(this.previousSibling, "Edit");
		
		// add dropdown button
		parent.appendChild(getDropDownElm());
	}

	function onDropDownClick(){
		var snip = this.parentNode.parentNode,
			// idx corresponds to text in map
			idx = +snip.hasClass("shown"),
			// text to set (same) for each of title, alt for snip object			
			map = ["Click to hide the snippet",
				"Click to show the full snippet"];

		snip.toggleClass("shown");
		this.setAttribute("title", map[idx]);
		this.setAttribute("alt", map[idx]);
	}

	// updates the storage header in #headArea
	// "You have x bytes left out of y bytes"
	function updateStorageAmount(){
		storage.getBytesInUse(function(bytesInUse){
			// set current bytes
			$("#headArea .currentBytes").html(bytesInUse);
			
			// set number of snippets written
			$("#headArea .snippet_amount").html(Data.snippets.length);
			
			// set total bytes available
			$("#headArea .bytesAvailable").html( 
									storage.MAX_ITEMS ? /*sync*/ "102,400" : "5,242,880");
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
	// Helper functions
	//////////////////////////////

	function resetBox(box, name){
		box.dataset.message = undefined;

		var nES = box.nextElementSibling;
		
		// reset `p` element text
		nES.html(snipLimits[name] +	" characters left")
			// removes the "red" class if present
			.className = "";

		// reset text
		box.html("")
			// remove these classes
			.removeClass(["active", "failed", "passed"]);
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

		updateStorageAmount();
		
		// needs to be global
		dlog = $(".dlog");

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
			flipContainer = $(".flip-container"),
			snips = $("#snips");

		// rotate from create snip area to snippet list
		function getBackToHomePage(){
			resetBox(snipSValBox, "name");
			resetBox(snipLValBox, "body");				

			// flip back to the home page
			flipContainer.removeClass("flipped");
			flipped_mode = false;
			// set tabIndices
			snipSValBox.tabIndex =
				snipLValBox.tabIndex =
				doneButton.tabIndex  =
				backButton.tabIndex  = -1;

			return false;
		}
			
		$("#headArea .bytesAvailable").on("click", function(){
			window.open("https://developer.chrome.com/extensions/storage#properties");
		});

		chrome.storage.onChanged.addListener(function(){
			updateStorageAmount();
		});

		window.on("resize", debounce(function(){
			// zoom is in zoom% (100, 125, etc.)
			var zoom = getPageZoom() * 100,
				elm = document.documentElement;

			elm.className = zoom >= 125 ? "zoom125" : 
							zoom <= 75 ? "zoom75" :
							"";			
		}));
			
		attachCounterChecker(snipLValBox, SNIP_BODY_LIMIT);
		attachCounterChecker(snipSValBox, SNIP_NAME_LIMIT);

		optionsButton.on("click", function(){
			window.open("options.html");
		});

		// create snip area
		backButton.on("click", function(){
			getBackToHomePage();
		});

		// create snip area
		doneButton.on("click", function(){
			var sVal = snipSValBox.html(),
				lVal = snipLValBox.html(),
				vldS = validateSVal(sVal, sVal.length),
				vldL = validateLVal(lVal.length);
				
			// both inputs correct
			if(vldS === true && vldL === true){
				// store snippets
				setDataSnippet(sVal, lVal);

				// save data
				DB_save(function(){
					// the data is saved; now list the items in popup.html
					listSnippets(Data.snippets, sVal);

					// notify all content scripts about the change
					notifySnippetDataChanges();

					checkRuntimeError();
				});

				getBackToHomePage();

				return false;
			}else{
				displayHighlightUsingVld(snipSValBox, vldS);
				displayHighlightUsingVld(snipLValBox, vldL);
			}
		});
			
		function searchButtonClick(btn, title, textToSet){
			var s = "shown", h = "hidden";
			
			btn.html(textToSet)
				.toggleClass("shortened")
				.setAttribute("title", title);
			
			searchField.toggleClass(s);
			createSnipButton.toggleClass(h);
			optionsButton.toggleClass(h);

			// toggle searchMode
			searchMode = !searchMode;
		}

		searchButton.on("click", function(){			
			if(this.hasClass("shortened")){
				searchButtonClick(this, "Search for snips", "Search for snips");
				searchField.html("");
				listSnippets(Data.snippets);				
			}else{
				searchButtonClick(this, "Click when done searching", "Done");

				// 1000 => after animation finishes; focus searchField
				setTimeout(function(){
					searchField.focus();
				}, 1000);
			}
		});

		searchField.on("keyup", function(){
			var searchText = this.html(),
				textLen = searchText.length;
				
			if(!snips) snips = $("#snips");
			
			// the `>` is important as `p` may refer to
			// the counter checker in li.snip
			var	p = snips.querySelector("#snips > p"),
				snipsLen = Data.snippets.length,
				displayPara = document.createElement("p"),
				ul, msg, // green colored message
				// to perform search, user needs to type
				// minimum three characters
				MIN_CHARS_REQ = 3;

			displayPara.addClass("display_msg_to_user");

			// if p then remove p as
			// p might the error message
			// shown to the user previously
			if(p) snips.removeChild(p);

			ul = snips.querySelector("ul");

			// if ul then remove ul
			// ul contains snippets
			if(ul) snips.removeChild(ul);

			// if no more than 3 snippets
			// do not search
			if(snipsLen <= 3)
				msg =  "You must have at least 4 snippets<br>for the search to\
					function.<br>Currently, you have " + snipsLen + " snippets";
			// at least 3 characters should be there
			else if(textLen >= MIN_CHARS_REQ){
				var result = searchSnippets(searchText, searchText);
				if(isObject(result)) result = [result];

				// nothing in result array; means nothing was found
				if(!result[0])
					msg = "No snippet found.<br>Please rephrase your search query.";
				else
					// at least one snippet is there
					listSnippets(result);
			}
			else // less than 3 characters are there
				msg = "Need to type " + (MIN_CHARS_REQ - textLen) + " more characters.";


			if(typeof msg === "string")
				snips.appendChild(displayPara.html(msg));
		});

		createSnipButton.on("click", function(){
			// work only if the #snips is not already flipped
			if(!flipped_mode){
				flipped_mode = true;

				// add flipped class
				flipContainer.addClass("flipped");

				snipSValBox.addClass("active")
					.tabIndex = 1;
				snipLValBox.addClass("active")
					.tabIndex = 3;

				// set tabIndices
				doneButton.tabIndex  = 5;
				backButton.tabIndex  = 7;

				// focus the #sVal input, so user can start typing
				snipSValBox.focus();
			}
		});

		// list the existing data;
		// as extension is called for first time;
		listSnippets(Data.snippets);

		// now check if the user is first time user; get that data
		function check(){
			var button, // "Got it" button
				parentStyleObj;
			
			// if DB not loaded
			if(!Data.visited){ // first time user					
				button = $(".new_user_msg button");
				parentStyleObj = button.parentNode.style;
				parentStyleObj.display = "block";

				// if the user clicks the button; he's no more a first time user
				button.on("click", function(){
					Data.visited = true;
					
					DB_save(function(){
						parentStyleObj.display = "none";
						optionsButton.removeClass("firstInstall");
					});
				});

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
				
				// snippets already present
				if(Data.snippets.length >= 5) return;					

				Data.snippets.push(a, b, c, d, e);
				
				optionsButton.addClass("firstInstall");
				
				DB_save(listSnippets);
			}
		}

		check();
	}
})();