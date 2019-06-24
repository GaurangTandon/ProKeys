/* global Data */

import {
    Q, q, copyTextToClipboard, SHOW_CLASS, qClsSingle, appendBlobToLink,
} from "./pre";
import { Folder } from "./snippetClasses";
import { initiateRestore, convertSnippetsToCSV, generateDataFromCSV } from "./restoreFns";
import { LS_REVISIONS_PROP, saveSnippetData } from "./commonDataHandlers";

export function initBackup() {
    let dataToExport;

    // flattens all folders
    /**
     * prints the snippets inside the folder
     * flattens the folder (to level 1) in case it is nested
     * @param {Folder} folder folder whose snippets will be printed
     */
    function getSnippetPrintData(folder) {
        let res = "";

        folder.forEachSnippet((sn) => {
            res += sn.name;
            res += "\n\n";
            res += sn.body;
            res += "\n\n--\n\n";
        }, false);

        return res;
    }

    Q(".export-buttons button").on("click", function () {
        const buttonClass = this.className,
            functionMap = {
                export: showDataForExport,
                import: setupImportPopup,
                revisions: setUpPastRevisions,
            };

        q(`#snippets .panel_popup.${buttonClass}`).addClass(SHOW_CLASS);
        functionMap[buttonClass]();
    });

    function showDataForExport() {
        const dataUse = q(".export .steps :first-child input:checked").value,
            downloadLinkTxt = q(".export a.text-download"),
            downloadLinkCsv = q(".export a.csv-download");

        if (dataUse === "print") {
            dataToExport = getSnippetPrintData(Data.snippets);
        } else {
            const orgSnippets = Data.snippets;
            Data.snippets = Data.snippets.toArray();
            dataToExport = JSON.stringify(dataUse === "data" ? Data : Data.snippets, undefined, 2);
            Data.snippets = orgSnippets;
        }

        const filename = dataUse === "print" ? "ProKeys print snippets" : `ProKeys ${dataUse}`;
        appendBlobToLink(downloadLinkCsv, convertSnippetsToCSV(Data.snippets), filename);
        appendBlobToLink(downloadLinkTxt, dataToExport, filename);
    }

    const copyToClipboardLink = q(".export .copy-data-to-clipboard-btn");
    copyToClipboardLink.on("click", () => {
        copyTextToClipboard(dataToExport);
    });

    Q(".export input").on("change", showDataForExport);

    const fileInputLink = q(".import .file_input"),
        $inputFile = fileInputLink.nextElementSibling,
        initialLinkText = fileInputLink.html(),
        importPopup = q(".panel.import"),
        importThroughClipboardSpan = q(".import-data-clipboard-btn");
    let importFileData = null;

    function setupImportPopup() {
        const $selectList = q(".import .selectList");
        Folder.refreshSelectList($selectList);
        fileInputLink.html("Choose file containing data");
        // reset so that if same file is selected again,
        // onchange can still fire
        $inputFile.value = "";
    }

    q(".import .restore").on("click", () => {
        if (importFileData) {
            const isCsv = qClsSingle("csv-check-import").checked;
            if (isCsv) {
                importFileData = generateDataFromCSV(importFileData);
            }
            initiateRestore(importFileData);
        } else {
            window.alert("Please choose a file.");
        }
    });

    importPopup.on("paste", (event) => {
        importFileData = event.clipboardData.getData("text");
        importThroughClipboardSpan.html("Pasted data is ready. Click Restore button to begin.");
    });

    $inputFile.on("change", () => {
        const file = $inputFile.files[0];

        if (!file) {
            return false;
        }

        const reader = new FileReader();

        // don't use .on here as it is NOT
        // an HTML element
        reader.addEventListener("load", (event) => {
            importFileData = event.target.result;

            fileInputLink.html(
                `File '${file.name}' is READY.`
                + " Click Restore button to begin. Click here again to choose another file.",
            );
        });

        reader.addEventListener("error", (event) => {
            console.error(
                `File '${
                    importFileData.name
                }' could not be read! Please send following error to prokeys.feedback@gmail.com `
                + ` so that I can fix it. Thanks! ERROR: ${event.target.error.code}`,
            );
            fileInputLink.html(initialLinkText);
        });

        reader.readAsText(file);

        fileInputLink.html(`READING FILE: ${file.name}`);
        return true;
    });

    const $revisionsRestoreBtn = q(".revisions .restore"),
        $textarea = q(".revisions textarea"),
        $select = q(".revisions select"),
        $closeRevisionsPopupBtn = q(".revisions .close_btn"),
        $preserveCheckboxesLI = q(".import .preserve_checkboxes"),
        $mergeDuplicateFolderContentsInput = $preserveCheckboxesLI.q("[name=merge]"),
        $preserveExistingContentInput = $preserveCheckboxesLI.q("[value=existing]"),
        $preserveImportedContentInput = $preserveCheckboxesLI.q("[value=imported]"),
        $caveatParagraph = $preserveCheckboxesLI.q("p");
    let selectedRevision;

    function setUpPastRevisions() {
        const revisions = JSON.parse(localStorage[LS_REVISIONS_PROP]);

        $select.html("");

        revisions.forEach((rev) => {
            $select.appendChild(q.new("option").html(rev.label));
        });

        function showRevision() {
            selectedRevision = revisions[$select.selectedIndex];
            $textarea.value = JSON.stringify(selectedRevision.data, undefined, 2);
        }

        $select.on("input", showRevision);
        showRevision();
    }

    // when we restore one revision, we have to remove it from its
    // previous position; saveSnippetData will automatically insert it
    // back at the top of the list again
    function deleteRevision(index) {
        const parsed = JSON.parse(localStorage[LS_REVISIONS_PROP]);

        parsed.splice(index, 1);
        localStorage[LS_REVISIONS_PROP] = JSON.stringify(parsed);
    }

    $revisionsRestoreBtn.on("click", () => {
        try {
            if (window.confirm("Are you sure you want to use the selected revision?")) {
                Data.snippets = Folder.fromArray(JSON.parse($textarea.value));
                deleteRevision($select.selectedIndex);
                window.latestRevisionLabel = `restored revision (labelled: ${
                    selectedRevision.label
                })`;
                saveSnippetData(() => {
                    $closeRevisionsPopupBtn.click();
                });
            }
        } catch (e) {
            window.alert(
                "Data in textarea was invalid. Close this box and check console log (Ctrl+Shift+J/Cmd+Shift+J) for error report. Or please try again!",
            );
        }
    });

    $preserveCheckboxesLI.on("click", () => {
        if (!$mergeDuplicateFolderContentsInput.checked) {
            if ($preserveExistingContentInput.checked) {
                $caveatParagraph.html(
                    "<b>Caveat</b>: Unique content of "
                    + "folders with the same name will not be imported.",
                );
            } else if ($preserveImportedContentInput.checked) {
                $caveatParagraph.html(
                    "<b>Caveat</b>: Unique content of existing folders "
                    + "with the same name will be lost.",
                );
            } else {
                $caveatParagraph.html("");
            }
        } else {
            $caveatParagraph.html("");
        }
    });
}
