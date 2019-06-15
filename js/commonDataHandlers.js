/* global Data */

import { chromeAPICallWrapper, isTabSafe } from "./pre";
import { Folder } from "./snippetClasses";
import { getFormattedDate } from "./dateFns";

const SETTINGS_DEFAULTS = {
        snippets: Folder.getDefaultSnippetData(),
        blockedSites: [],
        charsToAutoInsertUserList: [["(", ")"], ["{", "}"], ["\"", "\""], ["[", "]"]],
        dataVersion: 1,
        language: "English",
        hotKey: ["shiftKey", 32],
        dataUpdateVariable: true,
        matchDelimitedWord: true,
        tabKey: false,
        snipNameDelimiterList: "@#$%&*+-=(){}[]:\"'/_<>?!., ",
        omniboxSearchURL: "https://www.google.com/search?q=SEARCH",
        wrapSelectionAutoInsert: true,
        ctxEnabled: true,
    },
    OLD_DATA_STORAGE_KEY = "UserSnippets",
    LS_REVISIONS_PROP = "prokeys_revisions",
    LS_STORAGE_TYPE_PROP = "pkStorageType";

function notifySnippetDataChanges(snippetList) {
    const msg = {
        snippetList,
    };

    chrome.tabs.query({}, (tabs) => {
        for (const tab of tabs) {
            if (isTabSafe(tab)) {
                chrome.tabs.sendMessage(tab.id, msg, chromeAPICallWrapper());
            }
        }
    });

    chrome.runtime.sendMessage({ updateCtx: true }, chromeAPICallWrapper());
}

function saveRevision(dataString) {
    const MAX_REVISIONS_STORED = 20;
    let parsed = JSON.parse(localStorage[LS_REVISIONS_PROP]);
    const latestRevision = {
        label: `${getFormattedDate()} - ${window.latestRevisionLabel}`,
        data: dataString || Data.snippets,
    };

    parsed.unshift(latestRevision);
    parsed = parsed.slice(0, MAX_REVISIONS_STORED);
    localStorage[LS_REVISIONS_PROP] = JSON.stringify(parsed);
}

const IN_OPTIONS_PAGE = window.location.href && /chrome-extension:\/\//.test(window.location.href);

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
    // cannot send Folder type Data snippets over sendMessage
    // as it loses all its methods, only properties remain
    Folder.makeListIfFolder(Data);
    chrome.runtime.sendMessage({ updateData: Data }, chromeAPICallWrapper(callback));
    Folder.makeFolderIfList(Data);
}

function databaseSetValue(name, value, callback) {
    const obj = {};
    obj[name] = value;

    // the localStorage[LS_STORAGE_TYPE_PROP] works on the assumption
    // that this function will always be called from the bg.js frame
    // hence sending a runtime msg to get the storage type won't work
    chrome.storage[localStorage[LS_STORAGE_TYPE_PROP]].set(obj, () => {
        if (callback) {
            callback();
        }
    });
}

/**
 * @param {Function} callback fn to call after save
 */
function DBSave(callback) {
    Folder.makeListIfFolder(Data);

    // issues#4
    Data.dataUpdateVariable = !Data.dataUpdateVariable;

    databaseSetValue(OLD_DATA_STORAGE_KEY, Data, () => {
        if (callback) {
            callback();
        }
    });

    // once databaseSetValue has been called, doesn't matter
    // if this prop is object/array since storage.clear/set
    // methods are using a separate storageObj
    Folder.makeFolderIfList(Data);
}

/**
 * PRECONDITION: Data.snippets is a Folder object
 */
function saveSnippetData(callback, folderNameToList, objectNamesToHighlight) {
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

        if (callback) {
            callback();
        }
    });
}

// save data not involving snippets
function saveOtherData(msg = "Saved!", callback) {
    DBupdate(() => {
        if (typeof msg === "function") {
            msg();
        } else if (typeof msg === "string") {
            window.alert(msg);
        }

        if (callback) {
            callback();
        }
    });
}

// transfer data from one storage to another
function migrateData(transferData, callback) {
    const copyOfTheOldData = Data.snippets.toArray();

    // make current storage unusable
    Data.snippets = false;

    DBupdate(() => {
        chrome.runtime.sendMessage({ changeStorageType: true }, () => {
            if (transferData) {
                Data.snippets = copyOfTheOldData;
                DBupdate(callback);
            } else if (callback) {
                // don't do Data.snippets = Folder.fromArray(Data.snippets);
                // here since Data.snippets is false and since this is
                // the sync2 option, we need to retain the data that user had
                // previously synced on another PC

                callback();
            }
        });
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
    SETTINGS_DEFAULTS,
    LS_REVISIONS_PROP,
    LS_STORAGE_TYPE_PROP,
    OLD_DATA_STORAGE_KEY,
    DBSave,
};
