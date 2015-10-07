(function(){
	"use strict";

	window.onload = init;
	
	var storage = chrome.storage.local,
		DataName = "UserSnippets",
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
		};

	function DB_setValue(name, value, callback) {
		var obj = {};
		obj[name] = value;
		storage.set(obj, function() {
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

	function DB_save(callback) {
		DB_setValue(DataName, Data, function() {
			if(callback) callback();
		});
	}

	function checkRuntimeError(){
		if(chrome.runtime.lastError){
			alert("An error occurred! Please press [F12], copy whatever is shown in the 'Console' tab and report it at my email: prokeys.feedback@gmail.com . This will help me resolve your issue and improve my extension. Thanks!");
			console.log(chrome.runtime.lastError);
			return true;
		}
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
		var ul = $("#settings ul");

		// if atleast one blocked site
		if(Data.blockedSites[0]) ul.innerHTML = "";
		else{
			ul.innerHTML = "<li>None Currently</li>";

			return; // exit
		}

		for(var i = 0, len = Data.blockedSites.length; i < len; i++){
			var li = document.createElement("li");

			var pElm = document.createElement("p");
			pElm.innerHTML = Data.blockedSites[i];
			li.appendChild(pElm);

			var delDiv = document.createElement("div");
			delDiv.innerHTML = "Unblock";
			li.appendChild(delDiv);

			ul.appendChild(li);
		}
	}

	// inserts in the table the chars to be auto-inserted
	function listAutoInsertChars(){
		var arr = Data.charsToAutoInsertUserList,
			table = $("#settings table"),
			// used to generate table in loop
			thead, tr, td1, td2, td3, input_box;

		// clear the table initially
		table.innerHTML = "";

		for(var i = 0, len = arr.length; i < len; i++){
			tr = document.createElement("tr");
			td1 = document.createElement("td");
			td2 = document.createElement("td");
			td3 = document.createElement("td");

			tr.appendChild(td1).innerHTML = arr[i][0];
			tr.appendChild(td2).innerHTML = arr[i][1];
			tr.appendChild(td3).innerHTML = "Remove";

			table.appendChild(tr);
		}

		if(len === 0)
			table.innerHTML = "None currently. Add new:";
		else{ // insert character-counter pair <thead> elements
			thead = document.createElement("thead");
			tr = document.createElement("tr");

			tr.appendChild(document.createElement("th")).innerHTML = "Character";
			tr.appendChild(document.createElement("th")).innerHTML = "Counterpart";

			thead.appendChild(tr);

			table.insertBefore(thead, table.firstChild);
		}

		input_box = table.lastChild.firstChild;

		// if there is no input box present or there is no auto-insert char
		if( !(input_box && /input/.test(input_box.innerHTML)) || len === 0)
			appendInputBoxesInTable(table);
	}

	function searchAutoInsertChars(firstChar, index){
		var arr = Data.charsToAutoInsertUserList;

		for(var i = 0, len = arr.length; i < len; i++){
			if(arr[i][0] === firstChar){

				// if index; return index along with counterpart
				if(index){
					return [i, arr[i][1]];
				}else{ //return only counterpart
					return arr[i][1];
				}
			}
		}

		return undefined;
	}

	function appendInputBoxesInTable(table){
		// now create a last input field also
		var tr = document.createElement("tr");

		var td1 = document.createElement("td"),
			td2 = document.createElement("td"),
			td3 = document.createElement("td");

		td1.innerHTML = "<input type='text' placeholder='Type new character' class='auto-insert-char input'>";
		td2.innerHTML = "<input type='text' placeholder='Type its counterpart' class='auto-insert-char input'>";
		td3.innerHTML = "<input type='button' value='Save' class='auto-insert-char button'>";

		tr.appendChild(td1);
		tr.appendChild(td2);
		tr.appendChild(td3);

		table.appendChild(tr);
	}

	function isTimestampValid(inp){
		inp = inp.split(/[, ]+/g);

		var m = inp[0],
			d = parseInt(inp[1] || "0", 10),
			y = parseInt(inp[2] || "0", 10);

		if(d < 0 || y < 0) return false; 

		switch(m){
			case "January":
			case "March":
			case "May":
			case "July":
			case "August":
			case "October":
			case "December":
				return d <= 31;
			case "April":
			case "June":
			case "September":
			case "November":
				return d <= 30;
			case "February":
				return d <= 29;
			default:
				return false;
		}
		
		return true;
	}

	// allowDuplicates -> used in options.js[areSnippetsValid]
	function validateSVal(sVal){
		var len = sVal.length;
		
		return len <= SNIP_NAME_LIMIT && len !== 0 &&
			!/^%.+%$|\n|\s+/.test(sVal)	&&
			![][sVal];
	}

	function validateLVal(lVal){
		var len = lVal.length;
		return len <= SNIP_BODY_LIMIT && len !== 0;
	}
	
	// validates snippet array received from user
	// during restore
	function areSnippetsValid(snippets){
		var props = ["name", "body", "timestamp"],
			kVal, checkFunc, checks = {
				"body": validateLVal,
				"name": validateSVal,
				"timestamp": isTimestampValid
			};

		for(var i = 0, len = snippets.length, obj, counter; i < len; i++){
			obj = snippets[i]; // obj is the current object

			// check whether item of snippets is object
			if(Object.prototype.toString.call(obj) !== "[object Object]")
				return "The " + (i + 1) + "th element in 'snippets' list was not a snippet.";

			// counter to make sure no extra properties
			counter = 0;

			// check whether this item has all required properties
			for(var k in obj){
				// if invalid property or not of string type
				if(props.indexOf(k) === -1 || typeof obj[k] !== "string") return "Invalid property " + k + " in " + (i + 1) + "th snippet";
				else counter += 1;

				kVal = obj[k]; // timestamp validation result
				checkFunc = checks[k];
				
				if(checkFunc && checkFunc(kVal) !== true){
					return "Invalid value for property " + k + " in " + (i + 1) + "th snippet";
				}
			}

			if(counter !== 3) return "Expected 3 properties in " + (i + 1) + "th snippet. Instead got " + counter;
		}

		i = 0; len = snippets.length;

		for(; i < len; i++){
			for(var j = i + 1; j < len; j++){
				if(snippets[i].name === snippets[j].name) 
					return "Duplicate snippets: " + (i + 1) + " " + (j + 1);
			}
		}

		return true;
	}

	// receives charToAutoInsertUserList from user
	// during restore and validates it
	function validateCharListArray(charList){
		for(var i = 0, len = charList.length, item; i < len; i++){
			item = charList[i];

			// item should be array
			if(Object.prototype.toString.call(item) !== "[object Array]")
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

		return true;
	}

	// receives data object and checks whether
	// it has only those properties which are required
	// and none other
	function validateRestoreData(data){
		var propCount = 0,
			// the list of the correct items
			correctProps = ["blockedSites", "charsToAutoInsertUserList", "dataVersion",
					"language", "snippets", "tabKey", "visited", "hotKey"],
			msg = "Data had invalid property: ";

		for(var prop in data){
			if(correctProps.indexOf(prop) > -1){
				propCount++;

				switch(prop){
					case "blockedSites":
					case "charsToAutoInsertUserList":
					case "snippets":
					case "hotKey":
						if(Object.prototype.toString.call(data[prop]) !== "[object Array]")
							return "Property " + prop + " not set to an array";
						break;
					case "language":
						if(data[prop] !== "English") return "'language' property not set to 'English'";
						break;
					case "dataVersion":
						if(data[prop] !== 1) return "'dataVersion' property not set to 1";
						break;
					case "tabKey":
					case "visited":
						if(typeof data[prop] !== "boolean") return prop + " property did not have a true/false value";
						break;
					default: // possibly wrong property
						return msg + prop;
				}
			}
			// invalid property in data
			else{
				return msg + prop;
			}
		}
		
		var actualPropsNumber = correctProps.length;
		// number of properties
		if(propCount !== actualPropsNumber)
			return "Expected " + actualPropsNumber + " properties in data; instead got " + propCount + " properties.";
			
		var vld1 = areSnippetsValid(data.snippets);
		if(typeof vld1 === "string") return vld1;
		
		var vld2 = validateCharListArray(data.charsToAutoInsertUserList);
		if(typeof vld2 === "string") return vld2;

		for(var k = 0, len = data.blockedSites.length, elm; k < len; k++){
			elm = data.blockedSites[k];

			// check type
			if(typeof(elm) !== "string")
				return "An element of blocked sites was not a string.";

			// make sure there's no www
			if(elm[0] + elm[1] + elm[2] === "www") return "An element of blocked sites began with a www.";

			// check duplicate
			for(var j = k + 1; j < len; j++)
				if(elm === data.blockedSites[j]) return "Two elements of blocked sites were duplicates";
		}

		return true;
	}

	// changes type of storage: local-sync, sync-local
	function changeStorageType(){
		// property MAX_ITEMS is present only in sync

		storage = storage.MAX_ITEMS ? chrome.storage.local : chrome.storage.sync;
	}

	// transfer data from one storage to another
	function migrateData(transferData){
		var COPY = cloneObject(Data); // maintain a copy

		// make current storage unusable
		Data.snippets = false;

		DB_save(function(){
			if(transferData){
				changeStorageType();
				
				// get the copy
				Data = cloneObject(COPY);

				DB_save(function(){
					location.reload();
				});
			}else location.reload();
		});
	}

	function getSnippetPrintData(){
		var snp = Data.snippets,
			res = "";

		for(var i = 0, len = snp.length; i < len; i++){
			var sn = snp[i];

			res += sn.name;
			res += "\n\n";
			res += sn.body;
			res += "\n\n--\n\n";
		}

		return res;
	}

	// returns the current hotkey in string format
	// example: ["shiftKey", 32] returns Shift+Space
	function getCurrentHotkey(){
		var combo = Data.hotKey.slice(0),
			result = "";

		// dual-key combo
		if(combo[1]){
			result += combo[0] === "shiftKey" ? "Shift" :
					combo[0] === "ctrlKey" ? "Ctrl" :
					combo[0] === "ctrlKey" ? "Alt" :
					combo[0] === "metaKey" ? "Meta" : "";

			result += " + ";

			// remove this element we just checked
			combo = [combo[1]];
		}

		result += combo[0] === 13 ? "Enter" :
					combo[0] === 32 ? "Space" :
					String.fromCharCode(combo[0]);

		return result;
	}

	function blockSite(){
		var regex = /(\w+\.)+\w+/,
			value = this.value;

		// invalid domain entered; exit
		if( !(regex.test(value)) ) { alert("Invalid form of site address entered."); return;}

		// already a blocked site
		if( isBlockedSite(value) ) { alert("This site is already blocked."); return;}

		// has a `www` at start
		if( /^www\./.test(value) ) {alert("Do not include `www` at the start."); return; }
		if( /^https?:\/\//g.test(value) ) {alert("Do not include `http://` or `https://` at the start"); return;}

		// reset its value
		this.value = "";

		Data.blockedSites.push(value);

		DB_save(function(){
			if(!checkRuntimeError()){
				alert("Blocked " + value);
				chrome.extension.getBackgroundPage()
					.addRemoveBlockedSite(value, true);
			}
		});

		listBlockedSites();
	}

	function init(){
		var backUpHiddenDiv = $("#backup .backupShow"),
			restoreDiv = $("#backup .restoreShow"),
			restoreTextarea = $("#backup .restoreShow textarea"),
			changeHotkeyBtn = $(".change_hotkey"),
			hotkeyListener = $(".hotkey_listener");

		// gplus button handler
		$(".g-plus").on("click", function(){
			window.open(this.href, "", "menubar=no,toolbar=no,resizable=yes,scrollbars=yes,height=600,width=600");
			return false;
		});

		$("#tryit .nav p").on("click", function(){
			var ots, s = "show", t = "#tryit "; // otherSibling
			
			if(!this.hasClass("show")){
				// hide current
				ots = $(t + ".nav ." + s);
				ots.toggleClass(s);
				$(t + ots.dataset.selector).toggleClass(s);
				
				this.toggleClass(s);
				$(t + this.dataset.selector).toggleClass(s);
			}
		});
		
		/* set up accordion in help page */
		$("#help section dd").forEach(function(elm){
			elm.classList.add("hide");
		});

		$("#help section dt").on("click", function(){
			this.nextElementSibling.toggleClass("hide");
		});

		// used when buttons in navbar are clicked
		// or when the url contains an id of a div
		function showHideDIVs(newID){
			$("#content > .show").toggleClass("show");
			$("#content > #" + newID).toggleClass("show");
			// the page shifts down a little
			// for the exact location of the div;
			// so move it back to the top
			document.body.scrollTop = 0;
		}
		
		$("#btnContainer button").on("click", function(){
			showHideDIVs(this.dataset.name);
		});

		document.on("click", function(event){
			var node = event.target, index, tagName = node.tagName, domain;

			// blocked sites Unblock button
			if(node.innerHTML === "Unblock"){
				domain = node.previousElementSibling.innerHTML;

				index = Data.blockedSites.indexOf(domain);

				Data.blockedSites.splice(index, 1);

				//chrome.extension.getBackgroundPage().addRemoveBlockedSite(domain, false);
				
				DB_save(checkRuntimeError);

				listBlockedSites();
			}
			// tabbed layout inactive div
			else if(tagName === "DIV" && node.hasClass("tab") &&
							node.hasClass("inactive")){
				node.classList.remove("inactive");
				node.classList.add("active");
			}else if(tagName === "DIV" && node.hasClass("tab") &&
							node.hasClass("active")){
				node.classList.add("inactive");
				node.classList.remove("active");
			}
			// Remove button
			else if(tagName === "TD" && node.innerHTML === "Remove"){
				var firstChar = formatHTML(node.previousElementSibling.previousElementSibling.innerHTML, "makeHTML");

				// retrieve along with index (at second position in returned array)
				index = searchAutoInsertChars(firstChar, true);

				if(index !== undefined){

					Data.charsToAutoInsertUserList.splice(index[0], 1);

					DB_save(function(){
						alert("Removed");
						listAutoInsertChars();
					});
				}
			}
			// newAutoInsertChar
			else if(tagName === "INPUT" && node.value === "Save"){
				// get elements
				var newAutoInsertChar = document.querySelectorAll("#settings table .auto-insert-char"),
					elmChar1 = newAutoInsertChar[0],
					elmChar2 = newAutoInsertChar[1];

				var text1 = elmChar1.value;

				var str = "Please type atleast/only one character in ";

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
					alert("This character is already present.");
					return false;
				}

				// first insert in user list
				Data.charsToAutoInsertUserList.push([text1, text2]);

				DB_save(function(){
					alert("Saved!");
					listAutoInsertChars();
				});
			}
		});

		// on user input in tab key setting
		$("#tabKey").on("change", function(){

			// change Data
			Data.tabKey	= $("#tabKey").checked;

			// and save it
			DB_save(function(){
				checkRuntimeError();
				alert("Saved!");
			});
		});

		$("#settings .siteBlockInput").on("keyup", function(event){
			if(event.keyCode === 13)
				blockSite.call(this);
		});

		// siteBlockButton
		$("#settings .siteBlockInput + button").on("click", function(){
			blockSite.call(this.previousElementSibling);
		});

		// settings Tip paragraph
		$("#settings span.tip_auto_insert").on("click", function(){
			alert("Use only those characters which can easily be typed like `(` and not those characters which are not directly available on your keyboard.");
		});

		var url = window.location.href;

		if(/#\w+$/.test(url) && (!/tryit|symbolsList/.test(url)))
			// get the id and show divs based on that
			showHideDIVs(url.match(/#(\w+)$/)[1]);
		
		// boolean parameter transferData: dictates if one should transfer data or not
		function storageRadioBtnClick(str, transferData){
			var bool = false,
				storageBool = (storage.MAX_ITEMS ? "sync" : "local") === str; 

			// if storage is already local
			if(storageBool){
				alert("Storage type is already " + str);
				bool = true;
			}
			else if(!confirm("Migrate data to " + str + " storage? It is VERY NECESSARY to take a BACKUP before proceeding.")){
				bool = true; this.checked = false; }

			if(bool) return;
			
			migrateData(transferData);

			alert("Done! Data migrated to " + str + " storage successfully!");
		}

		// event delegation
		$("#storageMode").on("click", function(){
			var c = $("#storageMode input:checked");
			if(c)
				storageRadioBtnClick.call
					(this, c.dataset.name, c.id === "sync2" ? false : true);
		});
		
		// Select Text button
		$("#backup .backupShow button").on("click", function(){
			var sel = window.getSelection(),
				range = document.createRange();

			range.selectNodeContents($("#backup .backupShow .text"));
			sel.removeAllRanges();
			sel.addRange(range);
		});

		// Close Dialog button
		$("#backup .backupShow .close").on("click", function(){
			backUpHiddenDiv.toggleClass("shown");
		});

		$("#backup .backup").on("click", function(){
			backUpHiddenDiv.toggleClass("shown");

			var textDiv = backUpHiddenDiv.querySelector(".text");

			textDiv.innerText = 
				JSON.stringify(Data, undefined, 2);

			var sel = window.getSelection(),
				range = document.createRange();

			range.selectNodeContents(textDiv);
			sel.removeAllRanges();
			sel.addRange(range);
		});

		$("#backup .restore").on("click", function(){
			restoreDiv.toggleClass("shown");

			restoreTextarea.value = "";
			restoreTextarea.focus();
		});

		// Close Dialog button
		restoreDiv.querySelector(".close").on("click", function(){
			restoreDiv.toggleClass("shown");
		});

		// The button to initiate "Restore" process
		restoreDiv.querySelector("button").on("click", function(){
			var text = restoreTextarea.value,
				data,
				isDataValid;

			// first validate values
			try{
				data = JSON.parse(text);
			}catch(error){
				alert("Data entered was of a wrong format (invalid JSON object). Please mail it to me at prokeys.feedback@gmail.com so that I can fix the problem.");
				return;
			}

			try{
				// make sure it has only those fields
				// which should be present
				isDataValid = validateRestoreData(data);
			}catch(e){
				console.log(e);
				alert("Oops! An error occurred. Press Ctrl/Cmd + Shift + J to view the error. Please mail it to me at prokeys.feedback@gmail.com so that I can fix it.");
				return;
			}

			if(typeof isDataValid === "string"){
				alert(isDataValid); return;
			}

			Data = cloneObject(data);

			DB_save(function(){
				alert("Data restored successfully!");

				window.location.reload();
			});
		});

		$("#backup .print").onclick = function(){
			backUpHiddenDiv.classList.add("shown");
			backUpHiddenDiv.classList.remove("hidden");

			var textDiv = backUpHiddenDiv.querySelector(".text");

			textDiv.innerText = getSnippetPrintData();

			var sel = window.getSelection(),
				range = document.createRange();

			range.selectNodeContents(textDiv);
			sel.removeAllRanges();
			sel.addRange(range);

			alert("Use this text to print snippets");
		};

		// prevent exposure of locals
		(function(){
			// stores hotkey combo
			var	combo,
				// determines if keyCode is valid
				// non-control character
				valid;
			
			// the combo refreshes with every key down
			// so we don't need keyCount to keep track of
			// number of keys pressed
			hotkeyListener.on("keydown", function(event){
				var arr = [], keycode = event.keyCode;

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

				// set the keys
				combo = arr.slice(0);
			});

			hotkeyListener.on("keyup", function(){								
				if(valid){
					Data.hotKey = combo.slice(0);

					DB_save(function(){
						location.href = "#settings";
						location.reload();
					});
				}else{
					alert("Setting new hotkey failed!");
					alert("It was missing a key other than ctrl/alt/shift/meta key. Or, it was a key-combo reserved by the Operating System. \
							Or you may try refreshing the page. ");
				}

				changeHotkeyBtn.disabled = false;
				changeHotkeyBtn.innerHTML = "Change hotkey";
			});

			changeHotkeyBtn.on("click", function(){
				this.disabled = true; // first disable the button
				this.innerHTML = "Press new hotkeys";

				combo = ["", ""];
				valid = false;
				
				hotkeyListener.focus();

				// after five seconds, automatically reset the button to default
				setTimeout(function(){
					changeHotkeyBtn.disabled = false;
					changeHotkeyBtn.innerHTML = "Change hotkey";
				}, 5000);
			});
		})();
	}

	DB_load(function(){
		/* Consider two PCs. Each has local data set.
			When I migrate data on PC1 to sync. The other PC's local data remains.
			And then it overrides the sync storage. The following lines
			manage that*/

		// wrong storage mode
		if(Data.snippets === false){
			// change storage to other type
			changeStorageType();

			DB_load(setEssentialItemsOnDBLoad);
		}else
			setEssentialItemsOnDBLoad();
	});
	
	var local = "<b>Local</b> - storage only on one's own PC. More storage space than sync",
		localT = "<label for=\"local\"><input type=\"radio\" id=\"local\" data-name=\"local\"/><b>Local</b></label> - storage only on one's own PC locally. Safer than sync, and has more storage space. Note that on migration from sync to local, data stored on sync across all PCs would be deleted, and transfered into Local storage on this PC only.",
		sync1 = "<label for=\"sync\"><input type=\"radio\" id=\"sync\" data-name=\"sync\"/><b>Sync</b></label> - select if this is the first PC on which you are setting sync storage",
		sync2 = "<label for=\"sync2\"><input type=\"radio\" id=\"sync2\" data-name=\"sync\"/><b>Sync</b></label> - select if you have already set up sync storage on another PC and want that PCs data to be transferred here.",
		sync = "<b>Sync</b> - storage synced across all PCs. Offers less storage space compared to Local storage.";

	function setEssentialItemsOnDBLoad(){		
		// on load; set checkbox state to user preference
		$("#tabKey").checked = Data.tabKey;

		// now list blocked sites
		listBlockedSites();

		// list auto-insert chars
		listAutoInsertChars();

		var storageType = storage.MAX_ITEMS ? "sync" : "local",
			cT, tT; // store text for each div

		if(storageType === "local"){
			cT = local;	tT = sync1 + "<br>" + sync2;
		}else{
			cT = sync;	tT = localT;
		}
		
		$("#storageMode .current p").innerHTML = cT;
		$("#storageMode .transfer p").innerHTML = tT;

		// display current hotkey combo
		$(".hotkey_display").innerHTML = getCurrentHotkey();
	}
})();