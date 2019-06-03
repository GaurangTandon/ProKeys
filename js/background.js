/* global q, Folder, Data, Generic, chrome , modalHTML, listOfSnippetCtxIDs, pk */
console.log(`Loaded once ${new Date()}`);
const BLOCK_SITE_ID = "blockSite",
    // can recall at max 10 times
    // for gettting the blocked site status in case of unfinished loading of cs.js
    LIMIT_OF_RECALLS = 10,
    SNIPPET_MAIN_ID = "snippet_main",
    URL_REGEX = /^(?:(?:https?|ftp):\/\/)(?:\S+(?::\S*)?@)?(?:(?!10(?:\.\d{1,3}){3})(?!127(?:\.\d{1,3}){3})(?!169\.254(?:\.\d{1,3}){2})(?!192\.168(?:\.\d{1,3}){2})(?!172\.(?:1[6-9]|2\d|3[0-1])(?:\.\d{1,3}){2})(?:[1-9]\d?|1\d\d|2[01]\d|22[0-3])(?:\.(?:1?\d{1,2}|2[0-4]\d|25[0-5])){2}(?:\.(?:[1-9]\d?|1\d\d|2[0-4]\d|25[0-4]))|(?:(?:[a-z\u00a1-\uffff0-9]+-?)*[a-z\u00a1-\uffff0-9]+)(?:\.(?:[a-z\u00a1-\uffff0-9]+-?)*[a-z\u00a1-\uffff0-9]+)*(?:\.(?:[a-z\u00a1-\uffff]{2,})))(?::\d{2,5})?(?:\/[^\s]*)?$/;
let contextMenuActionBlockSite,
    wasOnBlockedSite = false,
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
    latestCtxTimestamp;

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
    if (!pk.isTabSafe(tab)) {
        return;
    }

    // loop through content scripts and execute in order
    const contentScripts = chrome.runtime.getManifest().content_scripts[0].js;

    for (let i = 0, len = contentScripts.length; i < len; i++) {
        chrome.tabs.executeScript(tab.id, {
            file: contentScripts[i],
        });
    }
}

function createBlockSiteCtxItem() {
    chrome.contextMenus.create(
        {
            id: BLOCK_SITE_ID,
            title: "reload page for blocking site",
        },
        pk.checkRuntimeError("CRX-CREATE"),
    );
}

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
        defaultOmniboxSuggestion = defSuggest;

        chrome.omnibox.setDefaultSuggestion({
            description: defaultOmniboxSuggestion.description,
        });

        suggestCallback(otherSuggests);
    });
});

chrome.omnibox.onInputEntered.addListener((omniboxText, disposition) => {
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

    window.modalHTML = modalContent;
}());

function removeCtxSnippetList(removeMainEntryFlag) {
    while (listOfSnippetCtxIDs.length > 0) {
        chrome.contextMenus.remove(listOfSnippetCtxIDs.pop());
    }

    if (removeMainEntryFlag) {
        // entirely possible that flag-^ is true w/o any snippet_main_id
        // actually being present
        chrome.contextMenus.remove(SNIPPET_MAIN_ID, pk.checkRuntimeError("REMOVE-SMI"));
    }
}

function addCtxSnippetList(snippets) {
    let hasSnippets;
    function addMainEntry() {
        if (hasSnippets) {
            return;
        }

        chrome.contextMenus.create(
            {
                contexts: ["editable"],
                id: SNIPPET_MAIN_ID,
                title: "No snippet to insert",
            },
            () => {
                if (chrome.runtime.lastError) {
                    // already exists, so first remove it
                    chrome.contextMenus.remove(SNIPPET_MAIN_ID);
                    addMainEntry();
                }
            },
        );
    }

    // just in case previous data is larger that current data
    // we might have overlapping data display so avoid all problems
    removeCtxSnippetList(true);
    snippets = snippets || Data.snippets;
    hasSnippets = snippets.list.length > 0;
    addMainEntry();

    // now create the new context menus
    snippets.createCtxMenuEntry();
}

chrome.runtime.onInstalled.addListener((details) => {
    let text,
        title;
    const { reason } = details,
        { version } = chrome.runtime.getManifest();

    if (reason === "install") {
        localStorage.firstInstall = "true";

        openSnippetsPage(version, reason);

        title = "ProKeys successfully installed!";
        text = "Thank you for installing ProKeys! Please reload all active tabs for changes to take effect.";

        // inject script into all active tabs
        // so that user is not required to do manual reload
        chrome.tabs.query({}, (tabs) => {
            tabs.forEach(injectScript);
        });
    } else if (reason === "update") {
        title = `ProKeys updated to v${version}`;
        text = "Hooray! Please reload active tabs to use the new version.";

        openSnippetsPage(version, reason);
        needToGetLatestData = true;
        addCtxSnippetList();
    }

    // either update or install was there
    if (text !== undefined) {
        // the empty function and string is required < Chrome 42
        chrome.notifications.create(
            "",
            {
                type: "basic",
                iconUrl: "imgs/r128.png",
                title,
                message: text,
            },
            (id) => {},
        );
    }
});

function loadSnippetListIntoBGPage(list) {
    Data.snippets = Folder.fromArray(list);
    Folder.setIndices();
    return Data.snippets;
}

// isRecalled: if the function has been called
// if the response from content script was undefined
// why content script sends undefined response is i don't know
function updateContextMenu(isRecalled) {
    if (isRecalled) {
        recalls++;
    } else {
        recalls = 0;
    }

    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        let isBlocked;

        if (typeof tabs[0] === "undefined") {
            return;
        }
        if (!window.pk.isTabSafe(tabs[0])) {
            return;
        }
        chrome.tabs.sendMessage(tabs[0].id, { checkBlockedYourself: true }, (response) => {
            if (pk.checkRuntimeError("CBY")()) {
                return;
            }
            isBlocked = response;

            contextMenuActionBlockSite = isBlocked === undefined
                ? "reload page for (un)blocking"
                : isBlocked
                    ? "Unblock"
                    : "Block";

            if (isBlocked === undefined) {
                if (recalls <= LIMIT_OF_RECALLS) {
                    setTimeout(updateContextMenu, 500, true);
                } else {
                    chrome.contextMenus.update(BLOCK_SITE_ID, {
                        title: "Unable to block/unblock this site",
                    });
                }

                return;
            }

            // remove all snippet support as well
            if (isBlocked) {
                removeCtxSnippetList(true);
                wasOnBlockedSite = true;
            } else if (wasOnBlockedSite) {
                wasOnBlockedSite = false;
                addCtxSnippetList();
            }

            chrome.contextMenus.update(BLOCK_SITE_ID, {
                title: `${contextMenuActionBlockSite} this site`,
            });
        });

        if (needToGetLatestData) {
            if (window.pk.isTabSafe(tabs[0])) {
                chrome.tabs.sendMessage(tabs[0].id, { giveSnippetList: true }, (response) => {
                    if (pk.checkRuntimeError("GSL")()) {
                        return;
                    }
                    if (Array.isArray(response)) {
                        needToGetLatestData = false;
                        loadSnippetListIntoBGPage(response);
                        addCtxSnippetList();
                    }
                });
            }
        }
    });
}

try {
    updateContextMenu();
} catch (e) {
    console.log(`Error while creating context menu - ${e.message}`);
}

createBlockSiteCtxItem();

chrome.contextMenus.onClicked.addListener((info, tab) => {
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
            if (!window.pk.isTabSafe(tabs[0])) {
                return;
            }
            chrome.tabs.sendMessage(tabs[0].id, msg, pk.checkRuntimeError("ID==BSI"));
        });
    } else if (Generic.CTX_SNIP_REGEX.test(id)) {
        startIndex = Generic.CTX_START[Generic.SNIP_TYPE].length;
        snip = Data.snippets.getUniqueSnip(id.substring(startIndex));

        chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
            if (window.pk.isTabSafe(tabs[0])) {
                chrome.tabs.sendMessage(
                    tabs[0].id,
                    {
                        clickedSnippet: snip.toArray(),
                        ctxTimestamp: latestCtxTimestamp,
                    },
                    pk.checkRuntimeError("CSRTI"),
                );
            }
        });
    }
});

chrome.tabs.onActivated.addListener((info) => {
    updateContextMenu();
});

chrome.tabs.onUpdated.addListener((tabId, info, tab) => {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        if (pk.isTabSafe(tabs[0])) {
            updateContextMenu();
        }
    });
});

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    // when user updates snippet data, reloading page is not required
    if (typeof request.snippetList !== "undefined") {
        addCtxSnippetList(loadSnippetListIntoBGPage(request.snippetList));
    } else if (request.openBlockSiteModalInParent === true) {
        chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
            const tab = tabs[0];
            if (window.pk.isTabSafe(tab)) {
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
    }
});

// open a new tab whenever popup icon is clicked
chrome.browserAction.onClicked.addListener(openSnippetsPage);

chrome.runtime.setUninstallURL(
    "https://docs.google.com/forms/d/e/1FAIpQLSdDAd8a1Edf4eUXhM4E1GALziNk6j1QYjI6gUqGdAXdYrueaw/viewform",
);
