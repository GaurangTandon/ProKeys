/* global Data */
// eslint-disable-next-line no-unused-vars
/* global $containerSnippets, $panelSnippets */

import {
    q, qCls, qClsSingle, qId, Q, debounce, SHOW_CLASS,
} from "./pre";
import {
    Folder, Snip, Generic, DualTextbox,
} from "./snippetClasses";
import { saveSnippetData } from "./commonDataHandlers";

let validateSnippetData,
    validateFolderData,
    toggleSnippetEditPanel,
    toggleFolderEditPanel,
    dualSnippetEditorObj;
/**
 * @param {String} type generic snip or folder
 * @returns {Function} the handler for given type
 */
function handlerSaveObject(type) {
    const validationFunc = type === Generic.SNIP_TYPE ? validateSnippetData : validateFolderData;
    // once checked, now can mutate type as per need
    type = type[0].toUpperCase() + type.substr(1).toLowerCase();

    return function () {
        return validationFunc((oldName, name, body, newParentfolder) => {
            if (oldName) {
                const oldObject = Data.snippets[`getUnique${type}`](oldName),
                    oldParentFolder = oldObject.getParentFolder();

                if (newParentfolder.name !== oldParentFolder.name) {
                    // first move that object; before changing its name/body
                    const movedObject = oldObject.moveTo(newParentfolder);

                    movedObject.name = name;
                    if (type === "Snip") {
                        movedObject.body = body;
                    }

                    window.latestRevisionLabel = `moved "${name}" ${movedObject.type} to "${
                        newParentfolder.name
                    }"`;
                    saveSnippetData(undefined, newParentfolder.name, name);
                } else {
                    oldParentFolder[`edit${type}`](oldName, name, body);
                    saveSnippetData(undefined, newParentfolder.name, name);
                }
            } else {
                newParentfolder[`add${type}`](name, body);
                saveSnippetData(undefined, newParentfolder.name, name);
            }
        });
    };
}

/**
 * setup the folder or snippet edit panel
 * attaches handlers to div's
 * @param {String} type generic snip or folder
 * @returns {Function} triggered for display of edit panel
 */
function setupEditPanel(type) {
    const $panel = qClsSingle(`panel_${type}_edit`),
        saveHandler = handlerSaveObject(type),
        nameElm = $panel.q(".name input");
    let $parentFolderDIV;

    $panel.on("keydown", (event) => {
        // ctrl/cmd-enter
        if (event.keyCode === 13 && (event.ctrlKey || event.metaKey)) {
            saveHandler();
        }

        // escape
        if (event.keyCode === 27) {
            $panel.qClsSingle("close_btn").click();
        }
    });

    nameElm.on("keydown", (event) => {
        // the ! ensures that both the $panel and the nameElm handlers don't fire simultaneously
        if (event.keyCode === 13 && !(event.ctrlKey || event.metaKey)) {
            saveHandler();
        }
    });

    function highlightInFolderList(folderElm, name) {
        const $folderNames = folderElm.Q("p");
        let folderUsable = null;

        for (const folder of $folderNames) {
            if (folder.html() === name) {
                folderUsable = folder;
                folder.addClass("selected");
                break;
            }
        }

        if (folderUsable) {
            $parentFolderDIV = folderUsable.parent("div");
            while (!$parentFolderDIV.classList.contains("selectList")) {
                $parentFolderDIV.removeClass("collapsed");
                $parentFolderDIV = $parentFolderDIV.parent("div");
            }
        }
    }

    return function (object, isSavingSnippet) {
        const headerSpan = $panel.q(".header span"),
            folderElm = $panel.q(".folderSelect .selectList"),
            folderPathElm = $panelSnippets.q(".folder_path :nth-last-child(2)"),
            // boolean to tell if call is to edit existing snippet/folder
            // or create new snippet
            isEditing = !!object,
            isSnip = type === "snip",
            errorElements = qCls("error");

        $panelSnippets.toggleClass(SHOW_CLASS);
        $panel.toggleClass(SHOW_CLASS);
        if (isEditing) {
            $panel.removeClass("creating-new");
        } else {
            $panel.addClass("creating-new");
        }

        /* cleanup  (otherwise abnormal rte swap window.alerts are received from
                userAllowsToLoseFormattingOnSwapToTextarea method when we
                later would load another snippet) */
        dualSnippetEditorObj.setPlainText("").setRichText("");

        // had clicked the tick btn
        if (isSavingSnippet) {
            return;
        }

        // reset
        folderElm.html("");

        // cannot nest a folder under itself
        folderElm.appendChild(
            isEditing && type === "folder"
                ? Data.snippets.getFolderSelectList(object.name)
                : Data.snippets.getFolderSelectList(),
        );

        if (isEditing) {
            const parent = object.getParentFolder();
            highlightInFolderList(folderElm, parent.name);
        } else {
            highlightInFolderList(folderElm, folderPathElm.html());
        }

        headerSpan.html((isEditing ? "Edit " : "Create new ") + type);

        if (errorElements) {
            errorElements.removeClass(SHOW_CLASS);
        }

        // defaults
        if (!isEditing) {
            object = {
                name: "",
                body: "",
            };
        }

        nameElm.text(object.name).focus();
        nameElm.dataset.name = object.name;
        if (isSnip) {
            dualSnippetEditorObj.switchToDefaultView(object.body).setShownText(object.body);
        }
    };
}

/** functions common to snip and folder
 * @param {String} panelName snip or folder only
 * @returns {Function} extracts text from elms, passes them for validation, callsback
 */
function commonValidation(panelName) {
    const panel = qClsSingle(`panel_${panelName}_edit`);

    function manipulateElmForValidation(elm, validateFunc, errorElm) {
        const text = elm ? elm.value : dualSnippetEditorObj.getShownTextForSaving(),
            textVld = validateFunc(text),
            textErrorElm = errorElm || elm.nextElementSibling;
        let isTextValid = textVld === "true";

        // when we are editing snippet/folder it does
        // not matter if the name remains same
        if (
            textVld === Generic.getDuplicateObjectsText(text, panelName)
            && elm.dataset.name === text
        ) {
            isTextValid = true;
        }

        if (isTextValid) {
            textErrorElm.removeClass(SHOW_CLASS);
        } else {
            textErrorElm.addClass(SHOW_CLASS).html(textVld);
        }

        return [text, isTextValid];
    }

    return function (callback) {
        const nameElm = panel.q(".name input"),
            selectList = panel.qClsSingle("selectList"),
            folder = Folder.getSelectedFolderInSelectList(selectList),
            isSnippet = /snip/.test(panel.className);
        let name,
            body;

        if (isSnippet) {
            name = manipulateElmForValidation(nameElm, Snip.isValidName);
            body = manipulateElmForValidation(undefined, Snip.isValidBody, panel.q(".body .error"));
        } else {
            name = manipulateElmForValidation(nameElm, Folder.isValidName);
        }

        const allValid = name[1] && (isSnippet ? body[1] : true),
            oldName = nameElm.dataset.name;

        if (allValid) {
            if (isSnippet) {
                toggleSnippetEditPanel(undefined, true);
            } else {
                toggleFolderEditPanel(undefined, true);
            }

            callback(oldName, name[0], body && body[0], folder);
        }
    };
}

export function initSnippetWork() {
    // define element variables
    const $searchBtn = qClsSingle("search_btn"),
        $searchPanel = qClsSingle("panel_search"),
        $searchField = q(".panel_search input[type=text]"),
        $closeBtn = qCls("close_btn"),
        $snippetSaveBtn = q(".panel_snip_edit .tick_btn"),
        $folderSaveBtn = q(".panel_folder_edit .tick_btn"),
        $addNewBtns = Q(".panel_snippets [class^=\"add_new\"]"),
        $sortBtn = q(".panel_snippets .sort_btn"),
        $sortPanel = qClsSingle("panel_sort"),
        // the button that actually initiates sorting
        $sortPanelBtn = q(".panel_sort input[type=button]"),
        $bulkActionBtn = q(".panel_snippets .checkbox_btn"),
        $bulkActionPanel = q(".panel_snippets .panel_bulk_action"),
        folderPath = qClsSingle("folder_path"),
        $selectList = qCls("selectList");

    validateSnippetData = commonValidation(Generic.SNIP_TYPE);
    validateFolderData = commonValidation(Generic.FOLDER_TYPE);
    toggleSnippetEditPanel = setupEditPanel(Generic.SNIP_TYPE);
    toggleFolderEditPanel = setupEditPanel(Generic.FOLDER_TYPE);
    dualSnippetEditorObj = new DualTextbox(qId("body-editor"));

    /**
     * Delegated handler for edit, delete, clone buttons
     */
    $containerSnippets.on("click", (e) => {
        const node = e.target,
            container = node.parentNode,
            objectElm = container.parentNode;
        let obj;

        if (!objectElm || !/buttons/.test(container.className)) {
            return true;
        }

        if (node.matches("#snippets .panel_content .edit_btn")) {
            obj = Generic.getObjectThroughDOMListElm(objectElm);
            if (Folder.isFolder(obj)) {
                toggleFolderEditPanel(obj);
            } else {
                toggleSnippetEditPanel(obj);
            }
        } else if (node.matches("#snippets .panel_content .delete_btn")) {
            deleteOnClick.call(objectElm);
        } else if (node.matches("#snippets .panel_content .clone_btn")) {
            cloneBtnOnClick.call(objectElm);
        }

        return false;
    });

    folderPath.on("click", (e) => {
        const node = e.target;
        let folderName,
            folder;

        if (node.matches(".chevron")) {
            folder = Folder.getListedFolder();
            folder.getParentFolder().listSnippets();
        } else if (node.matches(".path_part") || node.parentElement.matches(".path_part")) {
            // sometimes the click wil have target as the span.notranslate
            folderName = node.innerText;
            folder = Data.snippets.getUniqueFolder(folderName);
            folder.listSnippets();
        }
    });

    /**
     * @param {Element} $panel the snippet or folder panel being edited
     * @param {Element} $objectName the input element containing the object name
     * @returns {Boolean} if the text typed in the panel is edited (true)
     */
    function userHasEditedTextPresentInPanel($panel, $objectName) {
        const $body = $panel.qClsSingle("body"),
            objectName = $objectName.value,
            nameChanged = $objectName.dataset.name !== objectName;

        if (!$body || nameChanged) {
            return nameChanged;
        }

        if (objectName === "") {
            return false;
        }

        const body = dualSnippetEditorObj.getShownTextForSaving(),
            snip = Data.snippets.getUniqueSnip(objectName),
            bodyChanged = snip ? snip.body !== body : false;

        return bodyChanged;
    }

    function closePanel($panel) {
        $panel.removeClass(SHOW_CLASS);
        $panelSnippets.addClass(SHOW_CLASS);
    }

    $closeBtn.on("click", function () {
        const $panel = this.parent(".panel"),
            $objectName = $panel.q(".name input");

        if ($objectName && userHasEditedTextPresentInPanel($panel, $objectName)) {
            if (window.confirm("You have unsaved edits. Are you sure you wish to leave?")) {
                closePanel($panel);
            }
        } else {
            // not an edit panel, but rather some export popup
            closePanel($panel);
        }
    });

    $snippetSaveBtn.on("click", handlerSaveObject(Generic.SNIP_TYPE));
    $folderSaveBtn.on("click", handlerSaveObject(Generic.FOLDER_TYPE));

    function deleteOnClick() {
        const object = Generic.getObjectThroughDOMListElm(this),
            { name, type } = object,
            isSnip = type === Generic.SNIP_TYPE,
            warning = isSnip ? "" : " (and ALL its contents)";
        let folder;

        if (window.confirm(`Delete '${name}' ${type}${warning}?`)) {
            folder = object.getParentFolder();

            object.remove();
            this.parentNode.removeChild(this);

            window.latestRevisionLabel = `deleted ${type} "${name}"`;

            saveSnippetData(undefined, folder.name);
        }
    }

    function cloneBtnOnClick() {
        const clickedObject = Generic.getObjectThroughDOMListElm(this),
            objectClone = clickedObject.clone();
        window.latestRevisionLabel = `cloned ${clickedObject.type} "${clickedObject.name}"`;

        // keep the same snippet highlighted as well (object.name)
        // so that user can press clone button repeatedly
        saveSnippetData(undefined, objectClone.getParentFolder().name, [
            clickedObject.name,
            objectClone.name,
        ]);
    }

    $selectList.on("click", function (e) {
        const clickedNode = e.target,
            classSel = "selected",
            collapsedClass = "collapsed";
        let otherNodes,
            $containerDIV;

        if (clickedNode.tagName === "P") {
            // do not use $selectList
            // as it is a NodeList
            $containerDIV = clickedNode.parentNode;
            $containerDIV.toggleClass(collapsedClass);

            otherNodes = this.qCls(classSel);
            if (otherNodes) {
                otherNodes.removeClass(classSel);
            }
            clickedNode.addClass(classSel);
        }
    });

    // for searchBtn and $searchPanel
    // $addNewBtn and $addNewPanel
    // and other combos
    function toggleBtnAndPanel(btn, panel) {
        const existingPanel = q(".sub_panel.show");
        panel.addClass(SHOW_CLASS);
        if (existingPanel) {
            existingPanel.removeClass(SHOW_CLASS);
        }

        const existingBtn = q(".panel_btn.active");
        btn.addClass("active");
        if (existingBtn) {
            existingBtn.removeClass("active");
        }

        // we need these checks as another might have been clicked
        // to remove the search/checkbox panel and so we need to remove
        // their type of list
        if (!$searchPanel.hasClass(SHOW_CLASS) && Folder.getListedFolder().isSearchResultFolder) {
            Data.snippets.listSnippets();
        }

        // if checkbox style list is still shown
        if (
            $containerSnippets.q("input[type=\"checkbox\"]")
            && !$bulkActionPanel.hasClass(SHOW_CLASS)
        ) {
            Data.snippets
                .getUniqueFolder($bulkActionPanel.dataset.originalShownFolderName)
                .listSnippets();
        }
    }

    $sortBtn.on("click", () => {
        toggleBtnAndPanel($sortBtn, $sortPanel);
    });

    $sortPanelBtn.on("click", () => {
        let sortDir = $sortPanel.q(".sort-dir :checked").parentNode.innerText,
            sortType = $sortPanel.q(".sort-type :checked").parentNode.innerText;
        const descendingFlag = (sortDir = sortDir === "Descending"),
            lastFolderDOM = folderPath.lastChild.previousSibling,
            folder = Data.snippets.getUniqueFolder(lastFolderDOM.html());

        sortType = sortType === "Name" ? "alphabetic" : "date";

        folder.sort(sortType, descendingFlag);
        window.latestRevisionLabel = `sorted folder "${folder.name}"`;
        saveSnippetData(undefined, folder.name);
    });

    $addNewBtns.on("click", function () {
        if (/snip/i.test(this.className)) {
            toggleSnippetEditPanel();
        } else {
            toggleFolderEditPanel();
        }
    });

    $searchBtn.on("click", () => {
        toggleBtnAndPanel($searchBtn, $searchPanel);
        $searchField.html("").focus();
        // now hidden search panel, so re-list the snippets
        if (!$searchPanel.hasClass(SHOW_CLASS)) {
            Folder.getListedFolder().listSnippets();
        }
    });

    $searchBtn.attr("title", "Search for folders or snips");
    $searchField.on(
        "keyup",
        debounce(function searchFieldHandler() {
            const searchText = this.value,
                listedFolder = Folder.getListedFolder(),
                searchResult = listedFolder.searchSnippets(searchText);

            searchResult.listSnippets();
        }, 150),
    );

    (function bulkActionsWork() {
        let selectedObjects,
            DOMcontainer;
        const moveToBtn = $bulkActionPanel.q(".bulk_actions input:first-child"),
            deleteBtn = $bulkActionPanel.q(".bulk_actions input:last-child"),
            toggleAllButton = $bulkActionPanel.q(".selection_count input"),
            folderSelect = $bulkActionPanel.qClsSingle("folderSelect"),
            selectList = $bulkActionPanel.qClsSingle("selectList");

        function updateSelectionCount() {
            selectedObjects = DOMcontainer.Q("input:checked") || [];

            selectedObjects = selectedObjects.map((e) => {
                const div = e.nextElementSibling.nextElementSibling,
                    name = div.html(),
                    img = e.nextElementSibling,
                    type = img.src.match(/\w+(?=\.svg)/)[0];

                return Data.snippets.getUniqueObject(name, type);
            });

            $bulkActionPanel.q(".selection_count span").html(selectedObjects.length);

            $bulkActionPanel.Q(".bulk_actions input").forEach((elm) => {
                elm.disabled = !selectedObjects.length;
            });
        }

        $bulkActionBtn.on("click", function () {
            let originalShownFolderName,
                originalShownFolder;

            toggleBtnAndPanel(this, $bulkActionPanel);

            if ($bulkActionPanel.hasClass(SHOW_CLASS)) {
                originalShownFolderName = Folder.getListedFolderName();
                originalShownFolder = Data.snippets.getUniqueFolder(originalShownFolderName);
                DOMcontainer = Folder.insertBulkActionDOM(originalShownFolder);

                $bulkActionPanel.dataset.originalShownFolderName = originalShownFolderName;

                DOMcontainer.on("click", (event) => {
                    const nodeClicked = event.target,
                        parentGeneric = nodeClicked.matches(".generic")
                            ? nodeClicked
                            : nodeClicked.parent(".generic"),
                        inputCheckbox = parentGeneric.children[0];

                    if (nodeClicked.tagName !== "INPUT") {
                        inputCheckbox.checked = !inputCheckbox.checked;
                    }

                    updateSelectionCount();
                });

                updateSelectionCount();
                folderSelect.removeClass(SHOW_CLASS);
            }
        });

        toggleAllButton.on("click", () => {
            const checkboxes = DOMcontainer.Q("input");
            let allCheckedBoxesChecked = true,
                finalCheckState;

            checkboxes.some((checkbox) => {
                if (!checkbox.checked) {
                    allCheckedBoxesChecked = false;
                    return true;
                }
                return false;
            });

            finalCheckState = !allCheckedBoxesChecked;

            checkboxes.forEach((checkbox) => {
                checkbox.checked = finalCheckState;
            });

            updateSelectionCount();
        });

        // move to folder button
        moveToBtn.on("click", () => {
            let selectFolderName,
                selectedFolder,
                atleastOneElementMoved = false;

            if (!folderSelect.hasClass(SHOW_CLASS)) {
                Folder.refreshSelectList(selectList);
                folderSelect.addClass(SHOW_CLASS);
            } else {
                selectedFolder = Folder.getSelectedFolderInSelectList(selectList);
                selectFolderName = selectedFolder.name;
                selectedObjects.forEach((selObj) => {
                    if (selObj.canNestUnder(selectedFolder)) {
                        atleastOneElementMoved = true;
                        selObj.moveTo(selectedFolder);
                    } else {
                        window.alert(
                            `Cannot move ${selObj.type} "${selObj.name}" to "${
                                selectedFolder.name
                            }"`
                            + "; as it is the same as (or a parent folder of) the destination folder",
                        );
                    }
                });

                // do not list new folder if nothing was moved
                if (!atleastOneElementMoved) {
                    return;
                }

                window.latestRevisionLabel = `moved ${
                    selectedObjects.length
                } objects to folder "${selectFolderName}"`;

                saveSnippetData(
                    () => {
                        // hide the bulk action panel
                        $bulkActionBtn.click();
                    },
                    selectFolderName,
                    selectedObjects.map(e => e.name),
                );
            }
        });

        deleteBtn.on("click", () => {
            if (
                window.confirm(
                    `Are you sure you want to delete these ${selectedObjects.length} items? `
                    + "Remember that deleting a folder will also delete ALL its contents.",
                )
            ) {
                selectedObjects.forEach((selObj) => {
                    selObj.remove();
                });

                window.latestRevisionLabel = `deleted ${selectedObjects.length} objects`;

                saveSnippetData(() => {
                    // hide the bulk action panel
                    $bulkActionBtn.click();
                }, Folder.getListedFolderName());
            }
        });
    }());

    (function checkIfFirstTimeUser() {
        const $changeLog = qClsSingle("change-log"),
            $button = $changeLog.q("button"),
            // ls set by background page
            isUpdate = localStorage.extensionUpdated === "true";

        if (isUpdate) {
            $changeLog.addClass(SHOW_CLASS);

            $button.on("click", () => {
                $changeLog.removeClass(SHOW_CLASS);
                localStorage.extensionUpdated = "false";
                chrome.browserAction.setBadgeText({ text: "" });
            });
        }
    }());

    Data.snippets.listSnippets();
}
