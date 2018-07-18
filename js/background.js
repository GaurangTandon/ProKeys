/* global $, Folder, Data, Generic, chrome , modalHTML, listOfSnippetCtxIDs */
console.log("Loaded once " + new Date());
var contextMenuActionBlockSite,
	wasOnBlockedSite = false,
	BLOCK_SITE_ID = "blockSite", SNIPPET_MAIN_ID = "snippet_main",
	// boolean set to true on updating app as well as when extension loads
	// or after browser restart
	// so that user gets updated snippet list whenever he comes
	// on valid website (not chrome://extension)
	needToGetLatestData = true,
	// can recall at max 10 times
	// for gettting the blocked site status in case of unfinished loading of cs.js
	LIMIT_OF_RECALLS = 10,
	recalls = 0,
	// received from cs.js; when there are mutliple iframes on a page
	// this helps remove the ambiguity as to which one was latest
	// storing it in background.js so as to provide a global one-stop center
	// content scripts, which cannot interact among themselves
	latestCtxTimestamp,
	URL_REGEX = /^(?:(?:https?|ftp):\/\/)(?:\S+(?::\S*)?@)?(?:(?!10(?:\.\d{1,3}){3})(?!127(?:\.\d{1,3}){3})(?!169\.254(?:\.\d{1,3}){2})(?!192\.168(?:\.\d{1,3}){2})(?!172\.(?:1[6-9]|2\d|3[0-1])(?:\.\d{1,3}){2})(?:[1-9]\d?|1\d\d|2[01]\d|22[0-3])(?:\.(?:1?\d{1,2}|2[0-4]\d|25[0-5])){2}(?:\.(?:[1-9]\d?|1\d\d|2[0-4]\d|25[0-4]))|(?:(?:[a-z\u00a1-\uffff0-9]+-?)*[a-z\u00a1-\uffff0-9]+)(?:\.(?:[a-z\u00a1-\uffff0-9]+-?)*[a-z\u00a1-\uffff0-9]+)*(?:\.(?:[a-z\u00a1-\uffff]{2,})))(?::\d{2,5})?(?:\/[^\s]*)?$/;

// for pre.js
window.IN_BG_PAGE = true;
// so that snippet_classes.js can work properly
// doesn't clash with the Data variable in options.js
window.Data = {};
Data.snippets = new Folder("Snippets");
window.listOfSnippetCtxIDs = [];

Folder.setIndices();

function isURL(text) {

	return URL_REGEX.test(text.trim());
}

function getDomain(url) {
	url = url.replace(/^(ht|f)tps?(:\/\/)?(www\.)?/, "").split("/");
	var domain = url[0], path1 = url[1], idx;

	if (path1) {
		// remove all the unnecessary query/anchors parameter content
		idx = path1.indexOf("?");
		if (idx !== -1) path1 = path1.substring(0, idx);

		domain += "/" + path1;
	}

	return domain;
}

function getPasteData() {
	var $elm = $.new("textarea"),
		$actElm = document.activeElement.appendChild($elm).parentNode;

	$elm.focus();
	document.execCommand("Paste", null, null);

	var data = $elm.value;
	$actElm.removeChild($elm);

	return data;
}

function injectScript(tab) {
	if (!tab || !tab.id ||
		/chrome(-extension)?:\/\/|chrome\.google\.com\/webstore/.test(tab.url)) return;

	// loop through content scripts and execute in order
	var contentScripts = chrome.runtime.getManifest().content_scripts[0].js;

	for (var i = 0, len = contentScripts.length; i < len; i++)
		chrome.tabs.executeScript(tab.id, {
			file: contentScripts[i]
		});
}

function createBlockSiteCtxItem() {
	chrome.contextMenus.create({
		id: BLOCK_SITE_ID,
		title: "reload page for blocking site"
	}, function () {
		if (chrome.runtime.lastError) {
			// do nothing
		}
	});
}

function openSnippetsPage(version, reason) {
	chrome.tabs.create({
		url: chrome.extension.getURL("html/options.html#snippets")
	});

	if (reason === "update")
		localStorage.extensionUpdated = true;
}

var currentOmniboxQuery, defaultOmniboxSuggestion;

chrome.omnibox.onInputChanged.addListener(function (text, suggestCallback) {
	currentOmniboxQuery = text;

	Data.snippets.filterSnippetsForOmnibox(text, function (listOfSuggestionObjects) {
		defaultOmniboxSuggestion = listOfSuggestionObjects[0];

		chrome.omnibox.setDefaultSuggestion({
			description: defaultOmniboxSuggestion.description
		});

		suggestCallback(listOfSuggestionObjects.slice(1));
	});
});

chrome.omnibox.onInputEntered.addListener(function (omniboxText, disposition) {
	var URL, query;

	if (omniboxText === currentOmniboxQuery)
		query = defaultOmniboxSuggestion.content;

	if (isURL(query)) URL = query;
	else URL = localStorage.omniboxSearchURL.replace("SEARCH", encodeURIComponent(query));

	chrome.tabs.query({ currentWindow: true, active: true }, function (tabs) {
		chrome.tabs.update(tabs[0].id, {
			url: URL
		});
	});
});

// create modal dialog for blocking site by detector.js
(function createBlockSiteModal() {
	var modalContent = "<div class='prokeys-block block-theme-plain'>\
		<div class='block-overlay'></div>\
		<div class='block-content'>\
			<div class='block-dialog-form'>\
				<div class='block-dialog-message'>Are you sure you want to <span class='action'></span><br> <input type='text' class='site-name'><br> from ProKeys?</div>\
				<div class='block-dialog-buttons'>\
					<input type='button' value='OK' class='block-dialog-button-primary block-dialog-button'>\
					<input type='button' value='Cancel' class='block-dialog-button-secondary block-dialog-button'> </div>\
			</div>\
		</div></div>";

	window.modalHTML = modalContent;
})();

chrome.runtime.onInstalled.addListener(function (details) {
	var text, title, reason = details.reason,
		version = chrome.runtime.getManifest().version;

	if (reason === "install") {
		openSnippetsPage(version);

		title = "ProKeys successfully installed!";
		text = "Thank you for installing ProKeys! Please reload all active tabs for changes to take effect.";

		// inject script into all active tabs
		// so that user is not required to do manual reload
		chrome.tabs.query({}, function (tabs) {
			tabs.forEach(injectScript);
		});
	}
	else if (reason === "update") {
		title = "ProKeys successfully updated to v" + version;
		text = "Please reload active tabs to use the new version.";

		openSnippetsPage(version, reason);
		needToGetLatestData = true;
		addCtxSnippetList();
	}

	// either update or install was there
	if (text !== void 0) {
		// the empty function and string is required < Chrome 42
		chrome.notifications.create("", {
			type: "basic",
			iconUrl: "imgs/r128.png",
			title: title,
			message: text
		}, function (id) { });
	}
});

try {
	updateContextMenu();
} catch (e) {
	console.log("Error while creating context menu - " + e.message);
}

createBlockSiteCtxItem();

chrome.contextMenus.onClicked.addListener(function (info, tab) {
	var id = info.menuItemId,
		url = info.pageUrl, msg, startIndex, snip;

	if (id === BLOCK_SITE_ID) {
		msg = {
			task: "showModal",
			action: contextMenuActionBlockSite,
			url: getDomain(url),
			modal: modalHTML
		};

		chrome.tabs.query({ active: true, currentWindow: true }, function (tabs) {
			chrome.tabs.sendMessage(tabs[0].id, msg);
		});
	}
	else if (Generic.CTX_SNIP_REGEX.test(id)) {
		startIndex = Generic.CTX_START[Generic.SNIP_TYPE].length;
		snip = Data.snippets.getUniqueSnip(id.substring(startIndex));

		chrome.tabs.query({ active: true, currentWindow: true }, function (tabs) {
			if (tabs[0])
				chrome.tabs.sendMessage(tabs[0].id, {
					clickedSnippet: snip.toArray(), ctxTimestamp: latestCtxTimestamp
				});
		});
	}
});

chrome.tabs.onActivated.addListener(function (info) { updateContextMenu(); });

chrome.tabs.onUpdated.addListener(function (tabId, info, tab) {
	chrome.tabs.query({ active: true, currentWindow: true }, function (tabs) {
		if (tabs[0] && tabs[0].id === tabId)
			updateContextMenu();
	});
});

// isRecalled: if the function has been called
// if the response from content script was undefined
// why content script sends undefined response is i don't know
function updateContextMenu(isRecalled) {
	if (isRecalled) recalls++;
	else recalls = 0;

	chrome.tabs.query({ active: true, currentWindow: true }, function (tabs) {
		var isBlocked;

		if (typeof tabs[0] === "undefined") return;

		chrome.tabs.sendMessage(tabs[0].id, { checkBlockedYourself: true }, function (response) {
			isBlocked = response;

			contextMenuActionBlockSite = isBlocked === undefined ? "reload page for (un)blocking" :
				(isBlocked ? "Unblock" : "Block");

			if (isBlocked === undefined) {
				if (recalls <= LIMIT_OF_RECALLS)
					setTimeout(updateContextMenu, 500, true);
				else
					chrome.contextMenus.update(BLOCK_SITE_ID, {
						title: "Unable to block/unblock this site"
					});

				return;
			}

			// remove all snippet support as well
			if (isBlocked) {
				removeCtxSnippetList(true);
				wasOnBlockedSite = true;
			}
			else if (wasOnBlockedSite) {
				wasOnBlockedSite = false;
				addCtxSnippetList();
			}

			chrome.contextMenus.update(BLOCK_SITE_ID, {
				title: contextMenuActionBlockSite + " this site"
			});
		});

		if (needToGetLatestData) {
			chrome.tabs.sendMessage(tabs[0].id, { giveSnippetList: true }, function (response) {
				if (Array.isArray(response)) {
					needToGetLatestData = false;
					loadSnippetListIntoBGPage(response);
					addCtxSnippetList();
				}
			});
		}
	});
}

function addCtxSnippetList(snippets) {
	function addMainEntry() {
		if (hasSnippets) return;

		chrome.contextMenus.create({
			contexts: ["editable"],
			id: SNIPPET_MAIN_ID,
			title: "No snippet to insert"
		}, function () {
			if (chrome.runtime.lastError) {
				// already exists, so first remove it
				chrome.contextMenus.remove(SNIPPET_MAIN_ID);
				addMainEntry();
			}
		});
	}

	// just in case previous data is larger that current data
	// we might have overlapping data display so avoid all problems
	removeCtxSnippetList(true);
	snippets = snippets || Data.snippets;
	var hasSnippets = snippets.list.length > 0;
	addMainEntry();

	// now create the new context menus
	snippets.createCtxMenuEntry();
}

function removeCtxSnippetList(removeMainEntryFlag) {
	while (listOfSnippetCtxIDs.length > 0)
		chrome.contextMenus.remove(listOfSnippetCtxIDs.pop());

	if (removeMainEntryFlag)
		chrome.contextMenus.remove(SNIPPET_MAIN_ID, function () {
			// entirely possible that flag-^ is true w/o any snippet_main_id
			// actually being present
			// TODO: why is this semicolon unnecessary?
			if (chrome.runtime.lastError);
		});
}

function loadSnippetListIntoBGPage(list) {
	Data.snippets = Folder.fromArray(list);
	Folder.setIndices();
	return Data.snippets;
}

chrome.extension.onMessage.addListener(function (request, sender, sendResponse) {
	// when user updates snippet data, reloading page is not required
	if (typeof request.snippetList !== "undefined")
		addCtxSnippetList(loadSnippetListIntoBGPage(request.snippetList));
	else if (request.openBlockSiteModalInParent === true) {
		chrome.tabs.query({ active: true, currentWindow: true }, function (tabs) {
			var tab = tabs[0];

			chrome.tabs.sendMessage(tab.id, { showBlockSiteModal: true, data: request.data });
		});
	}
	else if (typeof request.ctxTimestamp !== "undefined")
		latestCtxTimestamp = request.ctxTimestamp;
	else if (request === "givePasteData")
		sendResponse(getPasteData());
});

// open a new tab whenever popup icon is clicked
chrome.browserAction.onClicked.addListener(openSnippetsPage);

chrome.runtime.setUninstallURL("https://docs.google.com/forms/d/e/1FAIpQLSdDAd8a1Edf4eUXhM4E1GALziNk6j1QYjI6gUqGdAXdYrueaw/viewform");
