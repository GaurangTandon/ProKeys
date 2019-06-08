/* global Data, pk, latestRevisionLabel */

import { checkRuntimeError, isTabSafe } from "./pre";
import { Folder } from "./snippet_classes";

const SETTINGS_DEFAULTS = {
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
        wrapSelectionAutoInsert: true,
        ctxEnabled: true,
    },
    LS_REVISIONS_PROP = "prokeys_revisions";

function notifySnippetDataChanges(snippetList) {
    const msg = {
        snippetList,
    };

    chrome.tabs.query({}, (tabs) => {
        for (const tab of tabs) {
            if (isTabSafe(tab)) {
                chrome.tabs.sendMessage(
                    tab.id,
                    msg,
                    checkRuntimeError("notifySnippetDataChanges-innerloop"),
                );
            }
        }
    });

    chrome.runtime.sendMessage(msg, checkRuntimeError("notifySnippetDataChanges"));
}

function saveRevision(dataString) {
    const MAX_REVISIONS_STORED = 20;
    let parsed = JSON.parse(localStorage[LS_REVISIONS_PROP]);
    const latestRevision = {
        label: `${Date.getFormattedDate()} - ${latestRevisionLabel}`,
        data: dataString || Data.snippets,
    };

    parsed.unshift(latestRevision);
    parsed = parsed.slice(0, MAX_REVISIONS_STORED);
    localStorage[LS_REVISIONS_PROP] = JSON.stringify(parsed);
}

// store only those props which are mutable
pk.storage = chrome.storage.local;
pk.DB_loaded = false;
pk.snipNameDelimiterListRegex = null;

const IN_OPTIONS_PAGE = window.location.href && /chrome-extension:\/\//.test(window.location.href);
// will use these when fixing the sync storage bug
// NEW_DATA_STORAGE_KEY = "ProKeysUserData";
// DATA_KEY_COUNT_PROP = `${pk.NEW_DATA_STORAGE_KEY}_-1`;

/**
 * requests data from background page and
 * passes the Data to the callback
 */
function DBget(callback) {
    chrome.runtime.sendMessage({ giveData: true }, callback);
}

/**
 * sends updated data to background page for storage
 */
function DBupdate(callback) {
    chrome.runtime.sendMessage({ updateData: Data }, callback);
}

/**
 * PRECONDITION: Data.snippets is a Folder object
 */
function saveSnippetData(callback, folderNameToList, objectNamesToHighlight) {
    Data.snippets = Data.snippets.toArray();

    // refer github issues#4
    Data.dataUpdateVariable = !Data.dataUpdateVariable;

    DBupdate(() => {
        if (IN_OPTIONS_PAGE) {
            const snippetList = Data.snippets.toArray();
            saveRevision(snippetList);
            notifySnippetDataChanges(snippetList);
        }

        Folder.setIndices();
        const folderToList = folderNameToList
            ? Data.snippets.getUniqueFolder(folderNameToList)
            : Data.snippets;
        folderToList.listSnippets(objectNamesToHighlight);

        checkRuntimeError("databaseSave inside")();

        if (callback) {
            callback();
        }
    });

    Data.snippets = Folder.fromArray(Data.snippets);
}

// save data not involving snippets
function saveOtherData(msg = "Saved!", callback) {
    Data.snippets = Data.snippets.toArray();

    // issues#4
    Data.dataUpdateVariable = !Data.dataUpdateVariable;

    DBupdate(() => {
        if (typeof msg === "function") {
            msg();
        } else if (typeof msg === "string") {
            window.alert(msg);
        }
        checkRuntimeError("saveotherdata-options.js")();

        if (callback) {
            callback();
        }
    });

    // once databaseSave has been called, doesn't matter
    // if this prop is object/array since storage.clear/set
    // methods are using a separate storageObj
    Data.snippets = Folder.fromArray(Data.snippets);
}

// get type of current storage as string
function getCurrentStorageType() {
    // property MAX_ITEMS is present only in sync
    return pk.storage.MAX_ITEMS ? "sync" : "local";
}

// changes type of storage: local-sync, sync-local
function changeStorageType() {
    pk.storage = getCurrentStorageType() === "sync" ? chrome.storage.local : chrome.storage.sync;
}

// transfer data from one storage to another
function migrateData(transferData, callback) {
    function afterMigrate() {
        Data.snippets = Folder.fromArray(Data.snippets);
        callback();
    }
    const str = Data.snippets.toArray(); // maintain a copy

    // make current storage unusable
    // so that storage gets changed by DB_load
    Data.snippets = false;

    DBupdate(() => {
        changeStorageType();

        if (transferData) {
            // get the copy
            Data.snippets = str;
            DBupdate(afterMigrate);
        } else {
            // don't do Data.snippets = Folder.fromArray(Data.snippets);
            // here since Data.snippets is false and since this is
            // the sync2 option, we need to retain the data that user had
            // previously synced on another PC
            callback();
        }
    });
}

/**
 * these are the only methods
 * which should be used by other scripts
 * under our new data storage policy (#266)
 * Be cautious while changing it.
 */
export {
    DBget,
    saveSnippetData,
    saveOtherData,
    migrateData,
    saveRevision,
    getCurrentStorageType,
    SETTINGS_DEFAULTS,
    LS_REVISIONS_PROP,
};
