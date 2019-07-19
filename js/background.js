/* global Data, listOfSnippetCtxIDs */

import {
    chromeAPICallWrapper, isTabSafe, q, debugLog,
} from "./pre";
import { primitiveExtender } from "./primitiveExtend";
import { updateAllValuesPerWin } from "./protoExtend";
import { Folder, Generic } from "./snippetClasses";
import {
    DBSave,
    saveRevision,
    LS_REVISIONS_PROP,
    SETTINGS_DEFAULTS,
    LS_STORAGE_TYPE_PROP,
    OLD_DATA_STORAGE_KEY,
} from "./commonDataHandlers";

primitiveExtender();
updateAllValuesPerWin(window);
console.log(`Loaded at: ${new Date()}`);
const BLOCK_SITE_ID = "blockSite",
    // for gettting the blocked site status in case of unfinished loading of cs.js
    LIMIT_OF_RECALLS = 10,
    SNIPPET_MAIN_ID = "snippet_main",
    URL_REGEX = /^(?:(?:https?|ftp):\/\/)(?:\S+(?::\S*)?@)?(?:(?!10(?:\.\d{1,3}){3})(?!127(?:\.\d{1,3}){3})(?!169\.254(?:\.\d{1,3}){2})(?!192\.168(?:\.\d{1,3}){2})(?!172\.(?:1[6-9]|2\d|3[0-1])(?:\.\d{1,3}){2})(?:[1-9]\d?|1\d\d|2[01]\d|22[0-3])(?:\.(?:1?\d{1,2}|2[0-4]\d|25[0-5])){2}(?:\.(?:[1-9]\d?|1\d\d|2[0-4]\d|25[0-4]))|(?:(?:[a-z\u00a1-\uffff0-9]+-?)*[a-z\u00a1-\uffff0-9]+)(?:\.(?:[a-z\u00a1-\uffff0-9]+-?)*[a-z\u00a1-\uffff0-9]+)*(?:\.(?:[a-z\u00a1-\uffff]{2,})))(?::\d{2,5})?(?:\/[^\s]*)?$/;
let contextMenuActionBlockSite,
    recalls = 0,
    // received from cs.js; when there are mutliple iframes on a page
    // this helps remove the ambiguity as to which one was latest
    // storing it in background.js so as to provide a global one-stop center
    // content scripts, which cannot interact among themselves
    latestCtxTimestamp,
    modalHTML,
    /**
     * Aim is that there should be only one copy of storage type present across
     * the entire system. Hence, the background js is the safest place for it to be
     * and others can message bg.js to interact with it
     */
    storage = chrome.storage.local;

// so that snippet_classes.js can work properly
// doesn't clash with the Data variable in options.js
window.listOfSnippetCtxIDs = [];
window.IN_OPTIONS_PAGE = false;

// preprocessing Data includes setting indicess and making snippets Folder
// needs to be called everytime window.data is changed.
function makeDataReady() {
    // these checks are necessary
    if (Data && Data.snippets) {
        Folder.makeFolderIfList(Data);
        Folder.setIndices();
    }
}

if (localStorage[LS_STORAGE_TYPE_PROP]) {
    storage = chrome.storage[localStorage[LS_STORAGE_TYPE_PROP]];
    storage.get(OLD_DATA_STORAGE_KEY, (response) => {
        window.Data = response[OLD_DATA_STORAGE_KEY];
        makeDataReady();
    });
}

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

// get type of current storage as string
function getCurrentStorageType() {
    // property MAX_ITEMS is present only in sync
    return storage.MAX_ITEMS ? "sync" : "local";
}

function getClipboard(type) {
    debugLog("getting ", type);

    if (type === "text") {
        const $elm = q.new("textarea"),
            $actElm = document.activeElement.appendChild($elm).parentNode;

        $elm.focus();
        document.execCommand("paste", null, null);

        const data = $elm.value;
        $actElm.removeChild($elm);
        debugLog("get done", data);
        return data;
    }

    const $actElm = q.new("div"),
        $actElmParent = document.activeElement.appendChild($actElm).parentNode;
    $actElm.setAttribute("contenteditable", "true");
    const range = document.createRange();
    range.selectNode($actElm);
    window.getSelection().removeAllRanges();
    window.getSelection().addRange(range);
    $actElm.focus();
    document.execCommand("paste");
    const data = $actElm.innerHTML;
    $actElmParent.removeChild($actElm);
    debugLog("get done", data);
    return data;
}

/**
 * @param {String} type
 * @param {String} value
 */
function setClipboard({ type, value, styles }) {
    debugLog("setting", type, value);

    let $elm;
    if (type === "text") {
        $elm = q.new("textarea");
        document.activeElement.appendChild($elm);

        $elm.value = value;
        $elm.selectionStart = $elm.selectionEnd = 0;
        $elm.focus();
        document.execCommand("copy", null, null);
    } else {
        $elm = q.new("div");
        document.activeElement.appendChild($elm);
        $elm.setAttribute("contenteditable", "true");
        $elm.innerHTML = value;
        $elm.style.font = styles;
        $elm.focus();

        const range = window.getSelection().getRangeAt(0);
        range.selectNodeContents($elm);

        document.execCommand("copy", null, null);
    }
    $elm.parentNode.removeChild($elm);
    debugLog("set done\n------");
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
                chromeAPICallWrapper(() => {
                    currentlyShown = true;
                }),
            );
        } else if (!Data.ctxEnabled && currentlyShown) {
            chrome.contextMenus.remove(
                BLOCK_SITE_ID,
                chromeAPICallWrapper(() => {
                    currentlyShown = true;
                }),
            );
        }
    };
}());

function openSnippetsPage() {
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
    makeCtxSnippetList;
(function snippetListCtxClosure() {
    let cachedSnippetList = "",
        defaultEntryExists = false;
    removeCtxSnippetList = function () {
        while (listOfSnippetCtxIDs.length > 0) {
            chrome.contextMenus.remove(listOfSnippetCtxIDs.pop());
        }
        cachedSnippetList = "";
        if (defaultEntryExists) {
            chrome.contextMenus.remove(SNIPPET_MAIN_ID, chromeAPICallWrapper());
            defaultEntryExists = false;
        }
    };

    /**
     * if new input did not change snippets
     * do not do anything; otherwise remove all snippets and readd them
     */
    makeCtxSnippetList = function () {
        const { snippets } = Data,
            newInput = JSON.stringify(snippets.toArray());
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

/**
 * @param {Function} callback fn called after correctly setting type of
 * storage in localStorage
 */
function decideCorrectStorageType(callback) {
    localStorage[LS_STORAGE_TYPE_PROP] = "local";
    chrome.storage.local.get(OLD_DATA_STORAGE_KEY, (response) => {
        const Data = response[OLD_DATA_STORAGE_KEY];
        if (Data.snippets === false) {
            localStorage[LS_STORAGE_TYPE_PROP] = "sync";
        }
        callback();
    });
}

function afterBGPageReload({
    notifText, notifTitle, reason,
}) {
    makeDataReady();

    if (reason === "install") { openSnippetsPage(); }
    injectScriptAllTabs();

    // the empty function and string is required < Chrome 42
    chrome.notifications.create("", {
        type: "basic",
        iconUrl: "imgs/r128.png",
        title: notifTitle,
        message: notifText,
    });
}

function handleExtUpdate(notifProps) {
    storage = chrome.storage[localStorage[LS_STORAGE_TYPE_PROP]];

    window.latestRevisionLabel = "";
    storage.get(
        OLD_DATA_STORAGE_KEY,
        chromeAPICallWrapper((response) => {
            window.Data = response[OLD_DATA_STORAGE_KEY];

            afterBGPageReload(notifProps);
        }),
    );
}

chrome.runtime.onInstalled.addListener((details) => {
    let notifText,
        notifTitle;
    const { reason } = details,
        { version } = chrome.runtime.getManifest();

    if (reason === "install") {
        // set initial data
        localStorage[LS_REVISIONS_PROP] = "[]";
        localStorage[LS_STORAGE_TYPE_PROP] = "local";
        window.Data = SETTINGS_DEFAULTS;
        window.latestRevisionLabel = "data created (added defaut snippets)";

        saveRevision(Data.snippets);
        DBSave();

        notifTitle = "ProKeys successfully installed!";
        notifText = "Thank you for installing ProKeys! Please reload all active tabs for changes to take effect.";

        afterBGPageReload({
            notifText,
            notifTitle,
            version,
            reason,
        });
    } else if (reason === "update") {
        notifTitle = `ProKeys updated to v${version}`;
        notifText = "Hooray! Please reload active tabs to use the new version.";
        const args = {
            notifText,
            notifTitle,
            version,
            reason,
        };
        chrome.browserAction.setBadgeText({ text: "NEW" });
        localStorage.extensionUpdated = "true";
        decideCorrectStorageType(() => handleExtUpdate(args));
    } else {
        // do not process anything other than install or update
    }
});

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

        chrome.tabs.sendMessage(
            tab.id,
            { checkBlockedYourself: true },
            chromeAPICallWrapper((isBlocked) => {
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
                        makeCtxSnippetList();
                    }
                }

                chrome.contextMenus.update(BLOCK_SITE_ID, {
                    title: `${contextMenuActionBlockSite} this site`,
                });
            }),
        );
    });
}

/**
 * sets up or toggles display of ctx menu based
 * on ctxEnabled property
 */
function initContextMenu() {
    if (!window.Data) { return; }

    if (Data.ctxEnabled) {
        // let this call decide whether to show snippets or not
        // based on whether site is blocked or not
        updateContextMenu();
    } else {
        removeCtxSnippetList();
    }
    toggleBlockSiteCtxItem();
}

function sendMessageToSafeActiveTab(msg, notSafeCallback) {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        const tab = tabs[0];
        if (isTabSafe(tab)) {
            chrome.tabs.sendMessage(
                tab.id,
                msg,
                chromeAPICallWrapper(),
            );
        } else if (tab.url && notSafeCallback) {
            notSafeCallback();
        }
    });
}

chrome.contextMenus.onClicked.addListener((info) => {
    const id = info.menuItemId,
        url = info.pageUrl;

    if (id === BLOCK_SITE_ID) {
        const msg = {
            task: "showModal",
            action: contextMenuActionBlockSite,
            url: getDomain(url),
            modal: modalHTML,
        };

        sendMessageToSafeActiveTab(msg);
    } else if (Generic.CTX_SNIP_REGEX.test(id)) {
        const startIndex = Generic.CTX_START[Generic.SNIP_TYPE].length,
            snip = Data.snippets.getUniqueSnip(id.substring(startIndex));

        sendMessageToSafeActiveTab({
            clickedSnippet: snip.toArray(),
            ctxTimestamp: latestCtxTimestamp,
        }, () => alert(
            "Sorry, context menu insertion doesn't work in the chrome:// tabs or in the Webstore!",
        ));
    }
});

/**
 * @param {Number} tabId id of tab
 */
function onTabActivatedOrUpdated(tabId) {
    const IMG_ACTIVE = "../imgs/r16.png",
        IMG_INACTIVE = "../imgs/r16grey.png";
    let path = "";
    if (!tabId) {
        return;
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

chrome.tabs.onActivated.addListener(({ tabId }) => onTabActivatedOrUpdated(tabId));
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
    // querying partially loaded is not possible
    // as content script isn't ready till then
    // so we get lots of CRLErros
    if (tab.status === "complete") {
        onTabActivatedOrUpdated(tabId);
    }
});

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    // when user updates snippet data, reloading page is not required
    if (typeof request.updateCtx !== "undefined") {
        makeCtxSnippetList();
    } else if (request.openBlockSiteModalInParent === true) {
        sendMessageToSafeActiveTab({ showBlockSiteModal: true, data: request.data });
    } else if (typeof request.ctxTimestamp !== "undefined") {
        latestCtxTimestamp = request.ctxTimestamp;
    } else if (request === "givePasteData") {
        sendResponse(getClipboard());
    } else if (typeof request.ctxEnabled !== "undefined") {
        Data.ctxEnabled = request.ctxEnabled;
        initContextMenu();
    } else if (request.giveData) {
        const resp = {};

        for (const prop of request.props) {
            let orgSnippets;
            if (prop === "snippets") {
                orgSnippets = Data.snippets;
                Data.snippets = Data.snippets.toArray();
            }
            resp[prop] = Data[prop];
            if (prop === "snippets") {
                Data.snippets = orgSnippets;
            }
        }

        sendResponse(resp);
    } else if (typeof request.updateData !== "undefined") {
        Data = request.updateData;
        // setIndices necessary everytime we reassign data
        // otherwise search function doesn't work as expected
        DBSave(() => {
            if (Data.snippets) { makeDataReady(); }
            sendResponse("done");
        });
        return true;
    } else if (typeof request.getStorageType !== "undefined") {
        sendResponse(getCurrentStorageType());
    } else if (typeof request.changeStorageType !== "undefined") {
        const storages = ["local", "sync"],
            currStorage = getCurrentStorageType(),
            targetStorage = storages[1 - storages.indexOf(currStorage)],
            oldData = Data;

        storage = chrome.storage[targetStorage];
        localStorage[LS_STORAGE_TYPE_PROP] = targetStorage;
        storage.get((response) => {
            window.Data = response[OLD_DATA_STORAGE_KEY];
            if (typeof Data === "undefined" && !request.overridingSync) {
                // reset everuthing to before
                window.Data = oldData;
                makeDataReady();
                storage = chrome.storage[currStorage];
                localStorage[LS_STORAGE_TYPE_PROP] = currStorage;
                sendResponse({ completed: false });
            } else {
                makeDataReady();
                sendResponse({ completed: true });
            }
        });
        return true;
    } else if (typeof request.getBytesInUse !== "undefined") {
        storage.getBytesInUse(
            chromeAPICallWrapper((bytesInUse) => {
                sendResponse(bytesInUse);
            }),
        );
        return true;
    } else if (request.task === "checkSnippetPresent") {
        const snip = Data.snippets.getUniqueSnippetFromText(request.text),
            snipFound = !!snip,
            snipObject = snipFound ? snip.toArray() : {};
        sendResponse({ snipFound, snipObject });
    } else if (request.task === "clipboard") {
        let value = "";
        if (request.pop) {
            value = getClipboard(request.pop.type);
        }
        if (request.push) {
            setClipboard(request.push);
        }
        sendResponse(value);
    }

    // indicates synced sendResponse
    return false;
});

// open a new tab whenever popup icon is clicked
chrome.browserAction.onClicked.addListener(openSnippetsPage);

chrome.runtime.setUninstallURL(
    "https://docs.google.com/forms/d/e/1FAIpQLSdDAd8a1Edf4eUXhM4E1GALziNk6j1QYjI6gUqGdAXdYrueaw/viewform",
);
