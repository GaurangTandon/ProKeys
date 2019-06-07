/* global pk, Data */

import { q } from "./pre";
import { Folder } from "./snippet_classes";
import { SETTINGS_DEFAULTS } from "./common_data_handlers";

export function ensureRobustCompat(data) {
    let missingProperties = false;

    for (const prop of Object.keys(SETTINGS_DEFAULTS)) {
        if (typeof data[prop] === "undefined") {
            data[prop] = SETTINGS_DEFAULTS[prop];
            missingProperties = true;
        }
    }

    return missingProperties;
}

let validateRestoreData,
    initiateRestore;
(function backUpDataValidationFunctions() {
    /**
     * "existing", "imported", "both"
     * @type {String}
     */
    let duplicateSnippetToKeep,
        typeOfData;

    function handleDuplicatesInSnippets(inputFolderMain, shouldMergeDuplicateFolderContents) {
        const stringToAppendToImportedObject = "(1)";

        function both(object) {
            const objectNameLen = object.name.length;

            if (objectNameLen <= pk.OBJECT_NAME_LIMIT - stringToAppendToImportedObject.length) {
                object.name += stringToAppendToImportedObject;
            } else {
                object.name = object.name.substring(0, objectNameLen - 3) + stringToAppendToImportedObject;
            }
        }

        function handler(inputFolder) {
            const removeIdxs = [];

            inputFolder.list.forEach((object, idx) => {
                if (handleSingleObject(object)) {
                    removeIdxs.push(idx);
                }
            });

            let len = removeIdxs.length - 1;
            while (len >= 0) {
                inputFolder.list.splice(removeIdxs[len--], 1);
            }
        }

        function handleSingleObject(importedObj) {
            const duplicateObj = Data.snippets.getUniqueObject(importedObj.name, importedObj.type),
                shouldKeepBothFolders = duplicateSnippetToKeep === "both";
            let shouldDeleteImportedObject = false;

            if (duplicateObj) {
                switch (duplicateSnippetToKeep) {
                case "both":
                    both(importedObj);
                    break;
                case "imported":
                    duplicateObj.remove();
                    break;
                case "existing":
                    shouldDeleteImportedObject = true;
                    break;
                default:
                }
            }

            if (Folder.isFolder(importedObj)) {
                handler(importedObj);

                // have to merge non-duplicate contents of
                // duplicate folders
                if (duplicateObj && !shouldKeepBothFolders && shouldMergeDuplicateFolderContents) {
                    if (duplicateSnippetToKeep === "imported") {
                        // first we had corrected all the contents of fromFolder (deletedFolder)
                        // by calling handler and then moved
                        // the corrected contents to toFolder (keptFolder)
                        Folder.copyContents(duplicateObj, importedObj);
                    } else {
                        Folder.copyContents(importedObj, duplicateObj);
                    }
                }
            }

            return shouldDeleteImportedObject;
        }

        handler(inputFolderMain);
    }

    /**
     * receives charList from user during restore and validates it
     * @param {String[][]} charList user inputted auto insert pairs
     */
    function validateCharListArray(charList) {
        const len = charList.length;
        for (let idx = 0; idx < len; idx++) {
            const item = charList[idx],
                autoInsertSpecifierMessage = `elements in ${idx + 1}th character list`;

            if (!Array.isArray(item)) {
                return `Invalid ${autoInsertSpecifierMessage}`;
            }

            if (item.length !== 2) {
                return `Expected exactly 2 ${autoInsertSpecifierMessage}`;
            }

            if (typeof item[0] !== "string" || typeof item[1] !== "string") {
                return `${autoInsertSpecifierMessage} are not strings.`;
            }

            // only one char in each
            if (item[0].length !== 1 || item[1].length !== 1) {
                return `${autoInsertSpecifierMessage} are not of length 1.`;
            }

            // check dupes
            for (let j = idx + 1; j < len; j++) {
                if (item[0] === charList[j][0]) {
                    charList.splice(j, 1);
                    j--;
                }
            }
        }

        return "true";
    }

    function convertClipboardPrintSnippetsTextToJSON(string) {
        const time = Date.now();
        let result = [];

        // different OS have different newline endings
        // \r\n - Windows; \r - macOS; \n - Linux
        // https://en.wikipedia.org/wiki/Newline%23Issues_with_different_newline_formats
        string = string.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
        string += "\n\n";
        string = string.split(/\n\n--\n\n/gm);

        string.forEach((snp) => {
            const idx = snp.indexOf("\n\n"),
                name = snp.substring(0, idx);

            if (name !== "") {
                result.push({
                    name,
                    body: snp.substring(idx + 2),
                    timestamp: time,
                });
            }
        });

        result = ["Snippets", time].concat(result);

        result = JSON.stringify(result, null, 4);

        return result;
    }

    initiateRestore = function (data) {
        const importPopup = q(".panel.import"),
            selectList = importPopup.qClsSingle("selectList"),
            selectedFolder = Folder.getSelectedFolderInSelectList(selectList),
            $deleteExistingSnippetsInput = importPopup.qClsSingle("delete_existing"),
            shouldDeleteExistingSnippets = $deleteExistingSnippetsInput.checked,
            shouldMergeDuplicateFolderContents = importPopup.q("input[name=merge]").checked;
        let existingSnippets;

        duplicateSnippetToKeep = importPopup.q("input[name=duplicate]:checked").value;

        try {
            const a = JSON.parse(data);
            data = a;
        } catch (e) {
            try {
                data = JSON.parse(convertClipboardPrintSnippetsTextToJSON(data));
                console.log("Received print snippets data", data);
            } catch (e2) {
                window.alert(
                    "Data was of incorrect format! Please close this box and check console log (Ctrl+Shift+J/Cmd+Shift+J) for error report. And mail it to us at prokeys.feedback@gmail.com to be resolved.",
                );
                console.log(e2.message);
                console.log(data);
                return;
            }
        }

        typeOfData = Array.isArray(data) ? "snippets" : "data";
        const inputSnippetsJSON = typeOfData === "data" ? data.snippets : data,
            validation = validateRestoreData(data, inputSnippetsJSON);

        if (validation !== "true") {
            window.alert(validation);
            return;
        }

        const inputSnippets = Folder.fromArray(inputSnippetsJSON);

        if (shouldDeleteExistingSnippets) {
            selectedFolder.list = [];
        }

        // handling duplicates requires correct indexes
        Folder.setIndices();

        handleDuplicatesInSnippets(inputSnippets, shouldMergeDuplicateFolderContents);

        Folder.copyContents(inputSnippets, selectedFolder);

        if (typeOfData === "data") {
            existingSnippets = Folder.fromArray(Data.snippets.toArray()); // copied
            Data = data;
            Data.snippets = existingSnippets;
        }

        pk.saveSnippetData(() => {
            if (window.confirm("Data saved! Reload the page for changes to take effect?")) {
                window.location.reload();
            }
        });
    };

    // receives data object and checks whether
    // it has only those properties which are required
    // and none other
    validateRestoreData = function (data, snippets) {
        // if data is of pre-3.0.0 times
        // it will not have folders and everything
        const snippetsValidation = Folder.validate(snippets);

        if (snippetsValidation !== "true") {
            return snippetsValidation;
        }

        // all the checks following this line should be of "data" type
        if (typeOfData !== "data") {
            return "true";
        }

        ensureRobustCompat(data);

        // delete user-added properties that ProKeys doesn't recognize
        for (const prop of Object.keys(data)) {
            if (!Object.prototype.hasOwnProperty.call(SETTINGS_DEFAULTS, prop)) {
                delete data[prop];
            }
        }

        const vld2 = validateCharListArray(data.charsToAutoInsertUserList);
        if (vld2 !== "true") {
            return vld2;
        }

        for (const [idx, blockedSite] of data.blockedSites.entries()) {
            // check type
            if (typeof blockedSite !== "string") {
                return `Element ${blockedSite} of blocked sites was not a string.`;
            }

            data.blockedSites[idx] = blockedSite.replace(/^www/, "");
        }

        // remove all duplicates in one step
        data.blockedSites = Array.from(new Set(data.blockedSites));

        return "true";
    };
}());
window.validateRestoreData = validateRestoreData;
window.initiateRestore = initiateRestore;
