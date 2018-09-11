/* global q, Q, DualTextbox, pk, Data */
/* global qClsSingle, qCls, qId */
/* global chrome, saveSnippetData, debugDir */
/* global Folder, Snip, Generic, $containerFolderPath */
/* global latestRevisionLabel, $containerSnippets, $panelSnippets */
// above are defined in window. format

// TODO: else if branch in snippet-classes.js has unnecessary semicolon eslint error. Why?
// TODO: latestRevisionLabel is shown read-only on eslint. Why?
(function() {
	"use strict";

	window.on("load", init);

	var storage = chrome.storage.local,
		VERSION = chrome.runtime.getManifest().version,
		SETTINGS_DEFAULTS = {
			snippets: Folder.getDefaultSnippetData(),
			blockedSites: [],
			charsToAutoInsertUserList: [["(", ")"], ["{", "}"], ["\"", "\""], ["[", "]"]],
			dataVersion: 1,
			language: "English",
			hotKey: ["shiftKey", 32],
			dataUpdateVariable: true,
			matchDelimitedWord: false,
			tabKey: false,
			visited: false,
			snipNameDelimiterList: "@#$%&*+-=(){}[]:\"'/_<>?!., ",
			omniboxSearchURL: "https://www.google.com/search?q=SEARCH",
			wrapSelectionAutoInsert: true
		},
		// global functions defined in init
		toggleSnippetEditPanel,
		toggleFolderEditPanel,
		validateSnippetData,
		validateFolderData,
		LS_REVISIONS_PROP = "prokeys_revisions",
		MAX_REVISIONS_STORED = 20,
		MAX_SYNC_DATA_SIZE = 102400,
		MAX_LOCAL_DATA_SIZE = 5242880,
		$autoInsertTable,
		SHOW_CLASS = "shown",
		$tabKeyInput,
		$snipMatchDelimitedWordInput,
		$snipNameDelimiterListDIV,
		RESERVED_DELIMITER_LIST = "`~|\\^",
		dualSnippetEditorObj,
		autoInsertWrapSelectionInput,
		omniboxSearchURLInput,
		$blockSitesTextarea;

	// these variables are accessed by multiple files
	pk.DB_loaded = false;
	// currently it's storing default data for first install;
	// after DB_load, it stores the latest data
	// snippets are later added
	window.Data = JSON.parse(JSON.stringify(SETTINGS_DEFAULTS));
	window.IN_OPTIONS_PAGE = true;
	window.$containerSnippets = null;
	window.$panelSnippets = null;
	window.$containerFolderPath = null;
	window.latestRevisionLabel = "data created (added defaut snippets)";
	pk.OLD_DATA_STORAGE_KEY = "UserSnippets";
	pk.NEW_DATA_STORAGE_KEY = "ProKeysUserData";
	pk.DATA_KEY_COUNT_PROP = pk.NEW_DATA_STORAGE_KEY + "_-1";

	// when we restore one revision, we have to remove it from its
	// previous position; saveSnippetData will automatically insert it
	// back at the top of the list again
	function deleteRevision(index) {
		var parsed = JSON.parse(localStorage[LS_REVISIONS_PROP]);

		parsed.splice(index, 1);
		localStorage[LS_REVISIONS_PROP] = JSON.stringify(parsed);
	}

	function saveRevision(dataString) {
		var parsed = JSON.parse(localStorage[LS_REVISIONS_PROP]);

		parsed.unshift({
			// push latest revision
			label: Date.getFormattedDate() + " - " + latestRevisionLabel,
			data: dataString || Data.snippets
		});

		parsed = parsed.slice(0, MAX_REVISIONS_STORED);
		localStorage[LS_REVISIONS_PROP] = JSON.stringify(parsed);
	}

	/**
     * PRECONDITION: Data.snippets is a Folder object
     */
	window.saveSnippetData = function(callback, folderNameToList, objectNamesToHighlight) {
		Data.snippets = Data.snippets.toArray();

		// refer github issues#4
		Data.dataUpdateVariable = !Data.dataUpdateVariable;

		DB_save(function() {
			saveRevision(Data.snippets.toArray());
			notifySnippetDataChanges();

			Folder.setIndices();
			var folderToList = folderNameToList ? Data.snippets.getUniqueFolder(folderNameToList) : Data.snippets;
			folderToList.listSnippets(objectNamesToHighlight);

			pk.checkRuntimeError();

			if (callback) callback();
		});

		Data.snippets = Folder.fromArray(Data.snippets);
	};

	// save data not involving snippets
	function saveOtherData(msg, callback) {
		Data.snippets = Data.snippets.toArray();

		// github issues#4
		Data.dataUpdateVariable = !Data.dataUpdateVariable;

		DB_save(function() {
			if (typeof msg === "function") msg();
			else if (typeof msg === "string") alert(msg);
			pk.checkRuntimeError();

			if (callback) callback();
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
			if (callback) callback();
		});
	}

	function DB_load(callback) {
		storage.get(pk.OLD_DATA_STORAGE_KEY, function(r) {
			var req = r[pk.OLD_DATA_STORAGE_KEY];

			if (pk.isObjectEmpty(req) || req.dataVersion != Data.dataVersion) DB_setValue(pk.OLD_DATA_STORAGE_KEY, Data, callback);
			else {
				Data = req;
				if (callback) callback();
			}
		});
	}

	function DB_save(callback) {
		DB_setValue(pk.OLD_DATA_STORAGE_KEY, Data, function() {
			if (callback) callback();
		});
	}

	// returns whether site is blocked by user
	function isBlockedSite(domain) {
		var arr = Data.blockedSites;

		for (var i = 0, len = arr.length; i < len; i++) {
			var str = arr[i],
				regex = new RegExp("^" + pk.escapeRegExp(domain));

			if (regex.test(str)) return true;
		}

		return false;
	}

	function listBlockedSites() {
		$blockSitesTextarea.value = Data.blockedSites.join("\n");
	}

	function createTableRow(textArr) {
		var tr = q.new("tr");

		for (var i = 0, len = textArr.length; i < len; i++) tr.appendChild(q.new("td").html(textArr[i]));

		return tr;
	}

	// notifies content script and background page
	// about Data.snippets changes
	function notifySnippetDataChanges() {
		var msg = {
			snippetList: Data.snippets.toArray()
		};

		chrome.tabs.query({}, function(tabs) {
			var tab;

			for (var i = 0, len = tabs.length; i < len; i++) {
				tab = tabs[i];
				if (!tab || !tab.id) continue;

				chrome.tabs.sendMessage(tab.id, msg);
			}
		});

		chrome.extension.sendMessage(msg);
	}

	function removeAutoInsertChar(autoInsertPair) {
		var index = getAutoInsertCharIndex(autoInsertPair[0]);

		Data.charsToAutoInsertUserList.splice(index, 1);

		saveOtherData("Removed auto-insert pair '" + autoInsertPair.join("") + "'", listAutoInsertChars);
	}

	function saveAutoInsert(autoInsertPair) {
		var firstChar = autoInsertPair[0],
			lastChar = autoInsertPair[1],
			str = "Please type exactly one character in ";

		if (firstChar.length !== 1) {
			alert(str + "first field.");
			return;
		}

		if (lastChar.length !== 1) {
			alert(str + "second field.");
			return;
		}

		if (getAutoInsertCharIndex(firstChar) !== -1) {
			alert("The character \"" + firstChar + "\" is already present.");
			return;
		}

		// first insert in user list
		Data.charsToAutoInsertUserList.push(autoInsertPair);

		saveOtherData("Saved auto-insert pair - " + firstChar + lastChar, listAutoInsertChars);
	}

	// inserts in the table the chars to be auto-inserted
	function listAutoInsertChars() {
		var arr = Data.charsToAutoInsertUserList,
			// used to generate table in loop
			thead,
			tr,
			i = 0,
			len = arr.length;

		if (len === 0) $autoInsertTable.html("No Auto-Insert pair currently. Add new:");
		else {
			// clear the table initially
			$autoInsertTable.html("");
			thead = q.new("thead");
			tr = q.new("tr");

			tr.appendChild(q.new("th").html("Character"));
			tr.appendChild(q.new("th").html("Complement"));

			thead.appendChild(tr);

			$autoInsertTable.appendChild(thead);

			for (; i < len; i++)
			// create <tr> with <td>s having text as in current array and Remove
				$autoInsertTable.appendChild(createTableRow(arr[i].concat("Remove")));
		}

		appendInputBoxesInTable();
	}

	function getAutoInsertCharIndex(firstCharToGet) {
		var arr = Data.charsToAutoInsertUserList,
			firstChar;

		for (var i = 0, len = arr.length; i < len; i++) {
			firstChar = arr[i][0];

			if (firstCharToGet === firstChar) return i;
		}

		return -1;
	}

	function appendInputBoxesInTable() {
		function append(elm) {
			var td = q.new("td");
			td.appendChild(elm);
			tr.appendChild(td);
		}

		function configureTextInputElm(attribute) {
			var inp = q
				.new("input")
				.addClass(mainClass)
				.attr("placeholder", "Type " + attribute);
			inp.type = "text";

			append(inp);

			inp.on("keydown", function(e) {
				if (e.keyCode === 13) saveAutoInsert([inp1.value, inp2.value]);
			});

			return inp;
		}

		var mainClass = "char_input",
			tr = q.new("tr"),
			inp1 = configureTextInputElm("new character"),
			inp2 = configureTextInputElm("its complement");

		append(q.new("button").html("Save"));

		$autoInsertTable.appendChild(tr);
	}

	// goes through all default properties, and adds
	// them to `data` if they are undefined
	function ensureRobustCompat(data) {
		var missingProperties = false;

		for (var prop in SETTINGS_DEFAULTS) {
			if (SETTINGS_DEFAULTS.hasOwnProperty(prop)) {
				if (typeof data[prop] === "undefined") {
					data[prop] = SETTINGS_DEFAULTS[prop];
					missingProperties = true;
				}
			}
		}

		return missingProperties;
	}

	var validateRestoreData, initiateRestore;
	(function backUpDataValidationFunctions() {
		var duplicateSnippetToKeep, typeOfData;

		// duplicateSnippetToKeep - one of "existing", "imported", "both"
		function handleDuplicatesInSnippets(inputFolder, shouldMergeDuplicateFolderContents) {
			var stringToAppendToImportedObject = "(1)";
			handler(inputFolder);

			function both(object) {
				var objectNameLen = object.name.length;

				if (objectNameLen <= pk.OBJECT_NAME_LIMIT - stringToAppendToImportedObject.length)
					object.name += stringToAppendToImportedObject;
				else object.name = object.name.substring(0, objectNameLen - 3) + stringToAppendToImportedObject;
			}

			function handler(inputFolder) {
				var removeIdxs = [];

				inputFolder.list.forEach(function(object, idx) {
					if (handleSingleObject(object)) removeIdxs.push(idx);
				});

				var len = removeIdxs.length - 1;
				while (len >= 0) inputFolder.list.splice(removeIdxs[len--], 1);
			}

			function handleSingleObject(importedObj) {
				var duplicateObj = Data.snippets.getUniqueObject(importedObj.name, importedObj.type),
					shouldDeleteImportedObject = false,
					shouldKeepBothFolders = duplicateSnippetToKeep === "both";

				if (duplicateObj) {
					switch (duplicateSnippetToKeep) {
						case "both":
							both(importedObj);
							break;
						case "imported":
							duplicateObj.remove();
							break;
						case "existing":
							shouldDeleteImportedObject = true;
					}
				}

				if (Folder.isFolder(importedObj)) {
					handler(importedObj);

					// have to merge non-duplicate contents of
					// duplicate folders
					if (duplicateObj && !shouldKeepBothFolders && shouldMergeDuplicateFolderContents)
						if (duplicateSnippetToKeep === "imported") {
							// first we had corrected all the contents of fromFolder (deletedFolder)
							// by calling handler and then moved
							// the corrected contents to toFolder (keptFolder)
							Folder.copyContents(duplicateObj, importedObj);
						} else Folder.copyContents(importedObj, duplicateObj);
				}

				return shouldDeleteImportedObject;
			}
		}

		// receives charToAutoInsertUserList from user
		// during restore and validates it
		function validateCharListArray(charList) {
			for (var i = 0, len = charList.length, item, autoInsertSpecifierMessage; i < len; i++) {
				item = charList[i];
				autoInsertSpecifierMessage = "elements in " + (i + 1) + "th character list";

				// item should be array
				if (!Array.isArray(item)) return "Invalid " + autoInsertSpecifierMessage;

				// array should be of 2 items
				if (item.length !== 2) return "Expected exactly 2 " + autoInsertSpecifierMessage;

				// item's elements should be string
				if (typeof item[0] + typeof item[1] !== "stringstring")
					return autoInsertSpecifierMessage + " are not strings.";

				// item's elements should be one char in length
				if (item[0].length !== 1 || item[1].length !== 1)
					return autoInsertSpecifierMessage + " are not of length 1.";

				// check dupes
				for (var j = i + 1; j < len; j++)
					if (item[0] === charList[j][0]){
						charList.splice(j, 1);
						j--;
					}
			}

			return "true";
		}

		initiateRestore = function(data) {
			var importPopup = q(".panel.import"),
				selectList = importPopup.qClsSingle("selectList"),
				selectedFolder = Folder.getSelectedFolderInSelectList(selectList),
				existingSnippets,
				inputSnippetsJSON,
				inputSnippets,
				validation,
				$deleteExistingSnippetsInput = importPopup.qClsSingle("delete_existing"),
				shouldDeleteExistingSnippets = $deleteExistingSnippetsInput.checked,
				shouldMergeDuplicateFolderContents = importPopup.q("input[name=merge]").checked;

			duplicateSnippetToKeep = importPopup.q("input[name=duplicate]:checked").value;

			try {
				data = JSON.parse(data);
			} catch (e) {
				alert(
					"Data was of incorrect format! Please close this box and check console log (Ctrl+Shift+J/Cmd+Shift+J) for error report. And mail it to us at prokeys.feedback@gmail.com to be resolved."
				);
				console.log(e.message);
				console.log(data);
				return;
			}

			typeOfData = Array.isArray(data) ? "snippets" : "data";

			inputSnippetsJSON = typeOfData === "data" ? data.snippets : data;

			validation = validateRestoreData(data, inputSnippetsJSON);

			if (validation !== "true") {
				alert(validation);
				return;
			}

			inputSnippets = Folder.fromArray(inputSnippetsJSON);

			if (shouldDeleteExistingSnippets) selectedFolder.list = [];

			// handling duplicates requires correct indexes
			Folder.setIndices();

			handleDuplicatesInSnippets(inputSnippets, shouldMergeDuplicateFolderContents);

			Folder.copyContents(inputSnippets, selectedFolder);

			if (typeOfData === "data") {
				existingSnippets = Folder.fromArray(Data.snippets.toArray()); // copied
				Data = data;
				Data.snippets = existingSnippets;
			}

			saveSnippetData(function() {
				if (confirm("Data saved! Reload the page for changes to take effect?")) window.location.reload();
			});
		};

		// receives data object and checks whether
		// it has only those properties which are required
		// and none other
		validateRestoreData = function(data, snippets) {
			// if data is of pre-3.0.0 times
			// it will not have folders and everything
			var snippetsValidation = Folder.validate(snippets);

			if (snippetsValidation !== "true") return snippetsValidation;

			// all the checks following this line should be of "data" type
			if (typeOfData !== "data") return "true";

			ensureRobustCompat(data);

			// delete user-added properties that ProKeys doesn't recognize
			for (var prop in data) {
				if (data.hasOwnProperty(prop) && !SETTINGS_DEFAULTS.hasOwnProperty(prop)) {
					delete data[prop];
				}
			}

			var vld2 = validateCharListArray(data.charsToAutoInsertUserList);
			if (vld2 !== "true") return vld2;

			for (var k = 0, len = data.blockedSites.length, elm; k < len; k++) {
				elm = data.blockedSites[k];

				// check type
				if (typeof elm !== "string") return "Element " + elm + " of blocked sites was not a string.";

				data.blockedSites[k] = elm.replace(/^www/, "");

				// delete duplicate sites
				for (var j = k + 1; j < len; j++)
					if (elm === data.blockedSites[j]) {
						data.blockedSites.splice(j, 1);
						j--;
					}
			}

			return "true";
		};
	})();

	// get type of current storage as string
	function getCurrentStorageType() {
		// property MAX_ITEMS is present only in sync
		return storage.MAX_ITEMS ? "sync" : "local";
	}

	// changes type of storage: local-sync, sync-local
	function changeStorageType() {
		storage = getCurrentStorageType() === "sync" ? chrome.storage.local : chrome.storage.sync;
	}

	// transfer data from one storage to another
	function migrateData(transferData, callback) {
		function afterMigrate() {
			Data.snippets = Folder.fromArray(Data.snippets);
			callback();
		}
		var str = Data.snippets.toArray(); // maintain a copy

		// make current storage unusable
		// so that storage gets changed by DB_load
		Data.snippets = false;

		DB_save(function() {
			changeStorageType();

			if (transferData) {
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
	function getCurrentHotkey() {
		var combo = Data.hotKey.slice(0),
			kC, // keyCode
			result = "",
			specials = {
				13: "Enter",
				32: "Space",
				188: ", (Comma)",
				192: "` (Backtick)"
			},
			metaKeyNames = {
				shiftKey: "Shift",
				ctrlKey: "Ctrl",
				altKey: "Alt",
				metaKey: "Meta"
			};

		// dual-key combo
		if (combo[1]) {
			result += metaKeyNames[combo[0]] + " + ";

			kC = combo[1];
		} else kC = combo[0];

		// numpad keys
		if (kC >= 96 && kC <= 105) kC -= 48;

		result += specials[kC] || String.fromCharCode(kC);

		return result;
	}

	function sanitizeSiteURLForBlock(URL) {
		var regex = /(\w+\.)+\w+/;

		// invalid domain entered; exit
		if (!regex.test(URL)) {
			alert("Invalid form of site address entered.");
			return false;
		}

		URL = URL.replace(/^(https?:\/\/)?(www\.)?/, "");

		// already a blocked site
		if (isBlockedSite(URL)) {
			alert("Site " + URL + " is already blocked.");
			return false;
		}

		return URL;
	}

	/**
	 * function to setup the folder or snippet edit panel
     * @param {String} type generic snip or folder
     */
	function setupEditPanel(type) {
		var $panel = qClsSingle("panel_" + type + "_edit"),
			saveHandler = handlerSaveObject(type),
			nameElm = $panel.q(".name input"),
			$parentFolderDIV;

		$panel.on("keydown", function(event){
			if(event.keyCode === 13 && (event.ctrlKey || event.metaKey)){
				saveHandler();
			}

			if(event.keyCode === 27){
				$panel.qClsSingle("close_btn").click();
			}
		});

		nameElm.on("keydown", function(event){
			// the ! ensures that both the $panel and the nameELm handlers don't fire simultaneously
			if(event.keyCode === 13 && !(event.ctrlKey || event.metaKey)){
				saveHandler();
			}
		});

		function highlightInFolderList(folderElm, name) {
			var folderNames = folderElm.Q("p"),
				folder;

			for (var i = 0, len = folderNames.length; i < len; i++)
				if ((folder = folderNames[i]).html() === name) {
					folder.addClass("selected");
					break;
				}

			if(folder){
				$parentFolderDIV = folder.parent("div");
				while(!$parentFolderDIV.classList.contains("selectList")){
					$parentFolderDIV.removeClass("collapsed");
					$parentFolderDIV = $parentFolderDIV.parent("div");
				}
			}
		}

		return function(object, isSavingSnippet) {
			var headerSpan = $panel.q(".header span"),
				folderElm = $panel.q(".folderSelect .selectList"),
				folderPathElm = $panelSnippets.q(".folder_path :nth-last-child(2)"),
				// boolean to tell if call is to edit existing snippet/folder
				// or create new snippet
				isEditing = !!object,
				isSnip = type == "snip",
				errorElements = qCls("error");

			$panelSnippets.toggleClass(SHOW_CLASS);
			$panel.toggleClass(SHOW_CLASS);
			if (isEditing) $panel.removeClass("creating-new");
			else $panel.addClass("creating-new");

			/* cleanup  (otherwise abnormal rte swap alerts are received from 
					userAllowsToLoseFormattingOnSwapToTextarea method when we
					later would load another snippet)*/
			dualSnippetEditorObj.setPlainText("").setRichText("");

			// had clicked the tick btn
			if (isSavingSnippet) return;

			// reset
			folderElm.html("");

			// cannot nest a folder under itself
			folderElm.appendChild(
				isEditing && type === "folder"
					? Data.snippets.getFolderSelectList(object.name)
					: Data.snippets.getFolderSelectList()
			);

			if (isEditing) {
				var parent = object.getParentFolder();
				highlightInFolderList(folderElm, parent.name);
			} else highlightInFolderList(folderElm, folderPathElm.html());

			headerSpan.html((isEditing ? "Edit " : "Create new ") + type);

			if(errorElements) errorElements.removeClass(SHOW_CLASS);

			// defaults
			if (!isEditing)
				object = {
					name: "",
					body: ""
				};

			nameElm.text(object.name).focus();
			nameElm.dataset.name = object.name;
			if (isSnip) {
				dualSnippetEditorObj.switchToDefaultView(object.body).setShownText(object.body);
			}
		};
	}

	/** functions common to snip and folder
     * @param {String} panelName snip or folder only
     * @returns {Function} 
     */
	function commonValidation(panelName) {
		var panel = qClsSingle("panel_" + panelName + "_edit");

		function manipulateElmForValidation(elm, validateFunc, errorElm) {
			var text = elm ? elm.value : dualSnippetEditorObj.getShownTextForSaving(),
				textVld = validateFunc(text),
				isTextValid = textVld === "true",
				textErrorElm = errorElm || elm.nextElementSibling;

			// when we are editing snippet/folder it does
			// not matter if the name remains same
			if (textVld === Generic.getDuplicateObjectsText(text, panelName) && elm.dataset.name === text)
				isTextValid = true;

			if (!isTextValid) {
				textErrorElm.addClass(SHOW_CLASS).html(textVld);
			} else textErrorElm.removeClass(SHOW_CLASS);

			return [text, isTextValid];
		}

		return function(callback) {
			var nameElm = panel.q(".name input"),
				name,
				selectList = panel.qClsSingle("selectList"),
				folder = Folder.getSelectedFolderInSelectList(selectList),
				isSnippet = /snip/.test(panel.className),
				body;

			if (isSnippet) {
				name = manipulateElmForValidation(nameElm, Snip.isValidName);
				body = manipulateElmForValidation(undefined, Snip.isValidBody, panel.q(".body .error"));
			} else name = manipulateElmForValidation(nameElm, Folder.isValidName);

			var allValid = name[1] && (isSnippet ? body[1] : true),
				oldName = nameElm.dataset.name;

			if (allValid) {
				if (isSnippet) toggleSnippetEditPanel(undefined, true);
				else toggleFolderEditPanel(undefined, true);

				callback(oldName, name[0], body && body[0], folder);
			}
		};
	}

	// (sample) input 1836 => "2KB"
	// input 5,123,456 => "5MB"
	function roundByteSize(bytes) {
		var powers = [6, 3, 0, -3],
			suffixes = ["MB", "KB", "B", "mB"],
			DECIMAL_PLACES_TO_SHOW = 1;

		for (var i = 0, len = powers.length, lim; i < len; i++) {
			lim = Math.pow(10, powers[i]);

			if (bytes >= lim) return parseFloat((bytes / lim).toFixed(DECIMAL_PLACES_TO_SHOW)) + suffixes[i];
		}
	}

	function roundByteSizeWithPercent(bytes, bytesLim) {
		var out = roundByteSize(bytes),
			// nearest multiple of five
			percent = Math.round((bytes / bytesLim) * 20) * 5;

		return out + " (" + percent + "%)";
	}

	// updates the storage header in #headArea
	// "You have x bytes left out of y bytes"
	function updateStorageAmount() {
		storage.getBytesInUse(function(bytesInUse) {
			var bytesAvailable = storage.MAX_ITEMS ? MAX_SYNC_DATA_SIZE : MAX_LOCAL_DATA_SIZE;

			// set current bytes
			qClsSingle("currentBytes").html(roundByteSizeWithPercent(bytesInUse, bytesAvailable));

			// set total bytes available
			qClsSingle("bytesAvailable").html(roundByteSize(bytesAvailable));
		});
	}
    
	/**
     *
     * @param {String} type the Generic snip or folder type
     */
	function handlerSaveObject(type){		
		var validationFunc = type === Generic.SNIP_TYPE ? validateSnippetData : validateFolderData;
		// once checked, now can mutate type as per need
		type = type[0].toUpperCase() + type.substr(1).toLowerCase();

		return function(){
			return validationFunc(function(oldName, name, body, newParentfolder) {
				var object, oldParentFolder, movedObject;
    
				if (oldName) {
					object = Data.snippets["getUnique" + type](oldName);
					oldParentFolder = object.getParentFolder();
    
					if (newParentfolder.name !== oldParentFolder.name) {
						// first move that object; before changing its name/body
						movedObject = object.moveTo(newParentfolder);
    
						movedObject.name = name;
						if (type === "Snip") movedObject.body = body;
    
						latestRevisionLabel =
                            "moved \"" + name + "\" " + movedObject.type + " to \"" + newParentfolder.name + "\"";
						saveSnippetData(undefined, newParentfolder.name, name);
					} else oldParentFolder["edit" + type](oldName, name, body);
				} else newParentfolder["add" + type](name, body);
			});
		};
	}

	function init() {        
		// needs to be set before database actions
		$panelSnippets = qClsSingle("panel_snippets");
		$containerSnippets = $panelSnippets.qClsSingle("panel_content");
		// initialized here; but used in snippet_classes.js
		$containerFolderPath = $panelSnippets.qClsSingle("folder_path");
        
		$snipMatchDelimitedWordInput = q(".snippet_match_whole_word input[type=checkbox]");
		$tabKeyInput = qId("tabKey");
		$snipNameDelimiterListDIV = qClsSingle("delimiter_list");

		if (!pk.DB_loaded) {
			setTimeout(DB_load, 100, DBLoadCallback);
			return;
		}
		//console.log(Data.snippets);

		// should only be called when DB has loaded
		// and page has been initialized
		setEssentialItemsOnDBLoad();

		var changeHotkeyBtn = qClsSingle("change_hotkey"),
			hotkeyListener = qClsSingle("hotkey_listener");

		chrome.storage.onChanged.addListener(updateStorageAmount);

		Q("span.version").forEach(function(span) {
			span.innerHTML = VERSION;
		});

		// panels are - #content div
		(function panelWork() {
			var url = window.location.href;

			if (/#\w+$/.test(url) && !/tryit|symbolsList/.test(url))
			// get the id and show divs based on that
				showHideDIVs(url.match(/#(\w+)$/)[1]);
			else showHideDIVs("settings"); // default panel

			// used when buttons in navbar are clicked
			// or when the url contains an id of a div
			function showHideDIVs(DIVName) {
				var containerSel = "#content > ",
					DIVSelector = "#" + DIVName,
					btnSelector = ".sidebar .buttons button[data-divid =" + DIVName + "]",
					selectedBtnClass = "selected",
					selectedDIV = q(containerSel + ".show"),
					selectedBtn = q(".sidebar .buttons ." + selectedBtnClass);

				if (DIVName === "snippets") Data.snippets.listSnippets();

				if (selectedDIV) selectedDIV.removeClass("show");
				q(containerSel + DIVSelector).addClass("show");

				if (selectedBtn) selectedBtn.removeClass(selectedBtnClass);
				q(btnSelector).addClass(selectedBtnClass);

				var href = window.location.href,
					selIndex = href.indexOf("#");

				if (selIndex !== -1) href = href.substring(0, selIndex);

				window.location.href = href + DIVSelector;

				// the page shifts down a little
				// for the exact location of the div;
				// so move it back to the top
				document.body.scrollTop = 0;
			}

			// the left hand side nav buttons
			// Help, Settings, Backup&Restore, About
			Q(".sidebar .buttons button").on("click", function() {
				showHideDIVs(this.dataset.divid);
			});
		})();

		(function helpPageHandlers() {
			/* set up accordion in help page */
			// heading
			Q("#help section dt").on("click", function() {
				this.toggleClass("show");
			});

			// the tryit editor in Help section
			new DualTextbox(qId("tryit"), true)
				.setPlainText(
					"You can experiment with various ProKeys' features in this interactive editor! This editor is resizable.\n\n\
Textarea is the normal text editor mode. No support for bold, italics, etc. But multiline text is supported.\n\
Think Notepad."
				)
				.setRichText(
					"This is a contenteditable or editable div. \
These editors are generally found in your email client like Gmail, Outlook, etc.<br><br><i>This editor \
<u>supports</u></i><b> HTML formatting</b>. You can use the \"my_sign\" sample snippet here, and see the effect."
				);
		})();

		(function settingsPageHandlers() {
			var $delimiterCharsInput = q(".delimiter_list input"),
				$delimiterCharsResetBtn = q(".delimiter_list button");

			// on user input in tab key setting
			$tabKeyInput.on("change", function() {
				Data.tabKey = this.checked;

				saveOtherData("Saved!");
			});

			$blockSitesTextarea.on("keydown", function(event){
				if(event.keyCode === 13 && (event.ctrlKey || event.metaKey)){
					var URLs = $blockSitesTextarea.value.split("\n"),
						i = 0,
						len = URLs.length,
						URL,
						sanitizedURL;
						
					Data.blockedSites = []; // reset
					
					for (; i < len; i++) {
						URL = URLs[i].trim();					
						sanitizedURL = sanitizeSiteURLForBlock(URL);

						if(sanitizedURL === false) return;
						else Data.blockedSites.push(sanitizedURL);
					}

					saveOtherData("Saved successfully", listBlockedSites);
				}
			});

			function getAutoInsertPairFromSaveInput(node) {
				var $clickedTR = node.parentNode.parentNode;
				return $clickedTR.qCls("char_input").map(function(e) {
					return e.value;
				});
			}

			function getAutoInsertPairFromRemoveInput(node) {
				var $clickedTR = node.parentNode;
				return (
					$clickedTR
						.Q("td")
					// slice to exclude Remove button
						.map(function(e) {
							return e.innerText;
						})
						.slice(0, 2)
				);
			}

			$autoInsertTable.on("click", function(e) {
				var node = e.target;

				if (node.tagName === "BUTTON") saveAutoInsert(getAutoInsertPairFromSaveInput(node));
				else if (pk.getHTML(node) === "Remove") removeAutoInsertChar(getAutoInsertPairFromRemoveInput(node));
			});

			$snipMatchDelimitedWordInput.on("change", function() {
				var isChecked = this.checked;
				Data.matchDelimitedWord = isChecked;
				$snipNameDelimiterListDIV.toggleClass(SHOW_CLASS);
				saveOtherData("Data saved!");
			});

			function validateDelimiterList(stringList) {
				var i = 0,
					len = RESERVED_DELIMITER_LIST.length,
					reservedDelimiter;
				for (; i < len; i++) {
					reservedDelimiter = RESERVED_DELIMITER_LIST.charAt(i);
					if (stringList.match(pk.escapeRegExp(reservedDelimiter))) return reservedDelimiter;
				}

				return true;
			}

			$delimiterCharsInput.on("keyup", function(e) {
				if (e.keyCode === 13) {
					var vld = validateDelimiterList(this.value);
					if (vld !== true) {
						alert(
							"Input list contains reserved delimiter \"" +
                                vld +
                                "\". Please remove it from the list. Thank you!"
						);
						return true;
					}
					Data.snipNameDelimiterList = this.value;
					saveOtherData("Data saved!");
				}
			});

			$delimiterCharsResetBtn.on("click", function() {
				if (confirm("Are you sure you want to replace the current list with the default delimiter list?")) {
					Data.snipNameDelimiterList = SETTINGS_DEFAULTS.snipNameDelimiterList;
					delimiterInit();
					saveOtherData("Data saved!");
				}
			});

			delimiterInit();

			function delimiterInit() {
				$delimiterCharsInput.value = Data.snipNameDelimiterList;
			}
		})();

		(function snippetWork() {
			// define element variables
			var $searchBtn = qClsSingle("search_btn"),
				$searchPanel = qClsSingle("panel_search"),
				$searchField = q(".panel_search input[type=text]"),
				$closeBtn = qCls("close_btn"),
				$snippetSaveBtn = q(".panel_snip_edit .tick_btn"),
				$folderSaveBtn = q(".panel_folder_edit .tick_btn"),
				$addNewBtns = Q(".panel_snippets [class^=\"add_new\"]"),
				$sortBtn = q(".panel_snippets .sort_btn"),
				$sortPanel = qClsSingle("panel_sort"),
				// the button that actually initiates sorting
				$sortPanelBtn = q(".panel_sort input[type=button]"),
				$bulkActionBtn = q(".panel_snippets .checkbox_btn"),
				$bulkActionPanel = q(".panel_snippets .panel_bulk_action"),
				folderPath = qClsSingle("folder_path"),
				$selectList = qCls("selectList");

			validateSnippetData = commonValidation(Generic.SNIP_TYPE);
			validateFolderData = commonValidation(Generic.FOLDER_TYPE);
			toggleSnippetEditPanel = setupEditPanel(Generic.SNIP_TYPE);
			toggleFolderEditPanel = setupEditPanel(Generic.FOLDER_TYPE);			

			dualSnippetEditorObj = new DualTextbox(qId("body-editor"));

			/**
             * Delegated handler for edit, delete, clone buttons
             */
			$containerSnippets.on("click", function(e) {
				var node = e.target,
					container = node.parentNode,
					objectElm = container.parentNode,
					obj;

				if (!objectElm || !/buttons/.test(container.className)) return true;

				if (node.matches("#snippets .panel_content .edit_btn")) {
					obj = Generic.getObjectThroughDOMListElm(objectElm);
					if (Folder.isFolder(obj)) toggleFolderEditPanel(obj);
					else toggleSnippetEditPanel(obj);
				} else if (node.matches("#snippets .panel_content .delete_btn")) deleteOnClick.call(objectElm);
				else if (node.matches("#snippets .panel_content .clone_btn")) cloneBtnOnClick.call(objectElm);
			});

			folderPath.on("click", function(e) {
				var node = e.target,
					folderName,
					folder;

				if (node.matches(".chevron")) {
					folder = Folder.getListedFolder();
					folder.getParentFolder().listSnippets();
				} else if (node.matches(".path_part")) {
					folderName = node.innerHTML;
					folder = Data.snippets.getUniqueFolder(folderName);
					folder.listSnippets();
				}
			});

			/**
			 * checks if the text typed in the panel is unedited or edited
			 * @param {Element} $panel the snippet or folder panel being edited
			 * @param {Element} $objectName the input element containing the object name 
			 */
			function userHasEditedTextPresentInPanel($panel, $objectName){
				var $body = $panel.qClsSingle("body"),
					objectName = $objectName.value,
					nameChanged = $objectName.dataset.name !== objectName;

				if(!$body || nameChanged) return nameChanged;

				if(objectName === "") return false;

				var body = dualSnippetEditorObj.getShownTextForSaving(),
					snip = Data.snippets.getUniqueSnip(objectName),
					bodyChanged = snip ? snip.body !== body : false;

				return bodyChanged;
			}

			function closePanel($panel){
				$panel.removeClass(SHOW_CLASS);
				$panelSnippets.addClass(SHOW_CLASS);
			}

			$closeBtn.on("click", function() {
				var $panel = this.parent(".panel"),
					$objectName = $panel.q(".name input");

				if($objectName && userHasEditedTextPresentInPanel($panel, $objectName)){
					if(confirm("You have unsaved edits. Are you sure you wish to leave?")){
						closePanel($panel);
					}
				}
				// not an edit panel, but rather some export popup
				else{
					closePanel($panel);
				}
			});

			$snippetSaveBtn.on("click", handlerSaveObject(Generic.SNIP_TYPE));
			$folderSaveBtn.on("click", handlerSaveObject(Generic.FOLDER_TYPE));

			function deleteOnClick() {
				var object = Generic.getObjectThroughDOMListElm(this),
					name = object.name,
					type = object.type,
					isSnip = type === Generic.SNIP_TYPE,
					warning = isSnip ? "" : " (and ALL its contents)",
					folder;

				if (confirm("Delete '" + name + "' " + type + warning + "?")) {
					folder = object.getParentFolder();

					object.remove();
					this.parentNode.removeChild(this);

					latestRevisionLabel = "deleted " + type + " \"" + name + "\"";

					saveSnippetData(undefined, folder.name);
				}
			}

			function cloneBtnOnClick() {
				var object = Generic.getObjectThroughDOMListElm(this),
					newObject = object.clone();
				latestRevisionLabel = "cloned " + object.type + " \"" + object.name + "\"";

				// keep the same snippet highlighted as well (object.name)
				// so that user can press clone button repeatedly
				saveSnippetData(undefined, newObject.getParentFolder().name, [object.name, newObject.name]);
			}

			$selectList.on("click", function(e) {
				var clickedNode = e.target,
					classSel = "selected",
					otherNodes,
					$containerDIV,
					collapsedClass = "collapsed";

				if (clickedNode.tagName === "P") {
					// do not use $selectList
					// as it is a NodeList
					$containerDIV = clickedNode.parentNode;
					$containerDIV.toggleClass(collapsedClass);

					otherNodes = this.qCls(classSel);
					if (otherNodes) otherNodes.removeClass(classSel);
					clickedNode.addClass(classSel);
				}
			});

			// for searchBtn and $searchPanel
			// $addNewBtn and $addNewPanel
			// and other combos
			function toggleBtnAndPanel(btn, panel) {
				var existingPanel = q(".sub_panel.shown");
				if (!panel.hasClass(SHOW_CLASS)) panel.addClass(SHOW_CLASS);
				if (existingPanel) existingPanel.removeClass(SHOW_CLASS);

				var existingBtn = q(".panel_btn.active");
				if (!btn.hasClass("active")) btn.addClass("active");
				if (existingBtn) existingBtn.removeClass("active");

				// we need these checks as another might have been clicked
				// to remove the search/checkbox panel and so we need to remove
				// their type of list
				if (!$searchPanel.hasClass(SHOW_CLASS) && Folder.getListedFolder().isSearchResultFolder)
					Data.snippets.listSnippets();

				// if checkbox style list is still shown
				if (
					$containerSnippets.q("input[type=\"checkbox\"]") &&
                    !$bulkActionPanel.hasClass(SHOW_CLASS)
				)
					Data.snippets.getUniqueFolder($bulkActionPanel.dataset.originalShownFolderName).listSnippets();
			}

			$sortBtn.on("click", function() {
				toggleBtnAndPanel($sortBtn, $sortPanel);
			});

			$sortPanelBtn.on("click", function() {
				var sortDir = $sortPanel.q(".sort-dir :checked").parentNode.innerText,
					sortType = $sortPanel.q(".sort-type :checked").parentNode.innerText,
					descendingFlag = (sortDir = sortDir === "Descending"),
					lastFolderDOM = folderPath.lastChild.previousSibling,
					folder = Data.snippets.getUniqueFolder(lastFolderDOM.html());

				sortType = sortType === "Name" ? "alphabetic" : "date";

				folder.sort(sortType, descendingFlag);

				latestRevisionLabel = "sorted folder \"" + folder.name + "\"";
			});

			$addNewBtns.on("click", function() {
				if(/snip/i.test(this.className)){
					toggleSnippetEditPanel();
				}else{
					toggleFolderEditPanel();
				}
			});

			$searchBtn.on("click", function() {
				toggleBtnAndPanel($searchBtn, $searchPanel);
				$searchField.html("").focus();
				// now hidden search panel, so re-list the snippets
				if (!$searchPanel.hasClass(SHOW_CLASS)) Folder.getListedFolder().listSnippets();
			});

			$searchBtn.attr("title", "Search for folders or snips");
			$searchField.on(
				"keyup",
				pk.debounce(function searchFieldHandler() {
					var searchText = this.value,
						listedFolder = Folder.getListedFolder(),
						searchResult = listedFolder.searchSnippets(searchText);

					searchResult.listSnippets();
				}, 150)
			);

			(function bulkActionsWork() {
				var selectedObjects,
					DOMcontainer,
					moveToBtn = $bulkActionPanel.q(".bulk_actions input:first-child"),
					deleteBtn = $bulkActionPanel.q(".bulk_actions input:last-child"),
					toggleAllButton = $bulkActionPanel.q(".selection_count input"),
					folderSelect = $bulkActionPanel.qClsSingle("folderSelect"),
					selectList = $bulkActionPanel.qClsSingle("selectList");

				function updateSelectionCount() {
					selectedObjects = DOMcontainer.Q("input:checked") || [];

					selectedObjects = selectedObjects.map(function(e) {
						var div = e.nextElementSibling.nextElementSibling,
							name = div.html(),
							img = e.nextElementSibling,
							type = img.src.match(/\w+(?=\.svg)/)[0];

						return Data.snippets.getUniqueObject(name, type);
					});

					$bulkActionPanel.q(".selection_count span").html(selectedObjects.length);

					$bulkActionPanel.Q(".bulk_actions input").forEach(function(elm) {
						elm.disabled = !selectedObjects.length;
					});
				}

				$bulkActionBtn.on("click", function() {
					var originalShownFolderName, originalShownFolder;

					toggleBtnAndPanel(this, $bulkActionPanel);

					if ($bulkActionPanel.hasClass(SHOW_CLASS)) {
						originalShownFolderName = Folder.getListedFolderName();
						originalShownFolder = Data.snippets.getUniqueFolder(originalShownFolderName);
						DOMcontainer = Folder.insertBulkActionDOM(originalShownFolder);

						$bulkActionPanel.dataset.originalShownFolderName = originalShownFolderName;
					
						DOMcontainer.on("click", function(event){
							var nodeClicked = event.target,
								parentGeneric = nodeClicked.matches(".generic") ?
									nodeClicked : nodeClicked.parent(".generic"),
								inputCheckbox = parentGeneric.children[0];

							if(nodeClicked.tagName !== "INPUT")
								inputCheckbox.checked = !inputCheckbox.checked;

							updateSelectionCount();
						});

						updateSelectionCount();
						folderSelect.removeClass(SHOW_CLASS);
					}
				});

				toggleAllButton.on("click", function() {
					var checkboxes = DOMcontainer.Q("input"),
						allCheckedBoxesChecked = true,
						finalCheckState;

					checkboxes.some(function(checkbox) {
						if (!checkbox.checked) {
							allCheckedBoxesChecked = false;
							return true;
						}
					});

					finalCheckState = !allCheckedBoxesChecked;

					checkboxes.forEach(function(checkbox) {
						checkbox.checked = finalCheckState;
					});

					updateSelectionCount();
				});

				// move to folder button
				moveToBtn.on("click", function() {
					var selectFolderName, selectedFolder,
						atleastOneElementMoved = false;

					if (!folderSelect.hasClass(SHOW_CLASS)) {
						Folder.refreshSelectList(selectList);
						folderSelect.addClass(SHOW_CLASS);
					} else {
						selectedFolder = Folder.getSelectedFolderInSelectList(selectList);
						selectFolderName = selectedFolder.name;
						selectedObjects.forEach(function(e) {
							if (e.canNestUnder(selectedFolder)) {
								atleastOneElementMoved = true;
								e.moveTo(selectedFolder);
							}
							else{
								alert(
									"Cannot move " +
                                        e.type +
                                        " \"" +
                                        e.name +
                                        "\" to \"" +
                                        selectedFolder.name +
                                        "\"" +
                                        "; as it is the same as (or a parent folder of) the destination folder"
								);
							}
						});

						// do not list new folder if nothing was moved
						if(!atleastOneElementMoved)
							return;

						latestRevisionLabel =
                            "moved " + selectedObjects.length + " objects to folder \"" + selectFolderName + "\"";

						saveSnippetData(
							function() {
								// hide the bulk action panel
								$bulkActionBtn.click();
							},
							selectFolderName,
							selectedObjects.map(function(e) {
								return e.name;
							})
						);
					}
				});

				deleteBtn.on("click", function() {
					if (
						confirm(
							"Are you sure you want to delete these " +
                                selectedObjects.length +
                                " items? " +
                                "Remember that deleting a folder will also delete ALL its contents."
						)
					) {
						selectedObjects.map(function(e) {
							e.remove();
						});

						latestRevisionLabel = "deleted " + selectedObjects.length + " objects";

						saveSnippetData(function() {
							// hide the bulk action panel
							$bulkActionBtn.click();
						}, Folder.getListedFolderName());
					}
				});
			})();

			(function checkIfFirstTimeUser() {
				var $changeLog = qClsSingle("change-log"),
					$button = $changeLog.q("button"),
					// ls set by background page
					isUpdate = localStorage.extensionUpdated === "true";

				if (isUpdate) {
					$changeLog.addClass(SHOW_CLASS);

					$button.on("click", function() {
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
			if (isFreshInstall) {
				Data.visited = true;
				saveOtherData();
			}
		})();

		(function storageModeWork() {
			// boolean parameter transferData: dictates if one should transfer data or not
			function storageRadioBtnClick(str, transferData) {
				if (
					!confirm(
						"Migrate data to " + str + " storage? It is VERY NECESSARY to take a BACKUP before proceeding."
					)
				) {
					this.checked = false;
					return;
				}

				storage.getBytesInUse(function(bytesInUse) {
					if (getCurrentStorageType() === "local" && bytesInUse > MAX_SYNC_DATA_SIZE) {
						alert(
							"You are currently using " +
                                bytesInUse +
                                " bytes of data; while sync storage only permits a maximum of " +
                                MAX_SYNC_DATA_SIZE +
                                " bytes.\n\nPlease reduce the size of data (by deleting, editing, exporting snippets) you're using to migreate to sync storage successfully."
						);
					} else {
						migrateData(transferData, function() {
							alert("Done! Data migrated to " + str + " storage successfully!");
							location.reload();
						});
					}
				});
			}

			// event delegation since radio buttons are
			// dynamically added
			qClsSingle("storageMode").on("click", function() {
				var input = this.q("input:checked");

				// make sure radio btn is clicked and is checked
				if (input) storageRadioBtnClick.call(input, input.dataset.storagetoset, input.id !== "sync2");
			});
		})();

		(function backUpWork() {
			var dataToExport;

			// flattens all folders
			/**
             * prints the snippets inside the folder
             * flattens the folder (to level 1) in case it is nested
             * @param {Folder} folder folder whose snippets will be printed
             */
			function getSnippetPrintData(folder) {
				var res = "";

				folder.forEachSnippet(function(sn){
					res += sn.name;
					res += "\n\n";
					res += sn.body;
					res += "\n\n--\n\n";
				}, false);

				return res;
			}

			Q(".export-buttons button").on("click", function() {
				var buttonClass = this.className,
					functionMap = {
						"export": showDataForExport,
						"import": setupImportPopup,
						"revisions": setUpPastRevisions
					};

				q("#snippets .panel_popup." + buttonClass).addClass(SHOW_CLASS);
				functionMap[buttonClass]();
			});

			function showDataForExport() {
				var	dataUse = q(".export .steps :first-child input:checked").value,
					downloadLink = q(".export a:first-child"),
					blob;

				if (dataUse === "print") dataToExport = getSnippetPrintData(Data.snippets);
				else {
					Data.snippets = Data.snippets.toArray();
					dataToExport = JSON.stringify(dataUse === "data" ? Data : Data.snippets, undefined, 2);
					Data.snippets = Folder.fromArray(Data.snippets);
				}

				blob = new Blob([dataToExport], {
					type: "text/js"
				});

				downloadLink.href = URL.createObjectURL(blob);
				downloadLink.download =
                    (dataUse === "print" ? "ProKeys print snippets" : "ProKeys " + dataUse) +
                    " " +
                    Date.getFormattedDate() +
					".txt";
			}

			var copyToClipboardLink = q(".export .copy-data-to-clipboard-btn");
			copyToClipboardLink.on("click", function(){
				pk.copyTextToClipboard(dataToExport);
			});
			
			Q(".export input").on("change", showDataForExport);

			function setupImportPopup() {
				var $selectList = q(".import .selectList");
				Folder.refreshSelectList($selectList);
				fileInputLink.html("Choose file containing data");
				// reset so that if same file is selected again,
				// onchange can still fire
				$inputFile.value = "";
			}

			q(".import .restore").on("click", function() {
				if (importFileData) initiateRestore(importFileData);
				else alert("Please choose a file.");
			});

			var fileInputLink = q(".import .file_input"),
				$inputFile = fileInputLink.nextElementSibling,
				initialLinkText = fileInputLink.html(),
				importFileData = null,
				importPopup = q(".panel.import"),
				importThroughClipboardSpan = q(".import-data-clipboard-btn");

			importPopup.on("paste", function(event){
				importFileData = event.clipboardData.getData("text");
				importThroughClipboardSpan.html("Pasted data is ready. Click Restore button to begin.");
			});

			$inputFile.on("change", function() {
				var file = $inputFile.files[0];

				if (!file) return false;

				var reader = new FileReader();

				reader.on("load", function(event) {
					importFileData = event.target.result;

					fileInputLink.html(
						"File '" +
                            file.name +
                            "' is READY." +
                            " Click Restore button to begin. Click here again to choose another file."
					);
				});

				reader.on("error", function(event) {
					console.error(
						"File '" +
                            importFileData.name +
                            "' could not be read! Please send following error to prokeys.feedback@gmail.com " +
                            " so that I can fix it. Thanks! ERROR: " +
                            event.target.error.code
					);
					fileInputLink.html(initialLinkText);
				});

				reader.readAsText(file);

				fileInputLink.html("READING FILE: " + file.name);
			});

			var $resvisionsRestoreBtn = q(".revisions .restore"),
				$textarea = q(".revisions textarea"),
				$select = q(".revisions select"),
				$closeRevisionsPopupBtn = q(".revisions .close_btn"),
				$preserveCheckboxesLI = q(".import .preserve_checkboxes"),
				$mergeDuplicateFolderContentsInput = $preserveCheckboxesLI.q("[name=merge]"),
				$preserveExistingContentInput = $preserveCheckboxesLI.q("[value=existing]"),
				$preserveImportedContentInput = $preserveCheckboxesLI.q("[value=imported]"),
				$caveatParagraph = $preserveCheckboxesLI.q("p"),
				selectedRevision;

			function setUpPastRevisions() {
				var revisions = JSON.parse(localStorage[LS_REVISIONS_PROP]);

				$select.html("");

				revisions.forEach(function(rev) {
					$select.appendChild(q.new("option").html(rev.label));
				});

				function showRevision() {
					selectedRevision = revisions[$select.selectedIndex];
					$textarea.value = JSON.stringify(selectedRevision.data, undefined, 2);
				}

				$select.on("input", showRevision);
				showRevision();
			}

			$resvisionsRestoreBtn.on("click", function() {
				try {
					if (confirm("Are you sure you want to use the selected revision?")) {
						Data.snippets = Folder.fromArray(JSON.parse($textarea.value));
						deleteRevision($select.selectedIndex);
						latestRevisionLabel = "restored revision (labelled: " + selectedRevision.label + ")";
						saveSnippetData(function() {
							$closeRevisionsPopupBtn.click();
						});
					}
				} catch (e) {
					alert(
						"Data in textarea was invalid. Close this box and check console log (Ctrl+Shift+J/Cmd+Shift+J) for error report. Or please try again!"
					);
				}
			});

			$preserveCheckboxesLI.on("click", function() {
				if (!$mergeDuplicateFolderContentsInput.checked) {
					if ($preserveExistingContentInput.checked)
						$caveatParagraph.html(
							"<b>Caveat</b>: Unique content of " + "folders with the same name will not be imported."
						);
					else if ($preserveImportedContentInput.checked)
						$caveatParagraph.html(
							"<b>Caveat</b>: Unique content of existing folders " + "with the same name will be lost."
						);
					else $caveatParagraph.html("");
				} else $caveatParagraph.html("");
			});
		})();

		// prevent exposure of locals
		(function hotKeyWork() {
			// resets hotkey btn to normal state
			function resetHotkeyBtn() {
				changeHotkeyBtn.html("Change hotkey").disabled = false;
			}

			/**
			 * THE PROBLEM:
			 * allowing keyups on both the control and the non control keys
			 * resulted in the keyup event firing twice, when the keys were
			 * released. Hence, if a control key is pressed (excluding enter),
			 * exit the method. We only need to catch events on the other keys.
			 * NOW:
			 * we originally used keyups because keydown event fired multiple times
			 * if key was held. but tracking keyup is difficult because of the above problem 
			 * as well as the fact that the output would be different if the user lifted the 
			 * shiftkey first or the space key first (when trying to set the hotkey to
			 * Shift+Space)
			 * Hence, we finally use this new solution.
			 */

			var combo;
			hotkeyListener.on("keydown", function(event){
				var keyCode = event.keyCode, valid,
					arrayOfControlKeys = ["shiftKey", "altKey", "ctrlKey", "metaKey"];

				// below code from https://stackoverflow.com/q/12467240
				// User shmiddty https://stackoverflow.com/u/1585400
				// determine if key is non-control key
				valid =
					(keyCode > 47 && keyCode < 58) || // number keys
					(keyCode == 32 || keyCode == 13) || // spacebar & return keys
					(keyCode > 64 && keyCode < 91) || // letter keys
					(keyCode > 95 && keyCode < 112) || // numpad keys
					(keyCode > 185 && keyCode < 193) || // ;=,-./` (in order)
					(keyCode > 218 && keyCode < 223); // [\]' (in order)

				// escape to exit
				if(keyCode === 27){
					resetHotkeyBtn();
				}
				else if(valid){
					Data.hotKey = combo.concat([keyCode]).slice(0);

					saveOtherData("Hotkey set to " + getCurrentHotkey(), function() {
						location.href = "#settings";
						location.reload();
					});
				}else{
					arrayOfControlKeys.forEach(function(key){
						if(event[key] && combo.indexOf(key) === -1){
							combo.unshift(key);
						}
					});
				}
			});

			changeHotkeyBtn.on("click", function() {
				this.html("Press new hotkeys").disabled = true; // disable the button

				hotkeyListener.focus();
				combo = [];

				// after five seconds, automatically reset the button to default
				setTimeout(resetHotkeyBtn, 5000);
			});
		})();
	}

	function DBLoadCallback() {
		/* Consider two PCs. Each has local data set.
			When I migrate data on PC1 to sync. The other PC's local data remains.
			And then it overrides the sync storage. The following lines
			manage that*/
		//console.dir(Data.snippets);
		// wrong storage mode
		if (Data.snippets === false) {
			// change storage to other type
			changeStorageType();

			DB_load(DBLoadCallback);
		} else {
			pk.DB_loaded = true;
			init();
		}
	}

	var local = "<b>Local</b> - storage only on one's own PC. More storage space than sync",
		localT =
            "<label for=\"local\"><input type=\"radio\" id=\"local\" data-storagetoset=\"local\"/><b>Local</b></label> - storage only on one's own PC locally. Safer than sync, and has more storage space. Note that on migration from sync to local, data stored on sync across all PCs would be deleted, and transfered into Local storage on this PC only.",
		sync1 =
            "<label for=\"sync\"><input type=\"radio\" id=\"sync\" data-storagetoset=\"sync\"/><b>Sync</b></label> - select if this is the first PC on which you are setting sync storage",
		sync2 =
            "<label for=\"sync2\"><input type=\"radio\" id=\"sync2\" data-storagetoset=\"sync\"/><b>Sync</b></label> - select if you have already set up sync storage on another PC and want that PCs data to be transferred here.",
		sync = "<b>Sync</b> - storage synced across all PCs. Offers less storage space compared to Local storage.";

	function setEssentialItemsOnDBLoad() {
		// user installs extension; set ls prop
		var firstInstall = !localStorage[LS_REVISIONS_PROP];
		if (firstInstall) {
			// refer github issues#4
			Data.dataUpdateVariable = !Data.dataUpdateVariable;
			localStorage[LS_REVISIONS_PROP] = "[]";
			saveRevision(Data.snippets);
		}

		if (!pk.isObject(Data.snippets)) Data.snippets = Folder.fromArray(Data.snippets);

		// save the default snippets ONLY
		if (firstInstall) saveSnippetData();

		Folder.setIndices();

		var propertiesChanged = ensureRobustCompat(Data);
		if(propertiesChanged)
			saveOtherData();

		// on load; set checkbox state to user preference
		$tabKeyInput.checked = Data.tabKey;
		$snipMatchDelimitedWordInput.checked = Data.matchDelimitedWord;

		if (Data.matchDelimitedWord) $snipNameDelimiterListDIV.addClass(SHOW_CLASS);

		$blockSitesTextarea = q(".blocked-sites textarea");
		listBlockedSites();

		$autoInsertTable = qClsSingle("auto_insert");
		listAutoInsertChars();

		autoInsertWrapSelectionInput = q("[name=\"wrapSelectionAutoInsert\"");
		autoInsertWrapSelectionInput.checked = Data.wrapSelectionAutoInsert;
		autoInsertWrapSelectionInput.on("click", function() {
			Data.wrapSelectionAutoInsert = autoInsertWrapSelectionInput.checked;
			saveOtherData("Saved!");
		});

		omniboxSearchURLInput = q(".search-provider input");
		// localStorage shared with background page
		localStorage.omniboxSearchURL = omniboxSearchURLInput.value = Data.omniboxSearchURL;
		omniboxSearchURLInput.on("keydown", function(e) {
			if (e.keyCode === 13) {
				Data.omniboxSearchURL = this.value;
				saveOtherData("Saved!");
			}
		});

		// store text for each div
		var textMap = {
				local: [local, sync1 + "<br>" + sync2],
				sync: [sync, localT]
			},
			currArr = textMap[getCurrentStorageType()];

		q(".storageMode .current p").html(currArr[0]);
		q(".storageMode .transfer p").html(currArr[1]);

		// display current hotkey combo
		qClsSingle("hotkey_display").html(getCurrentHotkey());

		updateStorageAmount();

		// we need to set height of logo equal to width
		// but css can't detect height so we need js hack
		var logo = qClsSingle("logo");
		window.on("resize", pk.debounce(function windowResizeHandler() {
			logo.style.width = logo.clientHeight + "px";
			Folder.implementChevronInFolderPath();
		}, 300));
	}
})();
