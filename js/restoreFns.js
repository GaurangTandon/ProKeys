/* global pk, Data, Folder, q, saveSnippetData, SETTINGS_DEFAULTS, ensureRobustCompat */

let validateRestoreData,
    initiateRestore;
(function backUpDataValidationFunctions() {
    let duplicateSnippetToKeep,
        typeOfData;

    // duplicateSnippetToKeep - one of "existing", "imported", "both"
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

    // receives charToAutoInsertUserList from user
    // during restore and validates it
    function validateCharListArray(charList) {
        for (let i = 0, len = charList.length, item, autoInsertSpecifierMessage; i < len; i++) {
            item = charList[i];
            autoInsertSpecifierMessage = `elements in ${i + 1}th character list`;

            // item should be array
            if (!Array.isArray(item)) {
                return `Invalid ${autoInsertSpecifierMessage}`;
            }

            // array should be of 2 items
            if (item.length !== 2) {
                return `Expected exactly 2 ${autoInsertSpecifierMessage}`;
            }

            // item's elements should be string
            if (typeof item[0] + typeof item[1] !== "stringstring") {
                return `${autoInsertSpecifierMessage} are not strings.`;
            }

            // item's elements should be one char in length
            if (item[0].length !== 1 || item[1].length !== 1) {
                return `${autoInsertSpecifierMessage} are not of length 1.`;
            }

            // check dupes
            for (let j = i + 1; j < len; j++) {
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

        saveSnippetData(() => {
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

        for (let k = 0, len = data.blockedSites.length, elm; k < len; k++) {
            elm = data.blockedSites[k];

            // check type
            if (typeof elm !== "string") {
                return `Element ${elm} of blocked sites was not a string.`;
            }

            data.blockedSites[k] = elm.replace(/^www/, "");

            // delete duplicate sites
            for (let j = k + 1; j < len; j++) {
                if (elm === data.blockedSites[j]) {
                    data.blockedSites.splice(j, 1);
                    j--;
                }
            }
        }

        return "true";
    };
}());
window.validateRestoreData = validateRestoreData;
window.initiateRestore = initiateRestore;
