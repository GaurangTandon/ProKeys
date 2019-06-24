/* global Data */

import { q, OBJECT_NAME_LIMIT } from "./pre";
import { Folder } from "./snippetClasses";
import { SETTINGS_DEFAULTS, saveSnippetData } from "./commonDataHandlers";

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

        if (objectNameLen <= OBJECT_NAME_LIMIT - stringToAppendToImportedObject.length) {
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

// receives data object and checks whether
// it has only those properties which are required
// and none other
function validateRestoreData(data, snippets) {
    // if data is of pre-3.0.0 times
    // it will not have folders and everything
    ensureRobustCompat(data);

    const snippetsValidation = Folder.validate(snippets);

    if (snippetsValidation !== "true") {
        return snippetsValidation;
    }

    // all the checks following this line should be of "data" type
    if (typeOfData !== "data") {
        return "true";
    }


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
}

function initiateRestore(data, parentFolder = null, shouldDeleteExistingSnippetsArg = null) {
    const importPopup = q(".panel.import"),
        selectList = importPopup.qClsSingle("selectList"),
        selectedFolder = parentFolder || Folder.getSelectedFolderInSelectList(selectList),
        $deleteExistingSnippetsInput = importPopup.qClsSingle("delete_existing"),
        shouldDeleteExistingSnippets = shouldDeleteExistingSnippetsArg || $deleteExistingSnippetsInput.checked,
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

    saveSnippetData(() => {
        if (window.confirm("Data saved! Reload the page for changes to take effect?")) {
            window.location.reload();
        }
    });
}

/**
 * @param {String} csv contents of csv file; one snip per line
 * @param {String} delimiter the delimiter to use
 */
function generateDataFromCSV(csv, delimiter = ",") {
    // all properties will be default except Data.snippets
    const Data = SETTINGS_DEFAULTS,
        snips = csv.split("\n");

    Data.snippets = new Folder(Folder.MAIN_SNIPPETS_NAME);
    for (const snip of snips) {
        const splited = snip.split(delimiter),
            [name, body] = [splited[0], splited.slice(1).join(delimiter)];
        if (name === "" || body === "") { continue; }
        Data.snippets.addSnip(name, body.replace(/\\n/g, "<br>"));
    }
    Data.snippets = Data.snippets.toArray();

    return JSON.stringify(Data);
}

/**
 * @param {Folder} snippetFolder the` folder to make csv of
 * @param {String} delimiter the delimiter to use
 */
function convertSnippetsToCSV(snippetFolder, delimiter = ",") {
    let out = "";

    snippetFolder.forEachSnippet((snip) => { out += `${snip.name + delimiter + snip.body.replace(/\n/g, "\\n")}\n`; });

    return out;
}

export {
    validateRestoreData, initiateRestore, generateDataFromCSV, convertSnippetsToCSV,
};
