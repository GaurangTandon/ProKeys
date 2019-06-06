/* global q, Folder, Data, Generic, chrome, pk */

import { isTabSafe } from "./pre";

console.log(`Loaded once ${new Date()}`);
const BLOCK_SITE_ID = "blockSite",
    // can recall at max 10 times
    // for gettting the blocked site status in case of unfinished loading of cs.js
    LIMIT_OF_RECALLS = 10,
    SNIPPET_MAIN_ID = "snippet_main",
    URL_REGEX = /^(?:(?:https?|ftp):\/\/)(?:\S+(?::\S*)?@)?(?:(?!10(?:\.\d{1,3}){3})(?!127(?:\.\d{1,3}){3})(?!169\.254(?:\.\d{1,3}){2})(?!192\.168(?:\.\d{1,3}){2})(?!172\.(?:1[6-9]|2\d|3[0-1])(?:\.\d{1,3}){2})(?:[1-9]\d?|1\d\d|2[01]\d|22[0-3])(?:\.(?:1?\d{1,2}|2[0-4]\d|25[0-5])){2}(?:\.(?:[1-9]\d?|1\d\d|2[0-4]\d|25[0-4]))|(?:(?:[a-z\u00a1-\uffff0-9]+-?)*[a-z\u00a1-\uffff0-9]+)(?:\.(?:[a-z\u00a1-\uffff0-9]+-?)*[a-z\u00a1-\uffff0-9]+)*(?:\.(?:[a-z\u00a1-\uffff]{2,})))(?::\d{2,5})?(?:\/[^\s]*)?$/;
let contextMenuActionBlockSite,
    // boolean set to true on updating app as well as when extension loads
    // or after browser restart
    // so that user gets updated snippet list whenever he comes
    // on valid website (not chrome://extension)
    needToGetLatestData = true,
    recalls = 0,
    // received from cs.js; when there are mutliple iframes on a page
    // this helps remove the ambiguity as to which one was latest
    // storing it in background.js so as to provide a global one-stop center
    // content scripts, which cannot interact among themselves
    latestCtxTimestamp,
    modalHTML;

// so that snippet_classes.js can work properly
// doesn't clash with the Data variable in options.js
window.Data = {};
Data.snippets = new Folder("Snippets");
Data.ctxEnabled = true;
pk.listOfSnippetCtxIDs = [];

Folder.setIndices();

function isURL(text) {
    return URL_REGEX.test(text.trim());
}

function getDomain(url) {
    url = url.replace(/^(ht|f)tps?(:\/\/)?(www\.)?/, "").split("/");
    let domain = url[0],
        path1 = url[1],
        idx;

    if (path1) {
        // remove all the unnecessary query/anchors parameter content
        idx = path1.indexOf("?");
        if (idx !== -1) {
            path1 = path1.substring(0, idx);
        }

        domain += `/${path1}`;
    }

    return domain;
}

function getPasteData() {
    const $elm = q.new("textarea"),
        $actElm = document.activeElement.appendChild($elm).parentNode;

    $elm.focus();
    document.execCommand("Paste", null, null);

    const data = $elm.value;
    $actElm.removeChild($elm);

    return data;
}

function injectScript(tab) {
    if (!isTabSafe(tab)) {
        return;
    }

    // loop through content scripts and execute in order
    const contentScripts = chrome.runtime.getManifest().content_scripts[0].js;

    for (const cs of contentScripts) {
        chrome.tabs.executeScript(tab.id, {
            file: cs,
        });
    }
}

// helps inject script into all active tabs
// so that user is not required to do manual reload
function injectScriptAllTabs() {
    chrome.tabs.query({}, (tabs) => {
        tabs.forEach(injectScript);
    });
}

let toggleBlockSiteCtxItem;
(function () {
    // use closure to keep track of state of block site ctx item
    let currentlyShown = false;
    toggleBlockSiteCtxItem = function () {
        if (Data.ctxEnabled && !currentlyShown) {
            chrome.contextMenus.create(
                {
                    id: BLOCK_SITE_ID,
                    title: "reload page for blocking site",
                },
                () => {
                    if (pk.checkRuntimeError("BSI-CREATE")()) {
                        return;
                    }
                    currentlyShown = true;
                },
            );
        } else if (!Data.ctxEnabled && currentlyShown) {
            chrome.contextMenus.remove(BLOCK_SITE_ID, () => {
                if (pk.checkRuntimeError("BSI-REM")()) {
                    return;
                }
                currentlyShown = false;
            });
        }
    };
}());

function openSnippetsPage(version, reason) {
    if (reason === "update") {
        localStorage.extensionUpdated = true;
    }

    chrome.tabs.create({
        url: chrome.extension.getURL("html/options.html#snippets"),
    });
}

let currentOmniboxQuery,
    defaultOmniboxSuggestion;

chrome.omnibox.onInputChanged.addListener((text, suggestCallback) => {
    currentOmniboxQuery = text;

    Data.snippets.filterSnippetsForOmnibox(text, ([defSuggest, ...otherSuggests]) => {
        // {} when user entered text does not match any snippet content
        defaultOmniboxSuggestion = defSuggest || {
            description: "Sorry, entered text did not match any existing snippet",
        };

        chrome.omnibox.setDefaultSuggestion({
            description: defaultOmniboxSuggestion.description,
        });

        suggestCallback(otherSuggests);
    });
});

chrome.omnibox.onInputEntered.addListener((omniboxText) => {
    let url,
        query;

    if (omniboxText === currentOmniboxQuery) {
        query = defaultOmniboxSuggestion.content;
    }

    if (isURL(query)) {
        url = query;
    } else {
        url = localStorage.omniboxSearchURL.replace("SEARCH", encodeURIComponent(query));
    }

    chrome.tabs.query({ currentWindow: true, active: true }, (tabs) => {
        chrome.tabs.update(tabs[0].id, { url });
    });
});

// create modal dialog for blocking site by detector.js
(function createBlockSiteModal() {
    const modalContent = "<div class='prokeys-block block-theme-plain'>"
        + "<div class='block-overlay'></div>"
        + "<div class='block-content'>"
        + "<div class='block-dialog-form'>"
        + "<div class='block-dialog-message'>Are you sure you want to <span class='action'></span><br> <input type='text' class='site-name'><br> from ProKeys?</div>"
        + "<div class='block-dialog-buttons'>"
        + "<input type='button' value='OK' class='block-dialog-button-primary block-dialog-button'>"
        + "<input type='button' value='Cancel' class='block-dialog-button-secondary block-dialog-button'> </div>"
        + "</div>"
        + "</div></div>";

    modalHTML = modalContent;
}());

let removeCtxSnippetList,
    addCtxSnippetList;
(function snippetListCtxClosure() {
    let cachedSnippetList = "",
        defaultEntryExists = false;
    removeCtxSnippetList = function () {
        while (pk.listOfSnippetCtxIDs.length > 0) {
            chrome.contextMenus.remove(pk.listOfSnippetCtxIDs.pop());
        }
        cachedSnippetList = "";
        if (defaultEntryExists) {
            chrome.contextMenus.remove(SNIPPET_MAIN_ID, pk.checkRuntimeError("REMOVE-SMI"));
            defaultEntryExists = false;
        }
    };

    addCtxSnippetList = function (snippets) {
        snippets = snippets || Data.snippets;
        const newInput = JSON.stringify(snippets.toArray());
        if (newInput === cachedSnippetList) {
            return;
        }
        removeCtxSnippetList();
        cachedSnippetList = newInput;
        const hasSnippets = snippets.list.length > 0;
        defaultEntryExists = !hasSnippets;
        if (!hasSnippets) {
            chrome.contextMenus.create({
                contexts: ["editable"],
                id: SNIPPET_MAIN_ID,
                title: "No snippet to insert",
            });
        } else {
            snippets.createCtxMenuEntry();
        }
    };
}());

chrome.runtime.onInstalled.addListener((details) => {
    let text,
        title;
    const { reason } = details,
        { version } = chrome.runtime.getManifest();

    if (reason === "install") {
        localStorage.firstInstall = "true";
        title = "ProKeys successfully installed!";
        text = "Thank you for installing ProKeys! Please reload all active tabs for changes to take effect.";
    } else if (reason === "update") {
        title = `ProKeys updated to v${version}`;
        text = "Hooray! Please reload active tabs to use the new version.";
        needToGetLatestData = true;
    } else {
        // do not process anything other than install or update
        return;
    }

    openSnippetsPage(version, reason);
    injectScriptAllTabs();

    // the empty function and string is required < Chrome 42
    chrome.notifications.create("", {
        type: "basic",
        iconUrl: "imgs/r128.png",
        title,
        message: text,
    });
});

function loadSnippetListIntoBGPage(list) {
    Data.snippets = Folder.fromArray(list);
    Folder.setIndices();
    return Data.snippets;
}

// isRecalled: if the function has been called
// if the response from content script was undefined
// why content script sends undefined response is i don't know
function updateContextMenu(isRecalled = false) {
    if (isRecalled) {
        recalls++;
    } else {
        recalls = 0;
    }

    if (!Data.ctxEnabled) {
        return;
    }

    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        const tab = tabs[0];

        if (!isTabSafe(tab)) {
            return;
        }

        chrome.tabs.sendMessage(tab.id, { checkBlockedYourself: true }, (isBlocked) => {
            if (pk.checkRuntimeError("CBY")()) {
                return;
            }

            if (typeof isBlocked === "undefined") {
                contextMenuActionBlockSite = "Unable to block/unblock";
                if (recalls <= LIMIT_OF_RECALLS) {
                    setTimeout(updateContextMenu, 500, true);
                }
            } else {
                contextMenuActionBlockSite = isBlocked ? "Unblock" : "Block";

                if (isBlocked) {
                    removeCtxSnippetList();
                } else {
                    addCtxSnippetList();
                }
            }

            chrome.contextMenus.update(BLOCK_SITE_ID, {
                title: `${contextMenuActionBlockSite} this site`,
            });
        });
    });
}

/**
 * sets up or toggles display of ctx menu based
 * on ctxEnabled property
 */
function initContextMenu() {
    if (Data.ctxEnabled) {
        // let this call decide whether to show snippets or not
        // based on whether site is blocked or not
        updateContextMenu();
    } else {
        removeCtxSnippetList();
    }
    toggleBlockSiteCtxItem();
}

chrome.contextMenus.onClicked.addListener((info) => {
    const id = info.menuItemId,
        url = info.pageUrl;
    let msg,
        startIndex,
        snip;

    if (id === BLOCK_SITE_ID) {
        msg = {
            task: "showModal",
            action: contextMenuActionBlockSite,
            url: getDomain(url),
            modal: modalHTML,
        };

        chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
            if (!isTabSafe(tabs[0])) {
                return;
            }
            chrome.tabs.sendMessage(tabs[0].id, msg, pk.checkRuntimeError("ID==BSI"));
        });
    } else if (Generic.CTX_SNIP_REGEX.test(id)) {
        startIndex = Generic.CTX_START[Generic.SNIP_TYPE].length;
        snip = Data.snippets.getUniqueSnip(id.substring(startIndex));

        chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
            const tab = tabs[0];
            if (isTabSafe(tab)) {
                chrome.tabs.sendMessage(
                    tab.id,
                    {
                        clickedSnippet: snip.toArray(),
                        ctxTimestamp: latestCtxTimestamp,
                    },
                    pk.checkRuntimeError("CSRTI"),
                );
            } else if (tab.url) {
                alert(
                    "Sorry, context menu insertion doesn't work in the chrome:// tabs or in the Webstore!",
                );
            }
        });
    }
});

/**
 *
 * @param {Number} tabId id of tab
 */
function onTabActivatedOrUpdated({ tabId }) {
    const IMG_ACTIVE = "../imgs/r16.png",
        IMG_INACTIVE = "../imgs/r16grey.png";
    let path = "";
    if (!tabId) {
        return;
    }

    if (needToGetLatestData) {
        chrome.tabs.sendMessage(tabId, { giveFreshData: true }, (data) => {
            if (!data || pk.checkRuntimeError("GSL")()) {
                return;
            }
            const { snippets, ctxEnabled } = data;
            if (Array.isArray(snippets)) {
                needToGetLatestData = false;
                loadSnippetListIntoBGPage(snippets);
                addCtxSnippetList();
            }
            if (typeof ctxEnabled !== "undefined") {
                Data.ctxEnabled = ctxEnabled;
            }
        });
    }

    chrome.tabs.get(tabId, (tab) => {
        if (isTabSafe(tab)) {
            path = IMG_ACTIVE;
        } else {
            path = IMG_INACTIVE;
        }
        chrome.browserAction.setIcon({ path });
    });

    initContextMenu();
}

chrome.tabs.onActivated.addListener(onTabActivatedOrUpdated);
chrome.tabs.onUpdated.addListener(onTabActivatedOrUpdated);

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    // when user updates snippet data, reloading page is not required
    if (typeof request.snippetList !== "undefined") {
        addCtxSnippetList(loadSnippetListIntoBGPage(request.snippetList));
    } else if (request.openBlockSiteModalInParent === true) {
        chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
            const tab = tabs[0];
            if (isTabSafe(tab)) {
                chrome.tabs.sendMessage(
                    tab.id,
                    { showBlockSiteModal: true, data: request.data },
                    pk.checkRuntimeError("OBSMIP"),
                );
            }
        });
    } else if (typeof request.ctxTimestamp !== "undefined") {
        latestCtxTimestamp = request.ctxTimestamp;
    } else if (request === "givePasteData") {
        sendResponse(getPasteData());
    } else if (typeof request.ctxEnabled !== "undefined") {
        Data.ctxEnabled = request.ctxEnabled;
        initContextMenu();
    }
});

// open a new tab whenever popup icon is clicked
chrome.browserAction.onClicked.addListener(openSnippetsPage);

chrome.runtime.setUninstallURL(
    "https://docs.google.com/forms/d/e/1FAIpQLSdDAd8a1Edf4eUXhM4E1GALziNk6j1QYjI6gUqGdAXdYrueaw/viewform",
);
