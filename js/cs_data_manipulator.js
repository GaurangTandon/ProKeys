/*
	this file manipulates data (loading, saving) as well as modal box insertion
	that is unique to only independent webpage so that the remaining detector.js
	can be inserted in the webpages as well as options page (for the try it editor)
	
	Note:
	1. chrome:// urls are inaccessible by content script so modal box cannot be inserted
		there
*/
(function(){	
	var storage = chrome.storage.local;
	
	// globals are:
	window.DB_loaded = false;
	window.Data = {
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
	};
	window.OLD_DATA_STORAGE_KEY = "UserSnippets";
	window.NEW_DATA_STORAGE_KEY = "ProKeysUserData";
	window.DATA_KEY_COUNT_PROP = NEW_DATA_STORAGE_KEY + "_-1";
	/*
	// function to save data for specific
	// name and value
	function DB_setValue(name, value, callback) {
		var obj = {};
		obj[name] = value;

		storage.set(obj, function() {
			if(callback) callback();
		});
	}*/

	// sets the global variable Data (in object format; not string)
	// after retrieval  of user's data
	function DB_load(callback) {
		var itemCount, i,
			newKey2 = NEW_DATA_STORAGE_KEY + "_0",
			restoredObjectStr = "";

		function storeDataInNewStorageFormat(){
			storage.set({ newKey2 : JSON.stringify(Data), DATA_KEY_COUNT_PROP: 1}, function(){
				if(callback) callback();
			});
		}

		// get all of the data at once, then take what's required
		storage.get(null, function(data){
			if(data.hasOwnProperty(DATA_KEY_COUNT_PROP)){
				itemCount = data[DATA_KEY_COUNT_PROP];
				
				for(i = 0; i < itemCount; i++)
					restoredObjectStr += data[NEW_DATA_STORAGE_KEY + "_" + i];		
				
				Data = JSON.parse(restoredObjectStr);
				
				if(callback) callback();
			}
			// user uses data <= v3.0.0.1
			else if(data.hasOwnProperty(OLD_DATA_STORAGE_KEY)){			
				Data = data[OLD_DATA_STORAGE_KEY];
				
				// make async calls to:
				// 1. remove the older data
				// 2. set new key2
				// 3. call callback
				storage.remove(OLD_DATA_STORAGE_KEY, storeDataInNewStorageFormat);
			}
			// data does not exist due to first time
			// (1) install (2) transfer to sync storage
			else{
				// Data in this else branch refers to sample data 
				// stored in global variable
				storeDataInNewStorageFormat();
			}
		});
	}

	// NOTE: chunking data is NOT required in local storage since it does NOT
	// have QUOTA_BYTES_PER_ITEM, but best way is to maintain consistency in storage
	// methods for both sync and local storage
	function DB_save(callback) {
		function afterStorageClear(){
			storage.set(storageObj, function(){
				if(callback) callback();
			});
		}
		var jsonstr = JSON.stringify(Data), i = 0, storageObj = {},
			// (note: QUOTA_BYTES_PER_ITEM only on sync storage)
			maxBytesPerItem = chrome.storage.sync.QUOTA_BYTES_PER_ITEM, 
			// since the key uses up some per-item quota, use
			// "maxValueBytes" to see how much is left for the value
			maxValueBytes, index, segment, counter;

		// split jsonstr into chunks and store them in an object indexed by `key_i`
		while(jsonstr.length > 0) {
			index = NEW_DATA_STORAGE_KEY + "_" + i++;
			maxValueBytes = maxBytesPerItem - lengthInUtf8Bytes(index);
			
			counter = maxValueBytes;
			segment = jsonstr.substr(0, counter);			
			while(lengthInUtf8Bytes(JSON.stringify(segment)) > maxValueBytes)
				segment = jsonstr.substr(0, --counter);
			
			storageObj[index] = segment;
			jsonstr = jsonstr.substr(counter);
		}
		// later used by retriever function
		storageObj[DATA_KEY_COUNT_PROP] = i;

		// say user saves till chunk 20 in case I
		// in case II, user deletes several snippets and brings down
		// total no. of "required" chunks to 15; however, the previous chunks
		// (16-20) remain in memory unless they are "clear"ed.
		storage.clear(function(){
			if(getCurrentStorageType() === "sync")
				// only 120ops allowed per min
				// only 2ops allowed per sec
				setTimeout(afterStorageClear, 2000);
			else afterStorageClear();
		});
	}
		
	// save data not involving snippets
	function saveData(msg, callback){
		Data.snippets = Data.snippets.toArray();
		
		DB_save(function(){
			Data.snippets = Folder.fromArray(Data.snippets);
			if(typeof msg === "function") msg();
			else if(typeof msg === "string") alert(msg);
			checkRuntimeError();
			
			if(callback) callback();
		});
	}
	
	// changes type of storage: local-sync, sync-local
	function changeStorageType(){
		// property MAX_ITEMS is present only in sync

		if(storage.MAX_ITEMS) storage = chrome.storage.local;
		else storage = chrome.storage.sync;
	}
	
	// get type of current storage as string
	function getCurrentStorageType(){
		// property MAX_ITEMS is present only in sync
		return storage.MAX_ITEMS ? "sync" : "local";
	}
	
	function setEssentialItemsOnDBLoad(){
		DB_loaded = true;
		Data.snippets = Folder.fromArray(Data.snippets);
		tabKeySpace = Data.tabKey;
		charsToAutoInsertUserList = Data.charsToAutoInsertUserList;
		Folder.setIndices();
	}
	
	// attach click/keypress handler for the two buttons
	function attachModalHandlers(modal, shouldBlockSite){
		function success(){
			var txt = (shouldBlockSite ? "" : "un") + "blocked",
				reloadHandler = function(){ window.location.reload(); },
				reloadHandlerKeyup = keyHandlerCreator(reloadHandler),
				reloadBtn = $.new("BUTTON")
							.html("Reload page")
							.on("click", reloadHandler)
							.on("keyup", reloadHandlerKeyup);
			
			msgElm.text("URL " + URL + " has been " + txt + ". Reload page for changes to take effect.");
			btnContainer.removeChild(OKBtn);
			cancelBtn.html("Close dialog box");
			
			reloadBtn.classList.add("block-dialog-button-primary", "block-dialog-button");
			reloadBtn.style.marginRight = "10px";
			
			btnContainer.insertBefore(reloadBtn, cancelBtn);
			
			reloadBtn.focus();
		}
		
		function keyHandlerCreator(handler){
			return function(e){
				if(e.keyCode === 13)
					handler.call(this, e);
			};
		}
		
		function closeModal(){
			modal.parentNode.removeChild(modal);
		}
		
		function OKBtnEvent(){
			URL = siteNameInput.value;
			var idx;
			
			if(shouldBlockSite){
				Data.blockedSites.push(URL);
				saveData(success);
			}
			else{
				idx = Data.blockedSites.indexOf(URL);
				
				if(idx !== -1){
					Data.blockedSites.splice(idx, 1);
					// since we transform cancelBtn into close modal btn
					// suddenly, the enter keyup event on the OK Btn
					// gets transferred to close modal btn
					// closing the modal almost immediately.
					// 1000ms delay experimentally established
					saveData(success);
				}
				else {
					var userMeant = [],
						// create regex after removing the part after /
						regex = new RegExp(URL.replace(/\/.*$/gi, ""), "gi");
						
					Data.blockedSites.forEach(function(e){
						if(regex.test(e)) userMeant.push(e);
					});					
					
					var alertText = 
						"URL " + URL + " is already unblocked. Please see the Settings page for list of blocked sites.";
					
					if(userMeant.length > 0)
						alertText += " Or maybe you meant a blocked site from one of the following: " + userMeant.join(", ");
					
					alert(alertText);
				}
			}
		}
		
		var msgElm = modal.querySelector(".block-dialog-message"),
			siteNameInput = modal.querySelector(".site-name"), 
			btnContainer = modal.querySelector(".block-dialog-buttons"),
			buttons = modal.querySelectorAll(".block-dialog-button"),
			OKBtn =  buttons[0],
			cancelBtn =  buttons[1],
			siteInputElm = modal.querySelector(".block-dialog-form input"),
			keyCloseModal = keyHandlerCreator(closeModal),
			keyOKBtn = keyHandlerCreator(OKBtnEvent),
			URL;
		
		OKBtn.on("click", OKBtnEvent).on("keyup", keyOKBtn);
		cancelBtn.on("click", closeModal).on("keyup", keyCloseModal);
		siteInputElm.on("keyup", keyOKBtn);
	}
	
	// alert user about difference of xyz.com/path vs xyz.com
	function getURLAlertingText(url){
		url = url.split("/");
		
		var path = url[1], site = url[0];
		
		if(!path) return "";
		else return "Remember that you have to remove the /" + path + 
					" part of the URL above to block the entire " + site + " site.";
	}
	
	window.showBlockSiteModal = function(msg){
		var modal = $.new("div").html(msg.modal).firstChild,
			action = msg.action,
			shouldBlockSite = action === "Block",
			siteNameElm = modal.querySelector(".site-name"),
			// alert user about difference of xyz.com/path vs xyz.com
			// only alert when user is blocking site
			URLAlertingText = shouldBlockSite ? getURLAlertingText(msg.url) : "";
				
		attachModalHandlers(modal, shouldBlockSite);
		
		modal.querySelector(".action").html(action);
		siteNameElm.html(msg.url);
		
		if(URLAlertingText !== ""){
			modal.querySelector(".block-dialog-message")
				.appendChild($.new("P").html(URLAlertingText));
		}
		
		window.document.body.appendChild(modal);		
		siteNameElm.focus();
	};
	
	// asynchoronous function call
	DB_load(function(){
		// wrong storage Placeholder.mode
		if(Data.snippets === false){
			// change storage to other type
			changeStorageType();

			DB_load(setEssentialItemsOnDBLoad);

			return;
		}

		setEssentialItemsOnDBLoad();
	});
})();