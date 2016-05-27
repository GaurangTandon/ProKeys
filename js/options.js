/* global isEmpty, padNumber, cloneObject, isObject, getFormattedDate, snipLimits */
/* global $, setTextForNode, getHTML, SNIP_NAME_LIMIT, SNIP_BODY_LIMIT */
/* global triggerEvent, setHTML, MONTHS, formatTextForNodeDisplay, chrome */
/* global escapeRegExp, getText*/

(function(){
	"use strict";

	window.onload = init;

	var storage = chrome.storage.local,
		DataName = "UserSnippets",
		// global functions defined in init
		toggleSnippetEditPanel, toggleFolderEditPanel,
		validateSnippetData, validateFolderData,
		// property name of localStorage item that stores past snippets versions
		LS_REVISIONS_PROP = "prokeys_revisions",
		MAX_REVISIONS_ALLOWED = 20,
		MAX_SYNC_DATA_SIZE = 102400,
		MAX_LOCAL_DATA_SIZE = 5242880;
	
	window.DB_loaded = false;
	window.Data = {
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
	};
	window.IN_OPTIONS_PAGE = true;
	window.$containerSnippets = null;
	window.$panelSnippets = null;
	window.$containerFolderPath = null;
	window.latestRevisionLabel = "data created (5 defaut snippets)";
	
	// when we restore one revision, we have to remove it from its
	// previous position; saveSnippetData will automatically insert it 
	// back at the top of the list again
	function deleteRevision(index){
		var parsed = JSON.parse(localStorage[LS_REVISIONS_PROP]);
			
		parsed.splice(index, 1);		
		localStorage[LS_REVISIONS_PROP] = JSON.stringify(parsed);
	}
	
	function saveRevision(dataString){
		var parsed = JSON.parse(localStorage[LS_REVISIONS_PROP]);
		
		parsed.unshift({  // push latest revision
			label: getFormattedDate() + " - " + latestRevisionLabel,
			data: dataString || Data.snippets
		});
		
		parsed = parsed.slice(0, MAX_REVISIONS_ALLOWED);
		localStorage[LS_REVISIONS_PROP] = JSON.stringify(parsed);
	}
	
	// objectNamesToHighlight - when you add snippet/folder, it gets highlighted
	window.saveSnippetData = function(callback, folderNameToList, objectNamesToHighlight){
		Data.snippets = Data.snippets.toArray();
		
		// refer github issues#4
		Data.dataUpdateVariable = !Data.dataUpdateVariable;
		
		DB_save(function(){
			// called while Data.snippets is still a string
			saveRevision(); 
			notifySnippetDataChanges();
			
			Data.snippets = Folder.fromArray(Data.snippets);
			Folder.setIndices();
			var folderToList = folderNameToList ? 
									Data.snippets.getUniqueFolder(folderNameToList) :
									Data.snippets;		
			folderToList.listSnippets(objectNamesToHighlight);
			
			checkRuntimeError();			
			
			if(callback) callback();
		});
	}
	
	// save data not involving snippets
	function saveOtherData(msg, callback){
		Data.snippets = Data.snippets.toArray();
		
		// refer github issues#4
		Data.dataUpdateVariable = !Data.dataUpdateVariable;
		
		DB_save(function(){
			Data.snippets = Folder.fromArray(Data.snippets);
		
			if(typeof msg === "function") msg();
			else if(typeof msg === "string") alert(msg);
			checkRuntimeError();
			
			if(callback) callback();
		});
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
			else {
				Data = r[DataName];
				if (callback) callback();
			}
		});
	}

	function DB_save(callback) {
		DB_setValue(DataName, Data, function() {
			if(callback) callback();
		});
	}

	// returns whether site is blocked by user
	function isBlockedSite(domain){
		var arr = Data.blockedSites;

		for(var i = 0, len = arr.length; i < len; i++){
			var str = arr[i],
				regex = new RegExp("^" + escapeRegExp(domain));

			if(regex.test(str))	return true;
		}

		return false;
	}

	// returns an array of matched snip objects; or unique snip object
	// based on 2 optional parameters
	// return value is an array of three elements; first value is boolean 
	// indicates whether there was exact match; if boolean is true, then:
	//    second is the snippet object of exact match
	//    third is an array containing global index and nested index
	//    global index is -1 if snip is in global scope (out of any folder)
    //    else it is 0-n denoting folder index
	//    nested index, if global index = -1, nested index is within snippet list
	//    as a whole, else index is within folder array
	// else if boolean is false, then there is only a second element which is an array
	// containing all the snippet objects that were nearly matched
	// `return_val` is `"index"` when index of the matched unique snip
	// is required; else it is omitted

	function listBlockedSites(){
		var ul = $("#settings ul"),
			li, pElm, delDiv;

		// if atleast one blocked site
		if(Data.blockedSites[0]) ul.html("");
		else{
			ul.html("<li>None Currently</li>");

			return; // exit
		}

		for(var i = 0, len = Data.blockedSites.length; i < len; i++){
			li = document.createElement("li");

			pElm = document.createElement("p");
			li.appendChild(pElm.html(Data.blockedSites[i]));

			delDiv = document.createElement("div");
			li.appendChild(delDiv.html("Unblock"));

			ul.appendChild(li);
		}
	}

	function createTableRow(textArr){
		var tr = document.createElement("tr");

		for(var i = 0, len = textArr.length; i < len; i++)
			tr.appendChild(document.createElement("td").html(textArr[i]));

		return tr;
	}

	// notifies content script and background page
	// about Data.snippets changes
	function notifySnippetDataChanges(){
		var msg = {snippetList: Data.snippets};
		
		chrome.tabs.query({}, function(tabs){
			var tab;

			for (var i = 0, len = tabs.length; i < len; i++) {
				tab = tabs[i];
				if(!tab || !tab.id) continue;
				
				chrome.tabs.sendMessage(tab.id, msg);
			}
		});

		chrome.extension.sendMessage(msg);
	}

	// inserts in the table the chars to be auto-inserted
	function listAutoInsertChars(){
		var arr = Data.charsToAutoInsertUserList,
			table = $("#settings table"),
			// used to generate table in loop
			thead, tr, inputBox;

		// clear the table initially
		table.html("");

		for(var i = 0, len = arr.length; i < len; i++)
			// create <tr> with <td>s having text as in current array and Remove
			table.appendChild(createTableRow(arr[i].concat("Remove")));

		if(len === 0)
			table.html("None currently. Add new:");
		else{ // insert character-complement pair <thead> elements
			thead = document.createElement("thead");
			tr = document.createElement("tr");

			tr.appendChild(document.createElement("th").html("Character"));
			tr.appendChild(document.createElement("th").html("Complement"));

			thead.appendChild(tr);

			table.insertBefore(thead, table.firstChild);
		}

		inputBox = table.lastChild.firstChild;

		// if there is no input box present or there is no auto-insert char
		if( !(inputBox && /input/.test(inputBox.html()) || len === 0) )
			appendInputBoxesInTable(table);
	}

	function searchAutoInsertChars(firstChar, shouldReturnIndex){
		var arr = Data.charsToAutoInsertUserList,
			complement;

		for(var i = 0, len = arr.length; i < len; i++){
			complement = arr[i][0];

			if(complement === firstChar){
				return shouldReturnIndex ? [i, complement] : complement;
			}
		}

		return undefined;
	}

	function appendInputBoxesInTable(table){
		var textList = ["<input type='text' placeholder='Type new character' class='auto-insert-char input'>",
						"<input type='text' placeholder='Type its complement' class='auto-insert-char input'>",
						"<input type='button' value='Save' class='auto-insert-char button'>"];

		table.appendChild(createTableRow(textList));
	}

	var validateRestoreData;
	(function backUpDataValidationFunctions(){
		function validateSnippetsFolder(arr, isPre300Version){
			if(isPre300Version){
				arr.unshift(Date.now());
				arr.unshift(Folder.MAIN_SNIPPETS_NAME);				
			}
			
			/*Note: Generic.getDuplicateObjectsText is being used below
				to suppress duplicate snippets warnings. They will NOT be checked.
				If a user creates duplicate folders, it's his own fault.*/
			var folderName = arr[0],
				folderTimestamp = arr[1],
				snippets = arr.slice(2), folderVld,
				props = ["name", "body", "timestamp"],
				expectedPropsLength = props.length,
				checks = {
					"body": Snip.isValidBody,
					"name": Snip.isValidName,
				}, checkFunc, snippetVld,
				// counter to make sure no extra properties
				propCounter, prop, propVal,
				snippetUnderFolderString;
				
			if(typeof folderName !== "string")
				return "Folder name " + folderName + " is not a string.";
			if((folderVld = Folder.isValidName(folderName)) !== "true" &&
					Generic.getDuplicateObjectsText(folderName, Generic.FOLDER_TYPE) !== folderVld)
				return "Folder name " + folderName + " is invalid because: " + folderVld;
			if(typeof folderTimestamp !== "number")
				return "Timestamp for " + folderName + " is not a number"; 
			
			for(var i = 0, len = snippets.length, elm; i < len; i++){				
				elm = snippets[i];
				
				if(Array.isArray(elm)){
					if((snippetVld = validateSnippetsFolder(elm)) !== "true")
						return snippetVld;
				} // braces are necessary for dangling else problem
				else if(!isObject(elm))
					return (i + 1) + "th snippet under folder " + folderName +
							" is not an object.";
				else{
					propCounter = 0;
					snippetUnderFolderString = (i + 1) + 
									"th snippet under folder " + folderName;
					
					// check whether this item has all required properties
					for(prop in elm){		
						// if invalid property or not of string type
						if(props.indexOf(prop) === -1)
							return "Invalid property " + prop + " in " + snippetUnderFolderString;
						else propCounter += 1;

						propVal = elm[prop];						
						checkFunc = checks[prop];

						if(checkFunc && (snippetVld = checkFunc(propVal)) !== "true" &&
							Generic.getDuplicateObjectsText(propVal, Generic.SNIP_TYPE) !== snippetVld)
							return "Invalid value for property " + prop + " in " + snippetUnderFolderString +
									"; received error: " + snippetVld;
					}
					
					if(propCounter !== expectedPropsLength)
						return "Expected " + expectedPropsLength + " properties in " +
								snippetUnderFolderString + ". Instead got " + propCounter;
				}				
			}
			
			return "true";
		}
		
		// receives charToAutoInsertUserList from user
		// during restore and validates it
		function validateCharListArray(charList){
			for(var i = 0, len = charList.length, item; i < len; i++){
				item = charList[i];
				
				// item should be array
				if(!Array.isArray(item))
					return "Invalid elements of character list " + (i + 1) + "th";

				// array should be of 2 items
				if(item.length !== 2)
					return "Expected 2 elements of character list " + (i + 1) + "th";

				// item's elements should be string
				if(typeof(item[0]) + typeof(item[1]) !== "stringstring")
					return "Elements of character list " + (i + 1) + "th are not strings.";

				// item's elements should be one char in length
				if(item[0].length !== 1 || item[1].length !== 1)
					return "Elements of character list " + (i + 1) + "th are not of length 1.";

				// check dupes
				for(var j = i + 1; j < len; j++)
					if(item[0] === charList[j][0])
						return "Elements of character list " + (i + 1) + " and " + (j + 1) + " are duplicate";
			}

			return "true";
		}

		// receives data object and checks whether
		// it has only those properties which are required
		// and none other
		validateRestoreData = function(data, snippets, dataType){
			// if data is of pre-3.0.0 times
			// it will not have folders and everything
			var isPre300Version = typeof data.dataUpdateVariable === "undefined",
				vld1 = validateSnippetsFolder(snippets, isPre300Version);
				
			if(vld1 !== "true") return vld1;

			// all the checks following this line should be of "data" type
			if(dataType !== "data") return "true";
			
			var propCount = 0,
				// the list of the correct items
				correctProps = ["blockedSites", "charsToAutoInsertUserList", "dataVersion",
						"language", "snippets", "tabKey", "visited", "hotKey", "dataUpdateVariable"],
				msg = "Data had invalid property: ";

			// ensure backwards compatibility
			data.dataUpdateVariable = false; // #backwardscompatibility
				
			for(var prop in data){
				if(correctProps.indexOf(prop) > -1){
					propCount++;
										
					switch(prop){
						case "blockedSites":
						case "charsToAutoInsertUserList":
						case "snippets":
						case "hotKey":
							if(!Array.isArray(data[prop]))
								return "Property " + prop + " not set to an array";
							break;
						case "language":
							// no need to produce error message, just rewrite the value
							// with the expected value we require
							data[prop] = "English"
							break;
						case "dataVersion":
							data[prop] = 1;
							break;
						case "tabKey":
						case "visited":
						case "dataUpdateVariable":							
							data[prop] = prop === "visited" ? true : false;
							break;
						default: // possibly wrong property
							return msg + prop;
					}
				}
				// invalid property in data
				else
					return msg + prop;
			}

			var actualPropsNumber = correctProps.length;
			// number of properties
			if(propCount !== actualPropsNumber)
				return "Expected " + actualPropsNumber + " properties in data; instead got " + propCount + " properties.";
			
			var vld2 = validateCharListArray(data.charsToAutoInsertUserList);
			if(vld2 !== "true") return vld2;

			for(var k = 0, len = data.blockedSites.length, elm; k < len; k++){
				elm = data.blockedSites[k];

				// check type
				if(typeof elm !== "string")
					return "Element " + elm + " of blocked sites was not a string.";

				// make sure there's no www
				if(elm.substring(0, 3) === "www")
					data.blockedSites[k] = elm.substring(3);

				// check duplicate
				for(var j = k + 1; j < len; j++)
					if(elm === data.blockedSites[j])
						return "Two elements of blocked sites (called " + elm + ") were duplicates";
			}

			return "true";
		};
	})();

	// get type of current storage as string
	function getCurrentStorageType(){
		// property MAX_ITEMS is present only in sync
		return storage.MAX_ITEMS ? "sync" : "local";
	}

	// changes type of storage: local-sync, sync-local
	function changeStorageType(){
		storage = getCurrentStorageType() === "sync" ?
				chrome.storage.local : chrome.storage.sync;
	}

	// transfer data from one storage to another
	function migrateData(transferData){
		var str = Data.snippets.toArray(); // maintain a copy

		// make current storage unusable
		// so that storage gets changed by DB_load
		Data.snippets = false;

		DB_save(function(){
			changeStorageType();
			
			if(transferData){
				// get the copy
				Data.snippets = Folder.fromArray(str);				
				saveOtherData(location.reload.bind(location));
			}
			else location.reload();
		});
	}

	// returns the current hotkey in string format
	// example: ["shiftKey", 32] returns Shift+Space
	function getCurrentHotkey(){
		var combo = Data.hotKey.slice(0),
			kC, // keyCode
			result = "",
			specials = {
				13 : "Enter",
				32 : "Space",
				188 : ", (Comma)",
				192 : "` (Backtick)"
			},
			metaKeyNames = {
				"shiftKey" : "Shift",
				"ctrlKey" : "Ctrl",
				"altKey" : "Alt",
				"metaKey" : "Meta"
			};

		// dual-key combo
		if(combo[1]){
			result += metaKeyNames[combo[0]] + " + ";
			
			kC = combo[1];
		}
		else kC = combo[0];

		// numpad keys
		if(kC >= 96 && kC <= 105) kC -= 48;
		
		result += specials[kC] || String.fromCharCode(kC);

		return result;
	}

	function blockSite(){
		var regex = /(\w+\.)+\w+/,
			value = this.value;

		// invalid domain entered; exit
		if( !(regex.test(value)) ) { alert("Invalid form of site address entered."); return;}

		value = value.replace(/^(https?:\/\/)?(www\.)?/, "");
		
		// already a blocked site
		if( isBlockedSite(value) ) { alert("Site " + value + " is already blocked."); return;}

		// reset its value
		this.value = "";

		Data.blockedSites.push(value);

		saveOtherData("Blocked " + value, listBlockedSites);
	}

	function selectTextIn(elm){
		if(isContentEditable(elm)){
			var sel = window.getSelection(),
				range = document.createRange();

			range.selectNodeContents(elm);
			sel.removeAllRanges();
			sel.addRange(range);
		}
		else{
			elm.selectionStart = 0;
			elm.selectionEnd = elm.value.length;
		}
	}
	
	// folder and snippet edit panel
	function editPanel(type){
		var $panel = $(".panel_" + type + "_edit");
		
		function highlightInFolderList(folderElm, name){
			var folderNames = folderElm.querySelectorAll("p"),
				folder;
			
			for(var i = 0, len = folderNames.length; i < len; i++)
				if((folder = folderNames[i]).html() === name){
					folder.addClass("selected");
					return;
				}
		}
		
		return function(object, isClosingEditPanel){
			var	headerSpan = $panel.querySelector(".header span"),
				nameElm = $panel.querySelector(".name input"),
				bodyElm = $panel.querySelector(".body textarea"),				
				folderElm = $panel.querySelector(".folderSelect .selectList"),
				folderPathElm = $panelSnippets.querySelector(".folder_path :nth-last-child(2)"),
				// boolean to tell if call is to edit existing snippet/folder
				// or create new snippet
				isEditing = !!object;				
			
			$panelSnippets.toggleClass("hidden");			
			$panel.toggleClass("hidden");
			if(isEditing) $panel.removeClass("creating-new");
			else $panel.addClass("creating-new");
			
			if(isClosingEditPanel) return;
			
			// reset
			folderElm.html("");	
			
			// cannot nest a folder under itself	
			folderElm.appendChild(isEditing && type === "folder" ? 
									Data.snippets.getFolderSelectList(object.name) :
									Data.snippets.getFolderSelectList());
			
			if(isEditing){
				var parent = object.getParentFolder();
				highlightInFolderList(folderElm, parent.name);
			}
			else highlightInFolderList(folderElm, folderPathElm.html());			
			
			headerSpan.html((isEditing ? "Edit " : "Create new ") + type);
			
			$(".error").removeClass("shown");			
			
			if(isEditing){
				nameElm.text(object.name).focus();
				nameElm.dataset.name = object.name;
				if(bodyElm) bodyElm.text(object.body);			
			}
			else{
				nameElm.text("").focus();
				if(bodyElm) bodyElm.text("");
				nameElm.dataset.name = "";
			}			
		};
	}
	
	// things common to snip and folder
	function commonValidation(panelName){
		var panel = $(".panel_" + panelName + "_edit");
		
		function manipulateElmForValidation(elm, validateFunc){
			var text = elm.value,
				textVld = validateFunc(text),
				isTextValid = textVld === "true",
				textErrorElm = elm.nextElementSibling;
				
			// when we are editing snippet/folder it does
			// not matter if the name remains same
			if(textVld === Generic.getDuplicateObjectsText(text, panelName)
					&& elm.dataset.name === text)
				isTextValid = true;
				
			if(!isTextValid){
				textErrorElm
					.addClass("shown")
					.html(textVld);			
			}
			else textErrorElm.removeClass("shown");
			
			return [text, isTextValid];
		}
		
		return function(callback){			
			var	nameElm = panel.querySelector(".name input"), name,
				selectList = panel.querySelector(".selectList"),
				folder = Folder.getSelectedFolderInSelectList(selectList),
				isSnippet = /snip/.test(panel.className), bodyElm, body;
			
			if(isSnippet){
				bodyElm = panel.querySelector(".body textarea");
				name = manipulateElmForValidation(nameElm, Snip.isValidName);
				body = manipulateElmForValidation(bodyElm, Snip.isValidBody);		
			}
			else name =  manipulateElmForValidation(nameElm, Folder.isValidName);
			
			var	allValid = name[1] && (isSnippet ? body[1] : true),
				oldName = nameElm.dataset.name;
				
			if(allValid){
				if(isSnippet) toggleSnippetEditPanel(undefined, true);			
				else toggleFolderEditPanel(undefined, true);			

				callback(oldName, name[0], body && body[0], folder);
			}
		};
	}
	
	// (sample) input 1836 => "2KB"
	// input 5,123,456 => "5MB"
	function roundByteSize(bytes){
		var powers = [6, 3, 0, -3],
			suffixes = ["MB", "KB", "B", "mB"],
			DECIMAL_PLACES_TO_SHOW = 1;
		
		for(var i = 0, len = powers.length, lim; i < len; i++){
			lim = Math.pow(10, powers[i]);
			
			if(bytes >= lim)
				return (bytes / lim).toFixed(DECIMAL_PLACES_TO_SHOW) + suffixes[i];
		}
	}
	
	function roundByteSizeWithPercent(bytes, bytesLim){
		var out = roundByteSize(bytes),
			// nearest multiple of five
			percent = Math.round(bytes / bytesLim * 20) * 5;
		
		return out + " (" + percent + "%)";
	}
	
	// updates the storage header in #headArea
	// "You have x bytes left out of y bytes"
	function updateStorageAmount(){		
		storage.getBytesInUse(function(bytesInUse){
			var bytesAvailable = storage.MAX_ITEMS ? MAX_SYNC_DATA_SIZE : MAX_LOCAL_DATA_SIZE;
		
			// set current bytes
			$(".currentBytes").html(roundByteSizeWithPercent(bytesInUse, bytesAvailable));

			// set total bytes available
			$(".bytesAvailable").html(roundByteSize(bytesAvailable));
		});
	}

	function init(){		
		// needs to be set before database actions
		$containerSnippets = $("#snippets .panel_snippets .panel_content");
		$containerFolderPath = $("#snippets .panel_snippets .folder_path");
		$panelSnippets = $(".panel_snippets");
		
		if(!DB_loaded){
			setTimeout(init, 500);	return;
		}

		// should only be called when DB has loaded
		// and page has been initialized
		setEssentialItemsOnDBLoad();
		
		var changeHotkeyBtn = $(".change_hotkey"),
			hotkeyListener = $(".hotkey_listener");	
			
		$(".bytesAvailable").on("click", function(){
			window.open("https://developer.chrome.com/extensions/storage#properties");
		});

		chrome.storage.onChanged.addListener(updateStorageAmount);
			
		// panels are - #content div
		(function panelWork(){
			var url = window.location.href;

			if(/#\w+$/.test(url) && (!/tryit|symbolsList/.test(url)))
				// get the id and show divs based on that
				showHideDIVs(url.match(/#(\w+)$/)[1]);
			else showHideDIVs("settings"); // default panel
				
			// used when buttons in navbar are clicked
			// or when the url contains an id of a div
			function showHideDIVs(DIVName){
				var containerSel = "#content > ",
					DIVSelector = "#" + DIVName,
					btnSelector = ".sidebar .buttons button[data-divid =" + DIVName + "]",
					selectedBtnClass = "selected",
					selectedDIV = $(containerSel + ".show"),
					selectedBtn = $(".sidebar .buttons ." + selectedBtnClass);

				if(DIVName === "snippets") Data.snippets.listSnippets();
					
				if(selectedDIV) selectedDIV.removeClass("show");
				$(containerSel + DIVSelector).addClass("show");
				
				if(selectedBtn) selectedBtn.removeClass(selectedBtnClass);
				$(btnSelector).addClass(selectedBtnClass);
				
				var href = window.location.href,
					selIndex = href.indexOf("#");

				if(selIndex !== -1) href = href.substring(0, selIndex);

				window.location.href = href + DIVSelector;
				
				// the page shifts down a little
				// for the exact location of the div;
				// so move it back to the top
				document.body.scrollTop = 0;
			}

			// the left hand side nav buttons
			// Help, Settings, Backup&Restore, About
			$(".sidebar .buttons button").on("click", function(){
				showHideDIVs(this.dataset.divid);
			});
		})();

		(function helpPageHandlers(){
			/* set up accordion in help page */
			// heading
			$("#help section dt").on("click", function(){
				this.nextElementSibling.toggleClass("hide");
			});

			// corresponding content
			$("#help section dd").forEach(function(elm){
				elm.addClass("hide");
			});

			// the tryit editor in Help section
			$("#tryit .nav p").on("click", function(){
				var ots, // the currently shown nav elm
					s = "show", t = "#tryit ";

				// only toggle if not already shown
				if(!this.hasClass("show")){
					// hide the currently shown nav elm
					ots = $(t + ".nav ." + s);
					ots.removeClass(s);
					// and its corresponding editor
					$(t + ots.dataset.selector).toggleClass(s);

					// show nav elm which was clicked
					this.addClass(s);
					// along with its corresponding editor
					$(t + this.dataset.selector).toggleClass(s);
				}
			});
		})();

		document.on("click", function(event){
			var node = event.target,
				tagName = node.tagName,
				value = node.html(),
				domain, index,
				firstCharElm, firstChar;

			// blocked sites Unblock button
			if(value === "Unblock"){
				domain = node.previousElementSibling.html();

				index = Data.blockedSites.indexOf(domain);

				Data.blockedSites.splice(index, 1);

				//chrome.extension.getBackgroundPage().addRemoveBlockedSite(domain, false);

				saveOtherData(listBlockedSites);
			}
			// Remove button for auto-insert character list
			else if(tagName === "TD" && value === "Remove"){
				firstCharElm = node.previousElementSibling.previousElementSibling;
				firstChar = formatTextForNodeDisplay(firstCharElm, firstCharElm.html(), "makeHTML");

				// retrieve along with index (at second position in returned array)
				index = searchAutoInsertChars(firstChar, true)[0];

				Data.charsToAutoInsertUserList.splice(index, 1);

				saveOtherData("Removed pair having '" + firstChar + "'",
					listAutoInsertChars);

			}
			// newAutoInsertChar
			else if(tagName === "INPUT" && value === "Save"){
				// get elements
				var newAutoInsertChar = document.querySelectorAll("#settings table .auto-insert-char"),
					elmChar1 = newAutoInsertChar[0],
					elmChar2 = newAutoInsertChar[1],
					text1 = elmChar1.value,
					str = "Please type atleast/only one character in ";

				if(text1.length !== 1){
					alert(str + "first field.");
					return false;
				}

				var text2 = elmChar2.value;

				if(text2.length !== 1){
					alert(str + "second field.");
					return false;
				}

				// already present
				if(searchAutoInsertChars(text1, true) !== undefined){
					alert("The character \"" + text1 + "\" is already present.");
					return false;
				}

				// first insert in user list
				Data.charsToAutoInsertUserList.push([text1, text2]);

				saveOtherData("Saved auto-insert pair - " + text1 + " " + text2,
					listAutoInsertChars);
			}
		});

		(function settingsPageHandlers(){
			// on user input in tab key setting
			$("#tabKey").on("change", function(){
				// change Data
				Data.tabKey	= $("#tabKey").checked;

				// and save it
				saveOtherData("Saved!");
			});

			// siteBlockInput field
			$("#settings .siteBlockInput").on("keyup", function(event){
				if(event.keyCode === 13) blockSite.call(this);
			});

			// siteBlockButton
			$("#settings .siteBlockInput + button").on("click", function(){
				blockSite.call(this.previousElementSibling);
			});
		})();

		(function snippetWork(){
			// define element variables
			var $searchBtn = $(".search_btn"),
				$searchPanel = $(".panel_search"),
				$searchField = $(".panel_search input[type=text]"),				
				$closeBtn = $(".close_btn"),
				$snippetSaveBtn = $(".panel_snip_edit .tick_btn"),
				$folderSaveBtn = $(".panel_folder_edit .tick_btn"),
				$addNewBtn = $(".panel_snippets .add_new_btn"),
				$addNewPanel = $(".panel_snippets .panel_add_new"),
				$createSnipBtn = $(".panel_add_new :nth-child(1)"),
				$createFolderBtn = $(".panel_add_new :nth-child(2)"),
				$sortBtn = $(".panel_snippets .sort_btn"),
				$sortPanel = $(".panel_sort"),
				// the button that actually initiates sorting
				$sortPanelBtn = $(".panel_sort input[type=button]"),
				$bulkActionBtn = $(".panel_snippets .checkbox_btn"),
				$bulkActionPanel = $(".panel_snippets .panel_bulk_action"),
				folderPath = $(".folder_path"),
				$selectList = $(".selectList");
			
			// functions
			toggleSnippetEditPanel = editPanel(Generic.SNIP_TYPE);
			toggleFolderEditPanel = editPanel(Generic.FOLDER_TYPE);
			validateSnippetData = commonValidation(Generic.SNIP_TYPE);
			validateFolderData = commonValidation(Generic.FOLDER_TYPE);
			
			$containerSnippets.on("click", function(e){
				var node = e.target,
					objectElm = node.parentNode.parentNode;
					
				if(!objectElm) return true;
				
				var $name = objectElm.querySelector(".name"), name;
				
				if(!$name) return true;
				name = $name.html();
				
				if(node.matches("#snippets .panel_content .edit_btn")){
					if(/snip/.test(objectElm.className))
						toggleSnippetEditPanel(Data.snippets.getUniqueSnip(name));
					else
						toggleFolderEditPanel(Data.snippets.getUniqueFolder(name));
				}else if(node.matches("#snippets .panel_content .delete_btn"))
					deleteOnClick.call(objectElm, name);
			});
			
			folderPath.on("click", function(e){
				var node = e.target,
					folderName, folder;
				
				if(node.matches(".chevron")){
					folder = Folder.getListedFolder();
					folder.getParentFolder().listSnippets();
				}
				else if(node.matches(".path_part")){
					folderName = node.innerHTML;
					folder = Data.snippets.getUniqueFolder(folderName);
					folder.listSnippets();
				}
			});
			
			$closeBtn.on("click", function(){
				var $panel = this.parentNode.parentNode;
				$panel.addClass("hidden");
				$panelSnippets.removeClass("hidden");
			});
			
			function objectSaver(type){
				return function(oldName, name, body, newParentfolder){
					var object, oldParentFolder, timestamp;
					
					if(oldName) {				
						object = Data.snippets["getUnique" + type](oldName);
						oldParentFolder = object.getParentFolder();
						timestamp = object.timestamp;
						
						if(newParentfolder.name !== oldParentFolder.name) {
							object.remove();
							if(type === "Snip") newParentfolder.addSnip(name, body, timestamp);
							else newParentfolder.addFolder(name, timestamp);
						}
						else oldParentFolder["edit" + type](oldName, name, body);
					}
					else newParentfolder["add" + type](name, body);
				};
			}
			
			$snippetSaveBtn.on("click", function(){								
				validateSnippetData(objectSaver("Snip"));
			});
			
			$folderSaveBtn.on("click", function(){				
				validateFolderData(objectSaver("Folder"));
			});
			
			function deleteOnClick(name){
				var type = /snip/.test(this.className) ? Generic.SNIP_TYPE : Generic.FOLDER_TYPE,
					object, folder;
				
				if(confirm("Delete '" + name + "' " + type + "?")){
					object = Data.snippets
							.getUniqueObject(name, type);
					folder = object.getParentFolder();
					
					object.remove();					
					this.parentNode.removeChild(this);
					
					latestRevisionLabel = "deleted " + object.type + " \"" + object.name + "\"";
					
					saveSnippetData(undefined, folder.name);
				}
			}

			// grey out select list on this checkbox click
			// cannot use css here :(
			$selectList.on("click", function(e){				
				var node = e.target, classSel = "selected", others;
				
				if(node.tagName === "P"){
					// do not use $selectList
					// as it is a NodeList
					others = this.querySelector("." + classSel);
					if(others) others.removeClass(classSel);
					node.addClass(classSel);
				}
			});
			
			// for searchBtn and $searchPanel
			// $addNewBtn and $addNewPanel
			// and other combos
			function toggleBtnAndPanel(btn, panel){	
				var existingPanel = $(".sub_panel.shown");
				if(!panel.hasClass("shown")) panel.addClass("shown");
				if(existingPanel) existingPanel.removeClass("shown");
				
				var existingBtn = $(".panel_btn.active");
				if(!btn.hasClass("active"))	btn.addClass("active");
				if(existingBtn)	existingBtn.removeClass("active");

				// we need these checks as another might have been clicked
				// to remove the search/checkbox panel and so we need to remove
				// their type of list
				if(!$searchPanel.hasClass("shown") &&
					Folder.getListedFolder().isSearchResultFolder)
					Data.snippets.listSnippets();
																
				// if checkbox style list is still shown
				if($containerSnippets.querySelector("input[type=\"checkbox\"]") &&
					!$bulkActionPanel.hasClass("shown"))
					Data.snippets.getUniqueFolder($bulkActionPanel.dataset.originalShownFolderName)
						.listSnippets();					
			}
			
			$sortBtn.on("click", function(){
				toggleBtnAndPanel($sortBtn, $sortPanel);
			});
			
			$sortPanelBtn.on("click", function(){
				var sortDir = $sortPanel.querySelector(".sort-dir :checked").parentNode.innerText,
					sortType = $sortPanel.querySelector(".sort-type :checked").parentNode.innerText,
					descendingFlag = sortDir = sortDir === "Descending",
					lastFolderDOM = folderPath.lastChild.previousSibling,
					folder = Data.snippets.getUniqueFolder(lastFolderDOM.html());
					
				sortType = sortType === "Name" ? "alphabetic" : "date";				
					
				folder.sort(sortType, descendingFlag);
				
				latestRevisionLabel = "sorted folder \"" + folder.name + "\"";
			});
			
			$addNewBtn.on("click", function(){
				toggleBtnAndPanel($addNewBtn, $addNewPanel);
			});
	
			$createSnipBtn.on("click", function(){
				toggleSnippetEditPanel();
			});
			
			$createFolderBtn.on("click", function(){
				toggleFolderEditPanel();
			});
			
			$searchBtn.on("click", function(){
				toggleBtnAndPanel($searchBtn, $searchPanel);
				$searchField.html("").focus();
				// now hidden search panel, so re-list the snippets
				if(!$searchPanel.hasClass("shown"))
					Folder.getListedFolder().listSnippets();
			});
			
			$searchBtn.setAttribute("title", "Search for folders or snips");

			$searchField.on("keyup", function(){
				var searchText = this.value,
					listedFolder = Folder.getListedFolder(),
					searchResult = listedFolder.searchSnippets(searchText);
					
				searchResult.listSnippets();
			});

			(function bulkActionsWork(){
				var selectedObjects, DOMcontainer,
					moveToBtn = $bulkActionPanel.querySelector(".bulk_actions input:first-child"),
					deleteBtn = $bulkActionPanel.querySelector(".bulk_actions input:last-child"),
					selectAllBtn = $bulkActionPanel.querySelector(".selection_count input"),
					folderSelect = $bulkActionPanel.querySelector(".folderSelect"),
					selectList = $bulkActionPanel.querySelector(".selectList");
			
				function updateSelectionCount(){
					selectedObjects = 
						DOMcontainer.querySelectorAll("input:checked") || [];
						
					selectedObjects	= selectedObjects.map(function(e){
						var div = e.nextElementSibling.nextElementSibling,
							name = div.html(), 
							img = e.nextElementSibling,
							type = img.src.match(/\w+(?=\.png)/)[0];					
						
						return Data.snippets.getUniqueObject(name, type);
					});
						
					$bulkActionPanel
						.querySelector(".selection_count span").html(selectedObjects.length);
						
					$bulkActionPanel.querySelectorAll(".bulk_actions input").forEach(function(elm){
						elm.disabled = !selectedObjects.length;
					});				
				}
				
				$bulkActionBtn.on("click", function(){
					var originalShownFolderName, originalShownFolder;
					
					toggleBtnAndPanel(this, $bulkActionPanel);				
					
					if($bulkActionPanel.hasClass("shown")){
						originalShownFolderName = Folder.getListedFolderName();
						originalShownFolder = Data.snippets.getUniqueFolder(originalShownFolderName);
						DOMcontainer = Folder.insertBulkActionDOM(originalShownFolder);
							
						$bulkActionPanel.dataset.originalShownFolderName = originalShownFolderName;
						
						DOMcontainer.on("click", function(e){
							// watching clicks on checkbox and div.name is tedious
							// so just update count every time anywhere you click
							updateSelectionCount(DOMcontainer);
						});
						
						updateSelectionCount();
						folderSelect.addClass("hidden");
					}
				});
				
				// select all button
				selectAllBtn.on("click", function(){
					DOMcontainer.querySelectorAll("input").forEach(function(elm){
						elm.checked = true;
					});
					
					updateSelectionCount();
				});
							
				// move to folder button
				moveToBtn.on("click", function(){
					var selectFolderName, selectedFolder;
					
					if(folderSelect.hasClass("hidden")){
						Folder.refreshSelectList(selectList);
						folderSelect.removeClass("hidden");
					}
					else{
						selectedFolder = Folder.getSelectedFolderInSelectList(selectList);
						selectFolderName = selectedFolder.name;
						selectedObjects.forEach(function(e){
							if(e.canNestUnder(selectedFolder))
								e.moveTo(selectedFolder);
							else alert("Cannot move " + e.type + " \"" + e.name + "\" to \"" + selectedFolder.name + "\"" +
									"; as it is the same as (or a parent folder of) the destination folder");
						});
						
						latestRevisionLabel = "moved " + selectedObjects.length + 
												" object to folder \"" + selectFolderName + "\"";
						
						saveSnippetData(function(){
							// hide the bulk action panel
							$bulkActionBtn.trigger("click");
						}, selectFolderName, selectedObjects.map(function(e){return e.name;}));
					}					
				});
				
				deleteBtn.on("click", function(){
					if(confirm("Are you sure you want to delete these " + selectedObjects.length + " items? " + 
							"Remember that deleting a folder will also delete ALL its contents.")){
						selectedObjects.map(function(e){
							e.remove();
						});
					
						latestRevisionLabel = "deleted " + selectedObjects.length + " objects";
					
						saveSnippetData(function(){
							// hide the bulk action panel
							$bulkActionBtn.trigger("click");
						}, Folder.getListedFolderName());
					}
				});
			})();			
					
			// now check if the user is first time user; get that data
			(function checkIfFirstTimeUser(){
				var $button = $(".change-log button"),
					$changeLog = $(".change-log"),
					hiddenClass = "hidden",
					// the snippet "auto_generated_note" needs to be inserted at two places
					// hence we store its name and body here.
					name = "README-New_UI_Details",
					body = 
						// using + operator avoids the inadvertently introduced tab characters
						"Dear user, here are some things you need to know in this new UI:\n\n" +
						"1. You need to click on the name or body of the listed snippet to expand it completely. In the following image, " +
						"the purple area shows where you can click to expand the snippet.\n\n<img src='../imgs/help1.png'>\n\n" +
						"2. Click on the pencil icon to edit and the dustbin icon to delete a snippet/folder.\n" +
						"3. Click on the folder, anywhere in the purple area denoted below, to view its contents.\n\n<img src='../imgs/help2.png'>\n\n" + 
						"4. Click on a folder name in the navbar to view its contents. In the example below, the navbar consists of 'Snippets', 'sampleFolder' and 'folder2', " +
						" each nested within the previous.\n\n" +
						"<img src='../imgs/help3.png'>",
					name2 = "clipboard_macro",
					body2 = "Use this snippet anywhere and the following - [[%p]] - will be replaced by " + 
								" your clipboard data. Clipboard data includes text that you have previously copied or cut with intention to paste.";
				
				if(localStorage.prepare300Update === "true"){
					$changeLog.removeClass(hiddenClass);
					
					$button.on("click", function(){
						$changeLog.addClass(hiddenClass);
						localStorage.prepare300Update = "false";
					});
					
					// silly hack to get around addFolder, which saveSnippetData (asynchronous)										
					Data.snippets.list.unshift(new Folder("sampleFolder"));
					Data.snippets.list.push(new Snip(name2, body2));
					Data.snippets.addSnip(name, body);
				}
				
				if(!Data.visited){
					$changeLog.removeClass(hiddenClass);
					
					$button.on("click", function(){
						$changeLog.addClass(hiddenClass);
						Data.visited = true;
						saveOtherData();
					});
					
					// create introductory snippets
					var ts = Date.now(),
						snips = 
					[Folder.MAIN_SNIPPETS_NAME, ts,
						["sampleFolder", ts],
						{
							name: "sampleSnippet",
							body: "Hello new user! Thank you for using ProKeys!\n\nThis is a sample snippet. Try using it on any webpage by typing 'sampleSnippet' (snippet name; without quotes), and press the hotkey (default: Shift+Space), and this whole text would come in place of it.",
							timestamp: ts
						}, {
							name: "letter",
							body: "(Sample snippet to demonstrate the power of ProKeys snippets; for more detail on Placeholders, see the Help section)\n\nHello %name%,\n\nYour complaint number %complaint% has been noted. We will work at our best pace to get this issue solved for you. If you experience any more problems, please feel free to contact at me@organization.com.\n\nRegards,\n%my_name%,\nDate: [[%d(D-MM-YYYY)]]",
							timestamp: ts
						}, {
							name: "brb", body: "be right back", timestamp: ts
						}, {
							name: "my_sign",
							body: "<b>Aquila Softworks ©</b>\n<i>Creator Of ProKeys</i>\n<u>prokeys.feedback@gmail.com</u>",
							timestamp: ts
						}, {
							name: "dateArithmetic",
							body: "Use this snippet in any webpage, and you'll see that the following: [[%d(Do MMMM YYYY hh:m:s)]] is replaced by the current date and time.\n\nMoreover, you can perform date/time arithmetic. The following: [[%d(D+5 MMMM+5 YYYY+5 hh-5 m-5 s-5)]] gives the date, month, year, forward by five; and hour, minutes, and seconds backward by 5.\n\nMore info on this in the Help section.",
							timestamp: ts
						},
						{
							name: name, body: body, timestamp: ts
						},
						{
							name: name2, body: body2, timestamp: ts
						}							
					];
					
					// snippets already present
					if(Data.snippets.list.length >= 5) return;					

					Data.snippets = Folder.fromArray(snips);					
					Data.visited = true;
					
					saveSnippetData();
				}
				// Data.snippets.addSnip will call (=>) saveSnippetData => listSnippets				
				// moreover, saveSnippetData causes Data.snippets to become string and
				// is asynchrmous, hence without the else if the below line will give error
				else if(localStorage.prepare300Update !== "true")
					Data.snippets.listSnippets();
			})();		
		})();

		(function storageModeWork(){
			// boolean parameter transferData: dictates if one should transfer data or not
			function storageRadioBtnClick(str, transferData){
				if(!confirm("Migrate data to " + str + " storage? It is VERY NECESSARY to take a BACKUP before proceeding.")){
					this.checked = false; return; }

				migrateData(transferData);

				alert("Done! Data migrated to " + str + " storage successfully!");
			}

			// event delegation since radio buttons are
			// dynamically added
			$(".storageMode").on("click", function(){
				var input = this.querySelector("input:checked");

				// make sure radio btn is clicked and is checked
				if(input)
					storageRadioBtnClick.call
						(input, input.dataset.storagetoset, input.id !== "sync2");
			});
		})();

		(function backUpWork(){			
			function getSnippetPrintData(folder){
				var list = folder.list,
					res = "", sn,
					folders = [];

				for(var i = 0, len = list.length; i < len; i++){
					sn = list[i];
					
					if(Folder.isFolder(sn))
						folders.push(sn);
					else{
						res += sn.name;
						res += "\n\n";
						res += sn.body;
						res += "\n\n--\n\n";
					}
				}
				
				for(var i = 0, len = folders.length; i < len; i++)
					res += getSnippetPrintData(folders[i]);
				
				return res;
			}

			$(".panel_popup .close_btn").on("click", function(){
				$(".panel_popup.shown").removeClass("shown");
			});
			
			$(".export-buttons button").on("click", function(){
				$("#snippets .panel_popup." + this.className)
					.addClass("shown");
					
				switch(this.className){
					case "export": showDataForExport(); break;
					case "import": setupImportPopup(); break;
					case "revisions": setUpPastRevisions();
				}
			});
			
			function initiateRestore(data){
				var dataType = $(".import input[name=data_import]:checked").value,
					selectList = $(".import .selectList"),
					selectedFolder = Folder.getSelectedFolderInSelectList(selectList),
					existingSnippets, inputSnippetsJSON, inputSnippets, validation,
					deleteExistingSnippets = $(".import .import_folder_name input").checked;
					
				try{
					data = JSON.parse(data);
				}catch(e){
					alert("Data was of incorrect format! Check console log for error report.");
					return;
				}
				
				inputSnippetsJSON = dataType === "data" ? data.snippets : data;				
				
				validation = validateRestoreData(data, inputSnippetsJSON, dataType);
				
				if(validation !== "true"){
					alert(validation);
					return;
				}
				
				inputSnippets = Folder.fromArray(inputSnippetsJSON);
				
				if(deleteExistingSnippets) selectedFolder.list = [];
				
				Folder.copySnippets(inputSnippets, selectedFolder);
				
/*				console.dir(inputSnippets); console.dir(selectedFolder);
				console.dir(Data.snippets); console.dir(existingSnippets);*/
				if(dataType === "data"){
					existingSnippets = Folder.fromArray(Data.snippets.toArray()); // copied
					Data = data;
					Data.snippets = existingSnippets;
				}
				//console.dir(Data.snippets);
				saveSnippetData(function(){
					alert("Data saved!");/*
					window.location.href = "#snippets";
					window.location.reload();*/
				});
			}
			
			function showDataForExport(){				
				var dataType = $(".export .step:first-child input:checked").value,
					data, dataUse = $(".export .step:nth-child(2) input:checked").value,
					downloadLink = $(".export a"), blob;
				
				if(dataUse === "print"){
					if(dataType === "data"){
						alert("Sorry! Entire data cannot be printed. Only snippets can be printed. Choose \"only snippets\"" + 
								" in the first step if you want to print.");
						return;
					}
					else data = getSnippetPrintData(Data.snippets);
				}
				else {
					// proper stringification requires conversion to array
					Data.snippets = Data.snippets.toArray();
					data = JSON.stringify(dataType === "data" ? Data : Data.snippets, undefined, 2);
					// convert back to normal after work finishes
					Data.snippets = Folder.fromArray(Data.snippets);
				}
				
				blob = new Blob([data], {type: "text/js"});
				
				downloadLink.href = URL.createObjectURL(blob);
				downloadLink.download = (dataUse === "print" ?
											"ProKeys snippets print data" :
											"ProKeys " + dataType)
											+ " " + getFormattedDate() + ".txt";			
			}
			
			$(".export input").on("change", showDataForExport);
			
			function setupImportPopup(){
				var $selectList = $(".import .selectList");
				Folder.refreshSelectList($selectList);				
				fileInputLink.html("Choose file containing data");
			}
			
			$(".import .restore").on("click", function(){				
				if(importFileData) initiateRestore(importFileData);
				else alert("Please select a file above.");
			});
			
			var fileInputLink = $(".import .file_input"),
				$inputFile = fileInputLink.previousElementSibling,
				initialLinkText = fileInputLink.html(),
				importFileData = null;
				
			fileInputLink.on("click", function(e){
				e.preventDefault();
				$inputFile.trigger("click");				
			});
			
			$inputFile.on("change", function(){
				var file = $inputFile.files[0];
				
				if(!file) return false;
				
				var reader = new FileReader();
			
				reader.onload = function(event) {
					importFileData = event.target.result;					
					
					fileInputLink.html("File " + file.name + " is READY:" + 
							" Click Restore button to begin. Click here again to choose another file.");
				};

				reader.onerror = function(event) {
					console.error("File " + importFileData.name + 
							" could not be read! Error " + event.target.error.code);
					fileInputLink.html(initialLinkText);
				};

				reader.readAsText(file);
			
				fileInputLink.html("READING FILE: " + file.name);				
			});
			
			var $resvisionsRestoreBtn = $(".revisions .restore"),
				$textarea = $(".revisions textarea"),
				$select = $(".revisions select"),
				$closeRevisionsPopupBtn = $(".revisions .close_btn"),
				selectedRevision;
			
			function setUpPastRevisions(){
				var revisions = JSON.parse(localStorage[LS_REVISIONS_PROP]);
				
				$select.html("");
				
				revisions.forEach(function(rev){
					$select.appendChild(document.createElement("option").html(rev.label));
				});
				
				function showRevision(){
					selectedRevision = revisions[$select.selectedIndex];
					$textarea.value = JSON.stringify(selectedRevision.data, undefined, 2);
				}
				
				$select.oninput = showRevision;
				showRevision();
			}
		
			$resvisionsRestoreBtn.on("click", function(){				
				try{
					if(confirm("Are you sure you want to use the selected revision?")){
						Data.snippets = Folder.fromArray(JSON.parse($textarea.value));
						deleteRevision($select.selectedIndex);
						latestRevisionLabel = "restored revision (labelled: " + selectedRevision.label + ")";
						saveSnippetData(function(){
							$closeRevisionsPopupBtn.trigger("click");
						});
					}
				}catch(e){
					alert("Data in textarea was invalid. Please try again!");
				}					
			});
		})();

		// prevent exposure of locals
		(function hotKeyWork(){
			// resets hotkey btn to normal state
			function resetHotkeyBtn(){
				changeHotkeyBtn.html("Change hotkey")
					.disabled = false;
			}

			// called onkeyup because keydown gets called
			// multiple if key is held down
			function getKeyCombo(event){
				var arr = [], keycode = event.keyCode,
					// determines if keyCode is valid
					// non-control character
					valid;

				// first element should be the modifiers
				if(event.shiftKey) arr.push("shiftKey");
				else if(event.ctrlKey) arr.push("ctrlKey");
				else if(event.altKey) arr.push("altKey");
				else if(event.metaKey) arr.push("metaKey");

				// below code from
				// http://stackoverflow.com/questions/12467240/determine-if-javascript-e-keycode-is-a-printable-non-control-character
				// http://stackoverflow.com/users/1585400/shmiddty

				// determine if key is non-control key
				valid =
					(keycode > 47 && keycode < 58)   || // number keys
					keycode == 32 || keycode == 13   || // spacebar & return key(s)
					(keycode > 64 && keycode < 91)   || // letter keys
					(keycode > 95 && keycode < 112)  || // numpad keys
					(keycode > 185 && keycode < 193) || // ;=,-./` (in order)
					(keycode > 218 && keycode < 223);   // [\]' (in order)

				if(valid)
					// then push the key also
					arr.push(keycode);

				return valid ? arr : null;
			}

			hotkeyListener.on("keyup", function(event){
				var combo = getKeyCombo(event);

				// can be null if invalid key combo is inputted
				if(combo){
					Data.hotKey = combo.slice(0);

					saveOtherData("Hotkey set to " + getCurrentHotkey(), function(){
						location.href = "#settings";
						location.reload();
					});
				}
				else{
					alert("Setting new hotkey failed!");
					alert("It was missing a key other than ctrl/alt/shift/meta key. Or, it was a key-combo reserved by the Operating System. \
						Or you may try refreshing the page. ");
				}

				resetHotkeyBtn();
			});

			changeHotkeyBtn.on("click", function(){
				this.html("Press new hotkeys")
					.disabled = true; // disable the button

				hotkeyListener.focus();

				// after five seconds, automatically reset the button to default
				setTimeout(resetHotkeyBtn, 5000);
			});
		})();
	}
	
	DB_load(function DBLoadCallback(){
		/* Consider two PCs. Each has local data set.
			When I migrate data on PC1 to sync. The other PC's local data remains.
			And then it overrides the sync storage. The following lines
			manage that*/

		// wrong storage mode
		if(Data.snippets === false){
			// change storage to other type
			changeStorageType();

			DB_load(DBLoadCallback);
		}
		else {
			// if hotkey array is not present initially
			if(typeof Data.hotKey === typeof void 0){
				Data.hotKey = ["shiftKey", 32];
				saveOtherData();
			}
			
			DB_loaded = true;
		}
	});

	var local = "<b>Local</b> - storage only on one's own PC. More storage space than sync",
		localT = "<label for=\"local\"><input type=\"radio\" id=\"local\" data-storagetoset=\"local\"/><b>Local</b></label> - storage only on one's own PC locally. Safer than sync, and has more storage space. Note that on migration from sync to local, data stored on sync across all PCs would be deleted, and transfered into Local storage on this PC only.",
		sync1 = "<label for=\"sync\"><input type=\"radio\" id=\"sync\" data-storagetoset=\"sync\"/><b>Sync</b></label> - select if this is the first PC on which you are setting sync storage",
		sync2 = "<label for=\"sync2\"><input type=\"radio\" id=\"sync2\" data-storagetoset=\"sync\"/><b>Sync</b></label> - select if you have already set up sync storage on another PC and want that PCs data to be transferred here.",
		sync = "<b>Sync</b> - storage synced across all PCs. Offers less storage space compared to Local storage.";

	function setEssentialItemsOnDBLoad(){
		Data.snippets = Folder.fromArray(Data.snippets);
		
		// user updates from 2.7.0 to 3.0.0 or installs extension; set ls prop
		if(!localStorage[LS_REVISIONS_PROP]){
			localStorage[LS_REVISIONS_PROP] = "[]";
			// do not save revision in case of install as
			// saveSnippetData will be called in checkIfFirstTimeUser
			if(Data.visited) saveRevision(Data.snippets.toArray());
			
			// refer github issues#4
			Data.dataUpdateVariable = false;
		}
		
		Folder.setIndices();
		// on load; set checkbox state to user preference
		$("#tabKey").checked = Data.tabKey;

		// now list blocked sites
		listBlockedSites();

		// list auto-insert chars
		listAutoInsertChars();

		// store text for each div
		var	textMap = {
				"local": [local, sync1 + "<br>" + sync2],
				"sync": [sync, localT]
			},
			currArr = textMap[getCurrentStorageType()];
			
		$(".storageMode .current p").html(currArr[0]);
		$(".storageMode .transfer p").html(currArr[1]);

		// display current hotkey combo
		$(".hotkey_display").html(getCurrentHotkey());
		
		updateStorageAmount();
		
		// we need to set height of logo
		// equal to width but css can't detect
		// height so we need js hack
		var logo = $(".logo");
		window.onresize = function(){
			logo.style.width = logo.clientHeight + "px";
			Folder.implementChevronInFolderPath();
			//Folder.preventDivLogOverflow();
		};
	}
})();