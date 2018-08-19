/* global q, Folder, pk, Data */
/*
	1. this file manipulates data (loading, saving) as well as modal box insertion
	that is unique to only independent webpage so that the remaining detector.js
	can be inserted in the webpages as well as options page (for the try it editor)
	2. this file operates as a content script ONLY
	
	Note:
	1. chrome:// urls are inaccessible by content script so modal box cannot be inserted
		there
*/
(function() {
	var storage = chrome.storage.local,
		SETTINGS_DEFAULTS = {
			snippets: [],
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
		};
	// globals are: (used by detector.js)
	pk.DB_loaded = false;
	window.Data = JSON.parse(JSON.stringify(SETTINGS_DEFAULTS));
	pk.OLD_DATA_STORAGE_KEY = "UserSnippets";
	pk.NEW_DATA_STORAGE_KEY = "ProKeysUserData";
	pk.DATA_KEY_COUNT_PROP = pk.NEW_DATA_STORAGE_KEY + "_-1";
	pk.snipNameDelimiterListRegex = null;

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
			if (pk.isObjectEmpty(r[pk.OLD_DATA_STORAGE_KEY])) DB_setValue(pk.OLD_DATA_STORAGE_KEY, Data, callback);
			else if (r[pk.OLD_DATA_STORAGE_KEY].dataVersion != Data.dataVersion)
				DB_setValue(pk.OLD_DATA_STORAGE_KEY, Data, callback);
			else {
				//	console.dir(r);
				Data = r[pk.OLD_DATA_STORAGE_KEY];
				if (callback) callback();
			}
		});
	}

	function DB_save(callback) {
		DB_setValue(pk.OLD_DATA_STORAGE_KEY, Data, function() {
			if (callback) callback();
		});
	}

	// save data not involving snippets
	function saveData(msg, callback) {
		Data.snippets = Data.snippets.toArray();

		DB_save(function() {
			Data.snippets = Folder.fromArray(Data.snippets);
			if (typeof msg === "function") msg();
			else if (typeof msg === "string") alert(msg);
			pk.checkRuntimeError();

			if (callback) callback();
		});
	}

	// changes type of storage: local-sync, sync-local
	function changeStorageType() {
		// property MAX_ITEMS is present only in sync

		if (storage.MAX_ITEMS) storage = chrome.storage.local;
		else storage = chrome.storage.sync;
	}

	function setEssentialItemsOnDBLoad() {
		pk.DB_loaded = true;
		Data.snippets = Folder.fromArray(Data.snippets);
		Folder.setIndices();
		pk.snipNameDelimiterListRegex = new RegExp("[" + pk.escapeRegExp(Data.snipNameDelimiterList) + "]");
	}

	// attach click/keypress handler for the two buttons
	function attachModalHandlers(modal, shouldBlockSite) {
		function success() {
			var txt = (shouldBlockSite ? "" : "un") + "blocked",
				reloadHandler = function() {
					window.location.reload();
				},
				reloadHandlerKeyup = keyHandlerCreator(reloadHandler),
				reloadBtn = q
					.new("BUTTON")
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

		function keyHandlerCreator(handler) {
			return function(e) {
				if (e.keyCode === 13) handler.call(this, e);
			};
		}

		function closeModal() {
			modal.parentNode.removeChild(modal);
		}

		function OKBtnEvent() {
			URL = siteNameInput.value;
			var idx;

			if (shouldBlockSite) {
				Data.blockedSites.push(URL);
				saveData(success);
			} else {
				idx = Data.blockedSites.indexOf(URL);

				if (idx !== -1) {
					Data.blockedSites.splice(idx, 1);
					// since we transform cancelBtn into close modal btn
					// suddenly, the enter keyup event on the OK Btn
					// gets transferred to close modal btn
					// closing the modal almost immediately.
					// 1000ms delay experimentally established
					saveData(success);
				} else {
					var userMeant = [],
						// create regex after removing the part after /
						regex = new RegExp(URL.replace(/\/.*$/gi, ""), "gi");

					Data.blockedSites.forEach(function(e) {
						if (regex.test(e)) userMeant.push(e);
					});

					var alertText =
						"URL " + URL + " is already unblocked. Please see the Settings page for list of blocked sites.";

					if (userMeant.length > 0)
						alertText +=
							" Or maybe you meant a blocked site from one of the following: " + userMeant.join(", ");

					alert(alertText);
				}
			}
		}

		var msgElm = modal.querySelector(".block-dialog-message"),
			siteNameInput = modal.querySelector(".site-name"),
			btnContainer = modal.querySelector(".block-dialog-buttons"),
			buttons = modal.querySelectorAll(".block-dialog-button"),
			OKBtn = buttons[0],
			cancelBtn = buttons[1],
			siteInputElm = modal.querySelector(".block-dialog-form input"),
			keyCloseModal = keyHandlerCreator(closeModal),
			keyOKBtn = keyHandlerCreator(OKBtnEvent),
			URL;

		OKBtn.on("click", OKBtnEvent).on("keyup", keyOKBtn);
		cancelBtn.on("click", closeModal).on("keyup", keyCloseModal);
		siteInputElm.on("keyup", keyOKBtn);
	}

	// alert user about difference of xyz.com/path vs xyz.com
	function getURLAlertingText(url) {
		url = url.split("/");

		var path = url[1],
			site = url[0];

		if (!path) return "";
		else
			return (
				"Remember that you have to remove the /" +
				path +
				" part of the URL above to block the entire " +
				site +
				" site."
			);
	}

	pk.showBlockSiteModal = function(msg) {
		var modal = q.new("div").html(msg.modal).firstChild,
			action = msg.action,
			shouldBlockSite = action === "Block",
			siteNameElm = modal.querySelector(".site-name"),
			// alert user about difference of xyz.com/path vs xyz.com
			// only alert when user is blocking site
			URLAlertingText = shouldBlockSite ? getURLAlertingText(msg.url) : "";

		attachModalHandlers(modal, shouldBlockSite);

		modal.querySelector(".action").html(action);
		siteNameElm.html(msg.url);

		if (URLAlertingText !== "") {
			modal.querySelector(".block-dialog-message").appendChild(q.new("P").html(URLAlertingText));
		}

		window.document.body.appendChild(modal);
		siteNameElm.focus();
	};

	// asynchoronous function call
	DB_load(function() {
		// wrong storage Placeholder.mode
		if (Data.snippets === false) {
			// change storage to other type
			changeStorageType();

			DB_load(setEssentialItemsOnDBLoad);

			return;
		}

		setEssentialItemsOnDBLoad();
	});
})();
