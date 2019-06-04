/* global pk, Data, getCurrentStorageType */
/* global chrome, Folder, SETTINGS_DEFAULTS, storage */
/* global saveRevision, notifySnippetDataChanges */

(function () {
    const IN_OPTIONS_PAGE = window.location.href && /chrome-extension:\/\//.test(window.location.href);
    window.storage = chrome.storage.local;
    window.SETTINGS_DEFAULTS = {
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
    };
    pk.DB_loaded = false;
    // currently it's storing default data for first install;
    // after DB_load, it stores the latest data
    // snippets are later added
    window.Data = JSON.parse(JSON.stringify(SETTINGS_DEFAULTS));
    pk.OLD_DATA_STORAGE_KEY = "UserSnippets";
    pk.NEW_DATA_STORAGE_KEY = "ProKeysUserData";
    pk.DATA_KEY_COUNT_PROP = `${pk.NEW_DATA_STORAGE_KEY}_-1`;
    pk.snipNameDelimiterListRegex = null;

    function databaseSetValue(name, value, callback) {
        const obj = {};
        obj[name] = value;

        storage.set(obj, () => {
            if (callback) {
                callback();
            }
        });
    }

    window.DB_load = function (callback) {
        storage.get(pk.OLD_DATA_STORAGE_KEY, (r) => {
            const req = r[pk.OLD_DATA_STORAGE_KEY];

            // converting to !== might break just in case this relies on 0 == undefined :/
            // eslint-disable-next-line eqeqeq
            if (pk.isObjectEmpty(req) || req.dataVersion != Data.dataVersion) {
                databaseSetValue(pk.OLD_DATA_STORAGE_KEY, Data, callback);
            } else {
                Data = req;
                if (callback) {
                    callback();
                }
            }
        });
    };

    function databaseSave(callback) {
        databaseSetValue(pk.OLD_DATA_STORAGE_KEY, Data, () => {
            if (callback) {
                callback();
            }
        });
    }

    /**
     * PRECONDITION: Data.snippets is a Folder object
     */
    window.saveSnippetData = function (callback, folderNameToList, objectNamesToHighlight) {
        Data.snippets = Data.snippets.toArray();

        // refer github issues#4
        Data.dataUpdateVariable = !Data.dataUpdateVariable;

        databaseSave(() => {
            if (IN_OPTIONS_PAGE) {
                saveRevision(Data.snippets.toArray());
                notifySnippetDataChanges();
            }

            Folder.setIndices();
            const folderToList = folderNameToList
                ? Data.snippets.getUniqueFolder(folderNameToList)
                : Data.snippets;
            folderToList.listSnippets(objectNamesToHighlight);

            pk.checkRuntimeError("databaseSave inside")();

            if (callback) {
                callback();
            }
        });

        Data.snippets = Folder.fromArray(Data.snippets);
    };

    // save data not involving snippets
    window.saveOtherData = function (msg = "Saved!", callback) {
        Data.snippets = Data.snippets.toArray();

        // issues#4
        Data.dataUpdateVariable = !Data.dataUpdateVariable;

        databaseSave(() => {
            if (typeof msg === "function") {
                msg();
            } else if (typeof msg === "string") {
                window.alert(msg);
            }
            pk.checkRuntimeError("saveotherdata-options.js")();

            if (callback) {
                callback();
            }
        });

        // once databaseSave has been called, doesn't matter
        // if this prop is object/array since storage.clear/set
        // methods are using a separate storageObj
        Data.snippets = Folder.fromArray(Data.snippets);
    };

    // get type of current storage as string
    window.getCurrentStorageType = function () {
        // property MAX_ITEMS is present only in sync
        return storage.MAX_ITEMS ? "sync" : "local";
    };

    // changes type of storage: local-sync, sync-local
    window.changeStorageType = function () {
        storage = getCurrentStorageType() === "sync" ? chrome.storage.local : chrome.storage.sync;
    };
}());
