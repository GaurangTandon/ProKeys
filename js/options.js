/* global isEmpty, isObject, getFormattedDate, checkRuntimeError */
/* global $, getHTML, DualTextbox, OLD_DATA_STORAGE_KEY, OBJECT_NAME_LIMIT */
/* global chrome, DB_loaded, NEW_DATA_STORAGE_KEY, saveSnippetData */
/* global escapeRegExp, Folder, Data, Snip, Generic, $containerFolderPath */
/* global latestRevisionLabel, $containerSnippets, $panelSnippets, debounce */
// above are defined in window. format

// TODO: else if branch in snippet-classes.js has unnecessary semicolon eslint error. Why?
// TODO: latestRevisionLabel is shown read-only on eslint. Why?
(function(){
	"use strict";

	window.onload = init;

	var storage = chrome.storage.local,
		// global functions defined in init
		toggleSnippetEditPanel, toggleFolderEditPanel,
		validateSnippetData, validateFolderData,
		// property name of localStorage item that stores past snippets versions
		LS_REVISIONS_PROP = "prokeys_revisions",
		MAX_REVISIONS_STORED = 20,
		MAX_SYNC_DATA_SIZE = 102400,
		MAX_LOCAL_DATA_SIZE = 5242880,
		$autoInsertTable,
		SHOW_CLASS = "shown",
		$tabKeyInput,
		$snipMatchDelimitedWordInput, $snipNameDelimiterListDIV,
		RESERVED_DELIMITER_LIST = "`~|\\^",
		ORG_DELIMITER_LIST = "@#$%&*+-=(){}[]:\"'/_<>?!., ",
		dualSnippetEditorObj;

	// these variables are accessed by multiple files
	window.DB_loaded = false;
	// currently it's storing default data for first install;
	// after DB_load, it stores the latest data
	// snippets are later added
	window.Data = {
		dataVersion: 1,
		snippets: [], // filled in IIFE below
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
		hotKey: ["shiftKey", 32],
		dataUpdateVariable: true,
		matchDelimitedWord: false,
		snipNameDelimiterList: ORG_DELIMITER_LIST
	};
	window.IN_OPTIONS_PAGE = true;
	window.$containerSnippets = null;
	window.$panelSnippets = null;
	window.$containerFolderPath = null;
	window.latestRevisionLabel = "data created (added defaut snippets)";
	window.OLD_DATA_STORAGE_KEY = "UserSnippets";
	window.NEW_DATA_STORAGE_KEY = "ProKeysUserData";
	window.DATA_KEY_COUNT_PROP = NEW_DATA_STORAGE_KEY + "_-1";

	// stored in global Data variable
	function createBuiltInSnippets(){
		var name = "README-New_UI_Details",
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
						" your clipboard data. Clipboard data includes text that you have previously copied or cut with intention to paste.",
			ts = Date.now(),
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

		Data.snippets = snips;
	}
	
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

		parsed = parsed.slice(0, MAX_REVISIONS_STORED);
		localStorage[LS_REVISIONS_PROP] = JSON.stringify(parsed);
	}

	/**
	 * PRECONDITION: Data.snippets is a Folder object
	 */
	window.saveSnippetData = function(callback, folderNameToList, objectNamesToHighlight){
		Data.snippets = Data.snippets.toArray();

		// refer github issues#4
		Data.dataUpdateVariable = !Data.dataUpdateVariable;

		DB_save(function(){
			saveRevision(Data.snippets.toArray()); 
			notifySnippetDataChanges();

			Folder.setIndices();
			var folderToList = folderNameToList ? 
									Data.snippets.getUniqueFolder(folderNameToList) :
									Data.snippets;
			folderToList.listSnippets(objectNamesToHighlight);

			checkRuntimeError();

			if(callback) callback();
		});

		Data.snippets = Folder.fromArray(Data.snippets);
	};

	// save data not involving snippets
	function saveOtherData(msg, callback){
		Data.snippets = Data.snippets.toArray();

		// github issues#4
		Data.dataUpdateVariable = !Data.dataUpdateVariable;

		DB_save(function(){
			if(typeof msg === "function") msg();
			else if(typeof msg === "string") alert(msg);
			checkRuntimeError();

			if(callback) callback();
		});

		// once DB_save has been called, doesn't matter
		// if this prop is object/array since storage.clear/set
		// methods are using a separate storageObj
		Data.snippets = Folder.fromArray(Data.snippets);
	}

	// function to save data for specific
	// name and value
	function DB_setValue(name, value, callback) {
		var obj = {};
		obj[name] = value;

		storage.set(obj, function() {
			if(callback) callback();
		});
	}

	function DB_load(callback) {
		storage.get(OLD_DATA_STORAGE_KEY, function(r) {
			var req = r[OLD_DATA_STORAGE_KEY];

			if (isEmpty(req) || req.dataVersion != Data.dataVersion)
				DB_setValue(OLD_DATA_STORAGE_KEY, Data, callback);
			else {
				Data = req;
				if (callback) callback();
			}
		});
	}

	function DB_save(callback) {
		DB_setValue(OLD_DATA_STORAGE_KEY, Data, function() {
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

	function listBlockedSites(){
		function getLI(url){
			var li = $.new("li"),
				label = $.new("label"),
				input = $.new("input");
			input.type = "checkbox";
			label.appendChild(input);
			label.appendChild(document.createTextNode(url));
			li.appendChild(label);
			return li;
		}

		var ul = $(".blocked-sites ul"),
			i = 0, len = Data.blockedSites.length;

		// if atleast one blocked site
		if(len > 0) ul.html("").removeClass("empty");
		else{
			ul.html("None Currently").addClass("empty");
			return;
		}

		for(; i < len; i++)
			ul.appendChild(getLI(Data.blockedSites[i]));
	}

	function createTableRow(textArr){
		var tr = $.new("tr");

		for(var i = 0, len = textArr.length; i < len; i++)
			tr.appendChild($.new("td").html(textArr[i]));

		return tr;
	}

	// notifies content script and background page
	// about Data.snippets changes
	function notifySnippetDataChanges(){
		var msg = {snippetList: Data.snippets.toArray()};

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

	function removeAutoInsertChar(autoInsertPair){
		var index = getAutoInsertCharIndex(autoInsertPair[0]);

		Data.charsToAutoInsertUserList.splice(index, 1);

		saveOtherData("Removed auto-insert pair '" + autoInsertPair.join("") + "'",
			listAutoInsertChars);
	}

	function saveAutoInsert(autoInsertPair){
		var firstChar = autoInsertPair[0],
			lastChar = autoInsertPair[1],
			str = "Please type exactly one character in ";

		if(firstChar.length !== 1){
			alert(str + "first field.");
			return;
		}

		if(lastChar.length !== 1){
			alert(str + "second field.");
			return;
		}

		if(getAutoInsertCharIndex(firstChar) !== -1){
			alert("The character \"" + firstChar + "\" is already present.");
			return;
		}

		// first insert in user list
		Data.charsToAutoInsertUserList.push(autoInsertPair);

		saveOtherData("Saved auto-insert pair - " + firstChar + lastChar,
			listAutoInsertChars);
	}

	// inserts in the table the chars to be auto-inserted
	function listAutoInsertChars(){
		var arr = Data.charsToAutoInsertUserList,
			// used to generate table in loop
			thead, tr, i = 0, 
			len = arr.length;

		if(len === 0)
			$autoInsertTable.html("No Auto-Insert pair currently. Add new:");
		else{
			// clear the table initially
			$autoInsertTable.html("");
			thead = $.new("thead");
			tr = $.new("tr");

			tr.appendChild($.new("th").html("Character"));
			tr.appendChild($.new("th").html("Complement"));

			thead.appendChild(tr);

			$autoInsertTable.appendChild(thead);

			for(; i < len; i++)
				// create <tr> with <td>s having text as in current array and Remove
				$autoInsertTable.appendChild(createTableRow(arr[i].concat("Remove")));
		}

		appendInputBoxesInTable();
	}

	function getAutoInsertCharIndex(firstCharToGet){
		var arr = Data.charsToAutoInsertUserList,
			firstChar;

		for(var i = 0, len = arr.length; i < len; i++){
			firstChar = arr[i][0];

			if(firstCharToGet === firstChar)
				return i;
		}

		return -1;
	}

	function appendInputBoxesInTable(){
		function append(elm){
			var td = $.new("td");
			td.appendChild(elm);
			tr.appendChild(td);
		}

		function configureTextInputElm(attribute){
			var inp = 
				$.new("input")
					.addClass(mainClass)
					.attr("placeholder", "Type " + attribute);
			inp.type = "text";

			append(inp);

			inp.onkeydown = function(e){
				if(e.keyCode === 13)
					saveAutoInsert([inp1.value, inp2.value]);
			};

			return inp;
		}

		var mainClass = "char_input",
			tr = $.new("tr"),
			inp1 = configureTextInputElm("new character"),
			inp2 = configureTextInputElm("its complement");

		append($.new("button").html("Save"));

		$autoInsertTable.appendChild(tr);
	}

	var validateRestoreData, initiateRestore;
	(function backUpDataValidationFunctions(){
		var duplicateSnippetToKeep, typeOfData;

		function validateSnippetsFolder(arr){
			if(typeof arr[0] !== "string"){ // possibly before 300 version
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
					"name": Snip.isValidName
				}, checkFunc, snippetVld,
				// counter to make sure no extra properties
				propCounter, prop, propVal,
				snippetUnderFolderString;

			if(typeof folderName !== "string")
				return "Folder name " + folderName + " is not a string.";

			folderVld = Folder.isValidName(folderName);

			if(folderVld !== "true" && 
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

		// duplicateSnippetToKeep - one of "existing", "imported", "both"
		function handleDuplicatesInSnippets(inputFolder, shouldMergeDuplicateFolderContents){
			var stringToAppendToImportedObject = "(1)";
			handler(inputFolder);

			function both(object){
				var objectNameLen = object.name.length;

				if(objectNameLen <= OBJECT_NAME_LIMIT - stringToAppendToImportedObject.length)
					object.name += stringToAppendToImportedObject;
				else object.name = 
						object.name.substring(0, objectNameLen - 3) + 
							stringToAppendToImportedObject;
			}

			function handler(inputFolder){
				var removeIdxs = [];

				inputFolder.list.forEach(function(object, idx){
					if(handleSingleObject(object))
						removeIdxs.push(idx);
				});

				var len = removeIdxs.length - 1;
				while(len >= 0)
					inputFolder.list.splice(removeIdxs[len--], 1);
			}

			function handleSingleObject(importedObj){
				var duplicateObj = Data.snippets.getUniqueObject(importedObj.name, importedObj.type),
					shouldDeleteImportedObject = false,
					shouldKeepBothFolders = duplicateSnippetToKeep === "both";

				if(duplicateObj){
					switch(duplicateSnippetToKeep){
						case "both":
							both(importedObj); break;
						case "imported":
							duplicateObj.remove(); break;
						case "existing":
							shouldDeleteImportedObject = true;
					}
				}

				if(Folder.isFolder(importedObj)){
					handler(importedObj);

					// have to merge non-duplicate contents of
					// duplicate folders
					if(duplicateObj &&
						!shouldKeepBothFolders && shouldMergeDuplicateFolderContents)
						// first we had corrected all the contents of fromFolder (deletedFolder)
						// by calling handler and then moved
						// the corrected contents to toFolder (keptFolder)
						if(duplicateSnippetToKeep === "imported"){
							Folder.copyContents(duplicateObj, importedObj);
						}
						else Folder.copyContents(importedObj, duplicateObj);
				}

				return shouldDeleteImportedObject;
			}
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

		initiateRestore = function(data){
			var selectList = $(".import .selectList"),
				selectedFolder = Folder.getSelectedFolderInSelectList(selectList),
				existingSnippets, inputSnippetsJSON, inputSnippets, validation,
				$deleteExistingSnippetsInput = $(".import .delete_existing"),
				shouldDeleteExistingSnippets = $deleteExistingSnippetsInput.checked,
				shouldMergeDuplicateFolderContents = $(".import input[name=merge]").checked;

			duplicateSnippetToKeep = $(".import input[name=duplicate]:checked").value;

			try{
				data = JSON.parse(data);
			}catch(e){
				alert("Data was of incorrect format! Please close this box and check console log (Ctrl+Shift+J/Cmd+Shift+J) for error report. And mail it to us at prokeys.feedback@gmail.com to be resolved.");
				console.log(e.message);
				return;
			}

			typeOfData = Array.isArray(data) ? "snippets" : "data";

			inputSnippetsJSON = typeOfData === "data" ? data.snippets : data;

			validation = validateRestoreData(data, inputSnippetsJSON);

			if(validation !== "true"){
				alert(validation);
				return;
			}

			inputSnippets = Folder.fromArray(inputSnippetsJSON);

			if(shouldDeleteExistingSnippets) selectedFolder.list = [];

			// handling duplicates requires correct indexes
			Folder.setIndices();

			handleDuplicatesInSnippets(inputSnippets, shouldMergeDuplicateFolderContents);

			Folder.copyContents(inputSnippets, selectedFolder);

			if(typeOfData === "data"){
				existingSnippets = Folder.fromArray(Data.snippets.toArray()); // copied
				Data = data;
				Data.snippets = existingSnippets;
			}

			saveSnippetData(function(){
				if(confirm("Data saved! Reload the page for changes to take effect?"))
					window.location.reload();
			});
		};

		// receives data object and checks whether
		// it has only those properties which are required
		// and none other
		validateRestoreData = function(data, snippets){
			function setPropIfUndefined(name){
				if(typeof data[name] === "undefined")
					data[name] = name === "snipNameDelimiterList" ? 
								ORG_DELIMITER_LIST : false;
			}

			// if data is of pre-3.0.0 times
			// it will not have folders and everything
			var snippetsValidation = validateSnippetsFolder(snippets);

			if(snippetsValidation !== "true") return snippetsValidation;

			// all the checks following this line should be of "data" type
			if(typeOfData !== "data") return "true";

			var propCount = 0,
				// the list of the correct items
				correctProps = ["blockedSites", "charsToAutoInsertUserList", "dataVersion",
						"language", "snippets", "tabKey", "visited", "hotKey", "dataUpdateVariable",
						"matchDelimitedWord", "snipNameDelimiterList"],
				msg = "Data had invalid property: ";

			// ensure backwards compatibility
			data.dataUpdateVariable = false; // #backwardscompatibility
			setPropIfUndefined("matchDelimitedWord");// #backwardscompatibility
			setPropIfUndefined("snipNameDelimiterList");// #backwardscompatibility

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
							data[prop] = "English";
							break;
						case "dataVersion":
							data[prop] = 1;
							break;
						case "visited":
						case "dataUpdateVariable":
							data[prop] = prop === "visited" ? true : false;
							break;
						case "matchDelimitedWord":
						case "tabKey":
							if(typeof data[prop] !== "boolean")
								data[prop] = false;
							break;
						case "snipNameDelimiterList":
							if(typeof data[prop] !== "string")
								data[prop] = ORG_DELIMITER_LIST;
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
	function migrateData(transferData, callback){
		function afterMigrate(){
			Data.snippets = Folder.fromArray(Data.snippets);
			callback();
		}
		var str = Data.snippets.toArray(); // maintain a copy

		// make current storage unusable
		// so that storage gets changed by DB_load
		Data.snippets = false;

		DB_save(function(){
			changeStorageType();

			if(transferData){
				// get the copy
				Data.snippets = str;
				DB_save(afterMigrate);
			}
			// don't do Data.snippets = Folder.fromArray(Data.snippets);
			// here since Data.snippets is false and since this is 
			// the sync2 option, we need to retain the data that user had
			// previously synced on another PC
			else callback();
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

		return function(object, isSavingSnippet){
			var	headerSpan = $panel.querySelector(".header span"),
				nameElm = $panel.querySelector(".name input"),
				folderElm = $panel.querySelector(".folderSelect .selectList"),
				folderPathElm = $panelSnippets.querySelector(".folder_path :nth-last-child(2)"),
				// boolean to tell if call is to edit existing snippet/folder
				// or create new snippet
				isEditing = !!object,
				isSnip = type == "snip";

			$panelSnippets.toggleClass(SHOW_CLASS);
			$panel.toggleClass(SHOW_CLASS);
			if(isEditing) $panel.removeClass("creating-new");
			else $panel.addClass("creating-new");

			/* cleanup  (otherwise abnormal rte swap alerts are received from 
					userAllowsToLoseFormattingOnSwapToTextarea method when we
					later would load another snippet)*/
			dualSnippetEditorObj.setPlainText("").setRichText("");

			// had clicked the tick btn
			if(isSavingSnippet)	return;

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

			$(".error").removeClass(SHOW_CLASS);

			// defaults
			if(!isEditing)
				object = {name: "", body: ""};

			nameElm.text(object.name).focus();
			nameElm.dataset.name = object.name;
			if(isSnip){
				dualSnippetEditorObj.switchToDefaultView(object.body)
									.setShownText(object.body);
			}
		};
	}

	// things common to snip and folder
	function commonValidation(panelName){
		var panel = $(".panel_" + panelName + "_edit");

		function manipulateElmForValidation(elm, validateFunc, errorElm){
			var text = elm ? elm.value : dualSnippetEditorObj.getShownTextForSaving(),
				textVld = validateFunc(text),
				isTextValid = textVld === "true",
				textErrorElm = errorElm || elm.nextElementSibling;
			
			// when we are editing snippet/folder it does
			// not matter if the name remains same
			if(textVld === Generic.getDuplicateObjectsText(text, panelName)
					&& elm.dataset.name === text)
				isTextValid = true;

			if(!isTextValid){
				textErrorElm
					.addClass(SHOW_CLASS)
					.html(textVld);
			}
			else textErrorElm.removeClass(SHOW_CLASS);

			return [text, isTextValid];
		}

		return function(callback){
			var	nameElm = panel.querySelector(".name input"), name,
				selectList = panel.querySelector(".selectList"),
				folder = Folder.getSelectedFolderInSelectList(selectList),
				isSnippet = /snip/.test(panel.className), body;

			if(isSnippet){
				name = manipulateElmForValidation(nameElm, Snip.isValidName);
				body = manipulateElmForValidation(undefined, Snip.isValidBody,
					panel.querySelector(".body .error"));
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
				return parseFloat((bytes / lim).toFixed(DECIMAL_PLACES_TO_SHOW)) + suffixes[i];
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
		// initialized here; but used in snippet_classes.js
		$containerFolderPath = $("#snippets .panel_snippets .folder_path");
		$panelSnippets = $(".panel_snippets");
		$snipMatchDelimitedWordInput = $(".snippet_match_whole_word input[type=checkbox]");
		$tabKeyInput = $("#tabKey");
		$snipNameDelimiterListDIV = $(".delimiter_list");

		if(!DB_loaded){
			setTimeout(DB_load, 100, DBLoadCallback); return;
		}
		//console.log(Data.snippets);

		// should only be called when DB has loaded
		// and page has been initialized
		setEssentialItemsOnDBLoad();

		var changeHotkeyBtn = $(".change_hotkey"),
			hotkeyListener = $(".hotkey_listener");

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
				this.toggleClass("show");
			});

			// the tryit editor in Help section
			new DualTextbox($("#tryit"), true)
				.setPlainText("You can experiment with various ProKeys' features in this interactive editor! This editor is resizable.\n\n\
Textarea is the normal text editor mode. No support for bold, italics, etc. But multiline text is supported.\n\
Think Notepad.")
				.setRichText("This is a contenteditable or editable div. \
These editors are generally found in your email client like Gmail, Outlook, etc.<br><br><i>This editor \
<u>supports</u></i><b> HTML formatting</b>. You can use the \"my_sign\" sample snippet here, and see the effect.");
		})();

		(function settingsPageHandlers(){
			var $unblockBtn = $(".blocked-sites .unblock"),
				$delimiterCharsInput = $(".delimiter_list input"),
				$delimiterCharsResetBtn = $(".delimiter_list button");

			// on user input in tab key setting
			$tabKeyInput.on("change", function(){
				Data.tabKey	= this.checked;

				saveOtherData("Saved!");
			});

			$("#settings .siteBlockInput").on("keyup", function(event){
				if(event.keyCode === 13) blockSite.call(this);
			});

			$unblockBtn.on("click", function(){
				function getURL(elm){
					return elm.nextSibling.textContent;
				}

				var str = "Are you sure you want to unblock - ",
					$selectedCheckboxes = $(".blocked-sites ul input:checked"),
					l = $selectedCheckboxes.length,
					sites, index;

				sites = l === 1 ? [getURL($selectedCheckboxes)] :
						$selectedCheckboxes.map(getURL);

				if(l === 0) alert("Please select at least one site using the checkboxes.");
				else if(confirm(str + sites.join(", ") + "?")){
					for(var i = 0; i < l; i++){
						index = Data.blockedSites.indexOf(sites[i]);

						Data.blockedSites.splice(index, 1);
					}

					saveOtherData(listBlockedSites);
				}
			});

			function getAutoInsertPairFromSaveInput(node){
				var $clickedTR = node.parentNode.parentNode;
				return $clickedTR.querySelectorAll(".char_input")
							.map(function(e){return e.value;});
			}

			function getAutoInsertPairFromRemoveInput(node){
				var $clickedTR = node.parentNode;
				return $clickedTR.querySelectorAll("td")
							// slice to exclude Remove button
							.map(function(e){return e.innerText;}).slice(0, 2);
			}

			$autoInsertTable.on("click", function(e){
				var node = e.target;

				if(node.tagName === "BUTTON")
					saveAutoInsert(getAutoInsertPairFromSaveInput(node));
				else if(getHTML(node) === "Remove")
					removeAutoInsertChar(getAutoInsertPairFromRemoveInput(node));
			});

			$snipMatchDelimitedWordInput.on("change", function(){
				var isChecked = this.checked;
				Data.matchDelimitedWord = isChecked;
				$snipNameDelimiterListDIV.toggleClass(SHOW_CLASS);
				saveOtherData("Data saved!");
			});

			function validateDelimiterList(stringList){
				var i = 0, len = RESERVED_DELIMITER_LIST.length, reservedDelimiter; 
				for(; i < len; i++){
					reservedDelimiter = RESERVED_DELIMITER_LIST.charAt(i);
					if(stringList.match(escapeRegExp(reservedDelimiter)))
						return reservedDelimiter;
				}

				return true;
			}

			$delimiterCharsInput.on("keyup", function(e){
				if(e.keyCode === 13){
					var vld = validateDelimiterList(this.value);
					if(vld !== true){
						alert("Input list contains reserved delimiter \"" + vld + "\". Please remove it from the list. Thank you!");
						return true;
					}
					Data.snipNameDelimiterList = this.value;
					saveOtherData("Data saved!");
				}
			});

			$delimiterCharsResetBtn.on("click", function(){
				if(confirm("Are you sure you want to replace the current list with the default delimiter list?")){
					Data.snipNameDelimiterList = ORG_DELIMITER_LIST;
					delimiterInit();
					saveOtherData("Data saved!");
				}
			});

			delimiterInit();

			function delimiterInit(){
				$delimiterCharsInput.value = Data.snipNameDelimiterList;
			}
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
			
			toggleSnippetEditPanel = editPanel(Generic.SNIP_TYPE);
			toggleFolderEditPanel = editPanel(Generic.FOLDER_TYPE);
			validateSnippetData = commonValidation(Generic.SNIP_TYPE);
			validateFolderData = commonValidation(Generic.FOLDER_TYPE);

			dualSnippetEditorObj = new DualTextbox($("#body-editor"));

			/**
			 * Delegated handler for edit, delete, clone buttons
			 */
			$containerSnippets.on("click", function(e){
				var node = e.target,
					container = node.parentNode,
					objectElm = container.parentNode, obj;

				if(!objectElm || !/buttons/.test(container.className)) return true;

				if(node.matches("#snippets .panel_content .edit_btn")){
					obj = Folder.getObjectThroughDOMListElm(objectElm);
					if(Folder.isFolder(obj)) toggleFolderEditPanel(obj);
					else toggleSnippetEditPanel(obj);
				}
				else if(node.matches("#snippets .panel_content .delete_btn"))
					deleteOnClick.call(objectElm);
				else if(node.matches("#snippets .panel_content .clone_btn"))
					cloneBtnOnClick.call(objectElm);				
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
				$panel.removeClass(SHOW_CLASS);
				$panelSnippets.addClass(SHOW_CLASS);
			});

			/**
			 * 
			 * @param {String} type NOT the Generic type, but rather "Snip"/"Folder" instead
			 */
			function objectSaver(type){
				return function(oldName, name, body, newParentfolder){
					var object, oldParentFolder, timestamp, movedObject;

					if(oldName) {
						object = Data.snippets["getUnique" + type](oldName);
						oldParentFolder = object.getParentFolder();
						timestamp = object.timestamp;

						if(newParentfolder.name !== oldParentFolder.name) {
							// first move that object; before changing its name/body
							movedObject = object.moveTo(newParentfolder);
							
							movedObject.name = name;
							if(type === "Snip") movedObject.body = body;
							
							latestRevisionLabel = "moved \"" + name + "\" " + movedObject.type + " to \"" + newParentfolder.name + "\"";
							saveSnippetData(undefined, newParentfolder.name, name);
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

			function deleteOnClick(){
				var object = Folder.getObjectThroughDOMListElm(this),
					name = object.name, type = object.type,
					isSnip = type === Generic.SNIP_TYPE,
					warning = isSnip ? "" : " (and ALL its contents)",
					object, folder;

				if(confirm("Delete '" + name + "' " + type + warning + "?")){
					folder = object.getParentFolder();

					object.remove();
					this.parentNode.removeChild(this);

					latestRevisionLabel = "deleted " + type + " \"" + name + "\"";

					saveSnippetData(undefined, folder.name);
				}
			}

			function cloneBtnOnClick(){
				var object = Folder.getObjectThroughDOMListElm(this),
					newObject = object.clone();
				latestRevisionLabel = "cloned " + object.type + " \"" + object.name + "\"";

				// keep the same snippet highlighted as well (object.name)
				// so that user can press clone button repeatedly
				saveSnippetData(undefined, newObject.getParentFolder().name, [object.name, newObject.name]);
			}

			$selectList.on("click", function(e){
				var node = e.target, classSel = "selected", 
					others, $containerDIV, collapsedClass = "collapsed";

				if(node.tagName === "P"){
					// do not use $selectList
					// as it is a NodeList
					$containerDIV = node.parentNode;
					$containerDIV.toggleClass(collapsedClass);

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
				if(!panel.hasClass(SHOW_CLASS)) panel.addClass(SHOW_CLASS);
				if(existingPanel) existingPanel.removeClass(SHOW_CLASS);

				var existingBtn = $(".panel_btn.active");
				if(!btn.hasClass("active"))	btn.addClass("active");
				if(existingBtn)	existingBtn.removeClass("active");

				// we need these checks as another might have been clicked
				// to remove the search/checkbox panel and so we need to remove
				// their type of list
				if(!$searchPanel.hasClass(SHOW_CLASS) &&
					Folder.getListedFolder().isSearchResultFolder)
					Data.snippets.listSnippets();

				// if checkbox style list is still shown
				if($containerSnippets.querySelector("input[type=\"checkbox\"]") &&
					!$bulkActionPanel.hasClass(SHOW_CLASS))
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
				if(!$searchPanel.hasClass(SHOW_CLASS))
					Folder.getListedFolder().listSnippets();
			});

			$searchBtn.attr("title", "Search for folders or snips");
			$searchField.on("keyup", debounce(function searchFieldHandler(){
				var searchText = this.value,
					listedFolder = Folder.getListedFolder(),
					searchResult = listedFolder.searchSnippets(searchText);

				searchResult.listSnippets();
			}, 150));

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

					if($bulkActionPanel.hasClass(SHOW_CLASS)){
						originalShownFolderName = Folder.getListedFolderName();
						originalShownFolder = Data.snippets.getUniqueFolder(originalShownFolderName);
						DOMcontainer = Folder.insertBulkActionDOM(originalShownFolder);

						$bulkActionPanel.dataset.originalShownFolderName = originalShownFolderName;

						DOMcontainer.on("click", function(){
							// watching clicks on checkbox and div.name is resource intensive
							// so just update count every time anywhere you click
							updateSelectionCount(DOMcontainer);
						});

						updateSelectionCount();
						folderSelect.removeClass(SHOW_CLASS);
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

					if(!folderSelect.hasClass(SHOW_CLASS)){
						Folder.refreshSelectList(selectList);
						folderSelect.addClass(SHOW_CLASS);
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
												" objects to folder \"" + selectFolderName + "\"";

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

			(function checkIfFirstTimeUser(){
				var $button = $(".change-log button"),
					$changeLog = $(".change-log"),
					// ls set by background page
					isUpdate = localStorage.extensionUpdated === "true";

				if(isUpdate){
					$changeLog.addClass(SHOW_CLASS);

					$button.on("click", function(){
						$changeLog.removeClass(SHOW_CLASS);
						localStorage.extensionUpdated = "false";
					});
				}
			})();

			Data.snippets.listSnippets();

			/* executed in the very end since saveOtherData async and 
				stringifies data.snippets*/
			// till now, we don't have any use for data.visited
			// variable in any file; but still keeping it just in case
			// it comes handy later
			var isFreshInstall = !Data.visited;
			if(isFreshInstall){
				Data.visited = true;
				saveOtherData();
			}
		})();

		(function storageModeWork(){
			// boolean parameter transferData: dictates if one should transfer data or not
			function storageRadioBtnClick(str, transferData){
				if(!confirm("Migrate data to " + str + " storage? It is VERY NECESSARY to take a BACKUP before proceeding.")){
					this.checked = false; return; }

				storage.getBytesInUse(function(bytesInUse){
					if(getCurrentStorageType() === "local" && 
						bytesInUse > MAX_SYNC_DATA_SIZE){
						alert("You are currently using " + bytesInUse + " bytes of data; while sync storage only permits a maximum of " + MAX_SYNC_DATA_SIZE + " bytes.\n\nPlease reduce the size of data (by deleting, editing, exporting snippets) you're using to migreate to sync storage successfully.");
					}
					else{
						migrateData(transferData, function(){
							alert("Done! Data migrated to " + str + " storage successfully!");
							location.reload();
						});
					}
				});
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
				i = 0; len = folders.length;
				for(; i < len; i++)
					res += getSnippetPrintData(folders[i]);

				return res;
			}

			$(".panel_popup .close_btn").on("click", function(){
				$(".panel_popup.shown").removeClass(SHOW_CLASS);
			});

			$(".export-buttons button").on("click", function(){
				$("#snippets .panel_popup." + this.className)
					.addClass(SHOW_CLASS);

				switch(this.className){
					case "export": showDataForExport(); break;
					case "import": setupImportPopup(); break;
					case "revisions": setUpPastRevisions();
				}
			});

			function showDataForExport(){
				var data, dataUse = $(".export .steps :first-child input:checked").value,
					downloadLink = $(".export a"), blob;

				if(dataUse === "print") data = getSnippetPrintData(Data.snippets);
				else {
					Data.snippets = Data.snippets.toArray();
					data = JSON.stringify(dataUse === "data" ? Data : Data.snippets, undefined, 2);
					Data.snippets = Folder.fromArray(Data.snippets);
				}

				blob = new Blob([data], {type: "text/js"});

				downloadLink.href = URL.createObjectURL(blob);
				downloadLink.download = (dataUse === "print" ?
											"ProKeys print snippets" :
											"ProKeys " + dataUse)
											+ " " + getFormattedDate() + ".txt";
			}

			$(".export input").on("change", showDataForExport);

			function setupImportPopup(){
				var $selectList = $(".import .selectList");
				Folder.refreshSelectList($selectList);
				fileInputLink.html("Choose file containing data");
				// reset so that if same file is selected again,
				// onchange can still fire
				$inputFile.value = "";
			}

			$(".import .restore").on("click", function(){
				if(importFileData) initiateRestore(importFileData);
				else alert("Please choose a file.");
			});

			var fileInputLink = $(".import .file_input"),
				$inputFile = fileInputLink.nextElementSibling,
				initialLinkText = fileInputLink.html(),
				importFileData = null;

			$inputFile.on("change", function(){
				var file = $inputFile.files[0];

				if(!file) return false;

				var reader = new FileReader();

				reader.onload = function(event) {
					importFileData = event.target.result;

					fileInputLink.html("File '" + file.name + "' is READY." + 
							" Click Restore button to begin. Click here again to choose another file.");
				};

				reader.onerror = function(event) {
					console.error("File '" + importFileData.name + 
							"' could not be read! Please send following error to prokeys.feedback@gmail.com " + 
							" so that I can fix it. Thanks! ERROR: "
							+ event.target.error.code);
					fileInputLink.html(initialLinkText);
				};

				reader.readAsText(file);

				fileInputLink.html("READING FILE: " + file.name);
			});

			var $resvisionsRestoreBtn = $(".revisions .restore"),
				$textarea = $(".revisions textarea"),
				$select = $(".revisions select"),
				$closeRevisionsPopupBtn = $(".revisions .close_btn"),
				$preserveCheckboxesLI = $(".import .preserve_checkboxes"),
				$mergeDuplicateFolderContentsInput = $preserveCheckboxesLI.querySelector("[name=merge]"),
				$preserveExistingContentInput = $preserveCheckboxesLI.querySelector("[value=existing]"),
				$preserveImportedContentInput = $preserveCheckboxesLI.querySelector("[value=imported]"),
				$caveatParagraph = $preserveCheckboxesLI.querySelector("p"),
				selectedRevision;

			function setUpPastRevisions(){
				var revisions = JSON.parse(localStorage[LS_REVISIONS_PROP]);

				$select.html("");

				revisions.forEach(function(rev){
					$select.appendChild($.new("option").html(rev.label));
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
					alert("Data in textarea was invalid. Close this box and check console log (Ctrl+Shift+J/Cmd+Shift+J) for error report. Or please try again!");
				}
			});

			$preserveCheckboxesLI.on("click", function(){
				if(!$mergeDuplicateFolderContentsInput.checked){
					if($preserveExistingContentInput.checked)
						$caveatParagraph.html("<b>Caveat</b>: Unique content of " + 
										"folders with the same name will not be imported.");
					else if($preserveImportedContentInput.checked)
						$caveatParagraph.html("<b>Caveat</b>: Unique content of existing folders " + 
											"with the same name will be lost.");
					else $caveatParagraph.html("");
				}
				else $caveatParagraph.html("");
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

	function DBLoadCallback(){
		/* Consider two PCs. Each has local data set.
			When I migrate data on PC1 to sync. The other PC's local data remains.
			And then it overrides the sync storage. The following lines
			manage that*/
		//console.dir(Data.snippets);
		// wrong storage mode
		if(Data.snippets === false){
			// change storage to other type
			changeStorageType();

			DB_load(DBLoadCallback);
		}
		else {DB_loaded = true;init();}
	}

	var local = "<b>Local</b> - storage only on one's own PC. More storage space than sync",
		localT = "<label for=\"local\"><input type=\"radio\" id=\"local\" data-storagetoset=\"local\"/><b>Local</b></label> - storage only on one's own PC locally. Safer than sync, and has more storage space. Note that on migration from sync to local, data stored on sync across all PCs would be deleted, and transfered into Local storage on this PC only.",
		sync1 = "<label for=\"sync\"><input type=\"radio\" id=\"sync\" data-storagetoset=\"sync\"/><b>Sync</b></label> - select if this is the first PC on which you are setting sync storage",
		sync2 = "<label for=\"sync2\"><input type=\"radio\" id=\"sync2\" data-storagetoset=\"sync\"/><b>Sync</b></label> - select if you have already set up sync storage on another PC and want that PCs data to be transferred here.",
		sync = "<b>Sync</b> - storage synced across all PCs. Offers less storage space compared to Local storage.";
	
	function setEssentialItemsOnDBLoad(){		
		// issues#111
		Data.matchDelimitedWord = Data.matchDelimitedWord || false;
		Data.snipNameDelimiterList = Data.snipNameDelimiterList || ORG_DELIMITER_LIST;		
				
		// user installs extension; set ls prop	
		var firstInstall = !localStorage[LS_REVISIONS_PROP];
		if(firstInstall){
			// refer github issues#4
			Data.dataUpdateVariable = !Data.dataUpdateVariable;
			createBuiltInSnippets();
			localStorage[LS_REVISIONS_PROP] = "[]";
			saveRevision(Data.snippets);			
		}
		
		if(!isObject(Data.snippets))
			Data.snippets = Folder.fromArray(Data.snippets);
		
		// save the default snippets ONLY
		if(firstInstall) saveSnippetData();
		
		Folder.setIndices();
		
		// on load; set checkbox state to user preference
		$tabKeyInput.checked = Data.tabKey;
		$snipMatchDelimitedWordInput.checked = Data.matchDelimitedWord;

		if(Data.matchDelimitedWord)
			$snipNameDelimiterListDIV.addClass(SHOW_CLASS);

		listBlockedSites();

		$autoInsertTable = $(".auto_insert");
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

		// we need to set height of logo equal to width
		// but css can't detect height so we need js hack
		var logo = $(".logo");
		window.onresize = debounce(function windowResizeHandler(){
			logo.style.width = logo.clientHeight + "px";
			Folder.implementChevronInFolderPath();
		}, 300);
	}
})();