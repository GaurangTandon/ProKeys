/* global Data */
// eslint-disable-next-line no-unused-vars
/* global $containerFolderPath, $containerSnippets, $panelSnippets */

import {
    SETTINGS_DEFAULTS,
    DBget,
    saveOtherData,
    migrateData,
    LS_STORAGE_TYPE_PROP,
} from "./commonDataHandlers";
import {
    SHOW_CLASS,
    q,
    Q,
    qClsSingle,
    qId,
    chromeAPICallWrapper,
    isBlockedSite,
    escapeRegExp,
    protoWWWReplaceRegex,
    debounce,
    PRIMITIVES_EXT_KEY,
    gTranlateImmune,
} from "./pre";
import { DualTextbox, Folder } from "./snippetClasses";
import { ensureRobustCompat } from "./restoreFns";
import { initBackup } from "./backupWork";
import { initSnippetWork } from "./snippetWork";
import { getHTML } from "./textmethods";
import { updateAllValuesPerWin } from "./protoExtend";
import { primitiveExtender } from "./primitiveExtend";

window.IN_OPTIONS_PAGE = true;
primitiveExtender();
(function () {
    let $autoInsertTable,
        $tabKeyInput,
        $ctxEnabledInput,
        $snipMatchDelimitedWordInput,
        $snipNameDelimiterListDIV,
        autoInsertWrapSelectionInput,
        omniboxSearchURLInput,
        $blockSitesTextarea;

    const RESERVED_DELIMITER_LIST = "`~|\\^",
        MAX_SYNC_DATA_SIZE = chrome.storage.sync.QUOTA_BYTES,
        MAX_LOCAL_DATA_SIZE = chrome.storage.local.QUOTA_BYTES,
        VERSION = chrome.runtime.getManifest().version;
    window.$containerSnippets = null;
    window.$panelSnippets = null;
    window.$containerFolderPath = null;

    function getCurrentStorageType() {
        return localStorage[LS_STORAGE_TYPE_PROP];
    }

    function getBytesInUse(callback) {
        chrome.runtime.sendMessage({ getBytesInUse: true }, chromeAPICallWrapper(callback));
    }

    function notifyCtxEnableToggle() {
        const msg = { ctxEnabled: Data.ctxEnabled };
        chrome.runtime.sendMessage(msg, chromeAPICallWrapper());
    }

    function listBlockedSites() {
        $blockSitesTextarea.value = Data.blockedSites.join("\n");
    }

    function createTableRow(textArr) {
        const tr = q.new("tr");

        for (const text of textArr) {
            tr.appendChild(q.new("td").html(text));
        }

        return tr;
    }

    function getAutoInsertCharIndex(firstCharToGet) {
        const arr = Data.charsToAutoInsertUserList;

        for (const [index, charPair] of arr.entries()) {
            if (firstCharToGet === charPair[0]) {
                return index;
            }
        }

        return -1;
    }

    function appendInputBoxesInTable() {
        const mainClass = "char_input",
            tr = q.new("tr"),
            // eslint-disable-next-line no-use-before-define
            inp1 = configureTextInputElm("new character"),
            // eslint-disable-next-line no-use-before-define
            inp2 = configureTextInputElm("its complement");

        function append(elm) {
            const td = q.new("td");
            td.appendChild(elm);
            tr.appendChild(td);
        }

        function configureTextInputElm(attribute) {
            const inp = q
                .new("input")
                .addClass(mainClass)
                .attr("placeholder", `Type ${attribute}`);
            inp.type = "text";

            append(inp);

            inp.on("keydown", (e) => {
                if (e.keyCode === 13) {
                    // eslint-disable-next-line no-use-before-define
                    saveAutoInsert([inp1.value, inp2.value]);
                }
            });

            return inp;
        }

        append(q.new("button").html("Save"));

        $autoInsertTable.appendChild(tr);
    }

    // inserts in the table the chars to be auto-inserted
    function listAutoInsertChars() {
        if (Data.charsToAutoInsertUserList.length === 0) {
            $autoInsertTable.html("No Auto-Insert pair currently. Add new:");
        } else {
            const thead = q.new("thead"),
                tr = q.new("tr");

            // clear the table initially
            $autoInsertTable.html("");

            tr.appendChild(q.new("th").html("Character"));
            tr.appendChild(q.new("th").html("Complement"));

            thead.appendChild(tr);

            $autoInsertTable.appendChild(thead);

            for (const charPair of Data.charsToAutoInsertUserList) {
                // create <tr> with <td>s having text as in current array and Remove
                $autoInsertTable.appendChild(createTableRow(charPair.concat("Remove")));
            }
        }

        appendInputBoxesInTable();
    }

    function saveAutoInsert(autoInsertPair) {
        const [firstChar, lastChar] = autoInsertPair,
            str = "Please type exactly one character in ";

        if (firstChar.length !== 1) {
            window.alert(`${str}first field.`);
            return;
        }

        if (lastChar.length !== 1) {
            window.alert(`${str}second field.`);
            return;
        }

        if (getAutoInsertCharIndex(firstChar) !== -1) {
            window.alert(`The character "${firstChar}" is already present.`);
            return;
        }

        // first insert in user list
        Data.charsToAutoInsertUserList.push(autoInsertPair);

        saveOtherData(`Saved auto-insert pair - ${firstChar}${lastChar}`, listAutoInsertChars);
    }

    function removeAutoInsertChar(autoInsertPair) {
        const index = getAutoInsertCharIndex(autoInsertPair[0]);

        Data.charsToAutoInsertUserList.splice(index, 1);

        saveOtherData(`Removed auto-insert pair '${autoInsertPair.join("")}'`, listAutoInsertChars);
    }

    /**
     * returns the current hotkey in string format
     * example: `["shiftKey", 32]` returns `Shift+Space`
     */
    function getCurrentHotkey() {
        function isNumPadKey(keyCode) {
            return keyCode >= 96 && keyCode <= 105;
        }
        const combo = Data.hotKey.slice(0),
            specials = {
                9: "Tab",
                13: "Enter",
                32: "Space",
                188: ", (Comma)",
                192: "` (Backtick)",
            },
            metaKeyNames = {
                shiftKey: "Shift",
                ctrlKey: "Ctrl",
                altKey: "Alt",
                metaKey: "Meta",
            };
        let kC, // keyCode
            result = "";

        // dual-key combo
        if (combo[1]) {
            result += `${metaKeyNames[combo[0]]} + `;

            kC = combo[1];
        } else {
            kC = combo[0];
        }

        if (isNumPadKey(kC)) {
            result += "NumPad";
        }

        // numpad keys
        if (kC >= 96 && kC <= 105) {
            kC -= 48;
        }

        result += specials[kC] || String.fromCharCode(kC);

        return result;
    }

    function sanitizeSiteURLForBlock(URL) {
        const validSiteRegex = /(\w+\.)+\w+/;

        // invalid domain entered; exit
        if (!validSiteRegex.test(URL)) {
            window.alert("Invalid form of site address entered.");
            return false;
        }

        URL = URL.replace(protoWWWReplaceRegex, "");

        // already a blocked site
        if (isBlockedSite(URL)) {
            window.alert(`Site ${URL} is already blocked.`);
            return false;
        }

        return URL;
    }

    // (sample) input 1836 => "2KB"
    // input 5,123,456 => "5MB"
    function roundByteSize(bytes) {
        const suffixPowerMap = {
                MB: 6,
                KB: 3,
                B: 0,
                mB: -3,
            },
            DECIMAL_PLACES_TO_SHOW = 1;

        for (const [suffix, power] of Object.entries(suffixPowerMap)) {
            const lim = 10 ** power;

            if (bytes >= lim) {
                return parseFloat((bytes / lim).toFixed(DECIMAL_PLACES_TO_SHOW)) + suffix;
            }
        }

        return NaN;
    }

    function roundByteSizeWithPercent(bytes, bytesLim) {
        const roundedByteSize = roundByteSize(bytes),
            // nearest multiple of five
            percent = Math.round((bytes / bytesLim) * 100);

        return `${roundedByteSize} (${percent}%)`;
    }

    // updates the storage header in #headArea
    // "You have x bytes left out of y bytes"
    function updateStorageAmount() {
        getBytesInUse((bytesInUse) => {
            const bytesAvailable = getCurrentStorageType() === "sync" ? MAX_SYNC_DATA_SIZE : MAX_LOCAL_DATA_SIZE;

            // set current bytes
            qClsSingle("currentBytes").html(roundByteSizeWithPercent(bytesInUse, bytesAvailable));

            // set total bytes available
            qClsSingle("bytesAvailable").html(roundByteSize(bytesAvailable));
        });
    }

    function afterDBLoad() {
        const changeHotkeyBtn = qClsSingle("change_hotkey"),
            hotkeyListener = qClsSingle("hotkey_listener");

        chrome.storage.onChanged.addListener(updateStorageAmount);

        Q("span.version").forEach((span) => {
            span.innerHTML = VERSION;
        });

        // panels are - #content div
        (function panelWork() {
            const url = window.location.href;

            // used when buttons in navbar are clicked
            // or when the url contains an id of a div
            function showHideDIVs(DIVName) {
                const containerSel = "#content > ",
                    DIVSelector = `#${DIVName}`,
                    btnSelector = `.sidebar .buttons button[data-divid =${DIVName}]`,
                    selectedBtnClass = "selected",
                    selectedDIV = q(`${containerSel}.show`),
                    selectedBtn = q(`.sidebar .buttons .${selectedBtnClass}`);

                if (DIVName === "snippets") {
                    Data.snippets.listSnippets();
                }

                if (selectedDIV) {
                    selectedDIV.removeClass("show");
                }
                q(containerSel + DIVSelector).addClass("show");

                if (selectedBtn) {
                    selectedBtn.removeClass(selectedBtnClass);
                }
                q(btnSelector).addClass(selectedBtnClass);

                let { href } = window.location,
                    selIndex = href.indexOf("#");

                if (selIndex !== -1) {
                    href = href.substring(0, selIndex);
                }

                window.location.href = href + DIVSelector;

                // the page shifts down a little
                // for the exact location of the div;
                // so move it back to the top
                document.body.scrollTop = 0;
            }

            if (/#\w+$/.test(url) && !/tryit|symbolsList/.test(url)) {
                // get the id and show divs based on that
                showHideDIVs(url.match(/#(\w+)$/)[1]);
            } else {
                showHideDIVs("settings");
            } // default panel

            // the left hand side nav buttons
            // Help, Settings, Backup&Restore, About
            Q(".sidebar .buttons button").on("click", function () {
                showHideDIVs(this.dataset.divid);
            });
        }());

        (function helpPageHandlers() {
            /* set up accordion in help page */
            // heading
            Q("#help section dt").on("click", function () {
                this.toggleClass("show");
            });

            // the tryit editor in Help section
            new DualTextbox(qId("tryit"), true)
                .setPlainText(
                    `You can experiment with various ProKeys' features in this interactive editor! This editor is resizable.\n\n
Textarea is the normal text editor mode. No support for bold, italics, etc. But multiline text is supported.\n
Think Notepad.`,
                )
                .setRichText(
                    `This is a contenteditable or editable div.
These editors are generally found in your email client like Gmail, Outlook, etc.<br><br><i>This editor
<u>supports</u></i><b> HTML formatting</b>. You can use the "my_sign" sample snippet here, and see the effect.`,
                );

            function fixMacroTable(table) {
                const tableRows = table.children[1].children;
                Array.prototype.forEach.call(tableRows, (tablerow) => {
                    tablerow.firstElementChild.innerHTML = gTranlateImmune(tablerow.firstElementChild.innerHTML);
                });
            }

            fixMacroTable(qClsSingle("date-macro-list"));
            fixMacroTable(qClsSingle("browser-macro-list"));
        }());

        (function settingsPageHandlers() {
            const $delimiterCharsInput = q(".delimiter_list input"),
                $delimiterCharsResetBtn = q(".delimiter_list button");

            // on user input in tab key setting
            $tabKeyInput.on("change", function () {
                Data.tabKey = this.checked;

                saveOtherData();
            });

            // on user input in tab key setting
            $ctxEnabledInput.on("change", function () {
                Data.ctxEnabled = this.checked;
                notifyCtxEnableToggle();
                saveOtherData();
            });

            $blockSitesTextarea.on("keydown", (event) => {
                if (event.keyCode === 13 && (event.ctrlKey || event.metaKey)) {
                    const URLs = $blockSitesTextarea.value.split("\n"),
                        len = URLs.length;
                    let i = 0,
                        URL,
                        sanitizedURL;

                    Data.blockedSites = []; // reset

                    for (; i < len; i++) {
                        URL = URLs[i].trim();
                        sanitizedURL = sanitizeSiteURLForBlock(URL);

                        if (sanitizedURL === false) {
                            return;
                        }
                        Data.blockedSites.push(sanitizedURL);
                    }

                    saveOtherData(listBlockedSites);
                }
            });

            function getAutoInsertPairFromSaveInput(node) {
                const $clickedTR = node.parentNode.parentNode;
                return $clickedTR.qCls("char_input").map(e => e.value);
            }

            function getAutoInsertPairFromRemoveInput(node) {
                const $clickedTR = node.parentNode;
                return (
                    $clickedTR
                        .Q("td")
                        // slice to exclude Remove button
                        .map(e => e.innerText)
                        .slice(0, 2)
                );
            }

            $autoInsertTable.on("click", (e) => {
                const node = e.target;

                if (node.tagName === "BUTTON") {
                    saveAutoInsert(getAutoInsertPairFromSaveInput(node));
                } else if (getHTML(node) === "Remove") {
                    removeAutoInsertChar(getAutoInsertPairFromRemoveInput(node));
                }
            });

            $snipMatchDelimitedWordInput.on("change", function () {
                const isChecked = this.checked;
                Data.matchDelimitedWord = isChecked;
                $snipNameDelimiterListDIV.toggleClass(SHOW_CLASS);
                saveOtherData();
            });

            function validateDelimiterList(stringList) {
                const len = RESERVED_DELIMITER_LIST.length;
                let i = 0,
                    reservedDelimiter;
                for (; i < len; i++) {
                    reservedDelimiter = RESERVED_DELIMITER_LIST.charAt(i);
                    if (stringList.match(escapeRegExp(reservedDelimiter))) {
                        return reservedDelimiter;
                    }
                }

                return true;
            }

            $delimiterCharsInput.on("keyup", function (e) {
                if (e.keyCode === 13) {
                    const vld = validateDelimiterList(this.value);
                    if (vld !== true) {
                        window.alert(
                            `Input list contains reserved delimiter "${vld}". Please remove it from the list. Thank you!`,
                        );
                        return true;
                    }
                    Data.snipNameDelimiterList = this.value;
                    saveOtherData();
                }

                return false;
            });

            function delimiterInit() {
                $delimiterCharsInput.value = Data.snipNameDelimiterList;
            }

            $delimiterCharsResetBtn.on("click", () => {
                if (
                    window.confirm(
                        "Are you sure you want to replace the current list with the default delimiter list?",
                    )
                ) {
                    Data.snipNameDelimiterList = SETTINGS_DEFAULTS.snipNameDelimiterList;
                    delimiterInit();
                    saveOtherData();
                }
            });

            delimiterInit();
        }());

        initSnippetWork();

        (function storageModeWork() {
            // boolean parameter transferData: dictates if one should transfer data or not
            function storageRadioBtnClick(str, transferData) {
                if (
                    !window.confirm(
                        `Migrate data to ${str} storage? It is VERY NECESSARY to take a BACKUP before proceeding.`,
                    )
                ) {
                    this.checked = false;
                    return;
                }

                getBytesInUse((bytesInUse) => {
                    if (getCurrentStorageType() === "local" && bytesInUse > MAX_SYNC_DATA_SIZE) {
                        window.alert(
                            `You are currently using ${bytesInUse} bytes of data; while sync storage only permits a maximum of ${MAX_SYNC_DATA_SIZE} bytes.\n\nPlease reduce the size of data (by deleting, editing, exporting snippets) you're using to migreate to sync storage successfully.`,
                        );
                    } else {
                        migrateData(transferData, (wasSuccessful) => {
                            if (wasSuccessful) {
                                window.alert(`Done! Data migrated to ${str} storage successfully!`);
                                window.location.reload();
                            } else {
                                window.alert(`It seems the target storage ${str} hasn't loaded yet.
In case of sync data, it may be because of Google sync not having finished yet.
Please wait at least five minutes and try again.`);
                                window.location.reload();
                            }
                        });
                    }
                });
            }

            // event delegation since radio buttons are
            // dynamically added
            qClsSingle("storageMode").on("click", function () {
                const input = this.q("input:checked");

                // make sure radio btn is clicked and is checked
                if (input) {
                    storageRadioBtnClick.call(
                        input,
                        input.dataset.storagetoset,
                        input.id !== "sync2",
                    );
                }
            });
        }());

        initBackup();

        // prevent exposure of locals
        (function hotKeyWork() {
            // resets hotkey btn to normal state
            function resetHotkeyBtn() {
                changeHotkeyBtn.html("Change hotkey").disabled = false;
            }

            /**
             * THE PROBLEM:
             * allowing keyups on both the control and the non control keys
             * resulted in the keyup event firing twice, when the keys were
             * released. Hence, if a control key is pressed (excluding enter),
             * exit the method. We only need to catch events on the other keys.
             * NOW:
             * we originally used keyups because keydown event fired multiple times
             * if key was held. but tracking keyup is difficult because of the above problem
             * as well as the fact that the output would be different if the user lifted the
             * shiftkey first or the space key first (when trying to set the hotkey to
             * Shift+Space)
             * Hence, we finally use this new solution.
             */

            let combo;

            // below code from https://stackoverflow.com/q/12467240
            // User shmiddty https://stackoverflow.com/u/1585400
            const nonControlKeyCodeRanges = [
                    [48, 57], // number keys
                    [65, 90], // letter keys
                    [96, 111], // numpad keys
                    [186, 192], // ;=,-./` (in order)
                    [219, 222], // [\]' (in order)
                    [32], // spacebar
                    [13], // return
                    [9], // tab
                ],
                arrayOfControlKeys = ["shiftKey", "altKey", "ctrlKey", "metaKey"];

            function isNonControlKey(keyCode) {
                return nonControlKeyCodeRanges.some((range) => {
                    if (range.length === 1) {
                        return keyCode === range[0];
                    }
                    return keyCode >= range[0] && keyCode <= range[1];
                });
            }

            function setHotkey(hotkey) {
                Data.hotKey = hotkey;

                saveOtherData(`Hotkey set to ${getCurrentHotkey()}`, () => {
                    window.location.href = "#settings";
                    window.location.reload();
                });
            }

            // tab key down can only be caught through window.document
            // event listener and none other :O
            window.document.on(
                "keydown",
                (event) => {
                    if (event.target !== hotkeyListener) {
                        return;
                    }
                    const { keyCode } = event,
                        valid = isNonControlKey(keyCode);

                    // escape to exit
                    if (keyCode === 9) {
                        event.preventDefault();
                        event.stopPropagation();
                        setHotkey([9]);
                    } else if (keyCode === 27) {
                        resetHotkeyBtn();
                    } else if (valid) {
                        setHotkey(combo.concat([keyCode]).slice(0));
                    } else {
                        arrayOfControlKeys.forEach((key) => {
                            if (event[key] && combo.indexOf(key) === -1) {
                                combo.unshift(key);
                            }
                        });
                    }
                },
                true,
            );

            changeHotkeyBtn.on("click", function () {
                this.html("Press new hotkeys").disabled = true; // disable the button

                hotkeyListener.focus();
                combo = [];

                // after five seconds, automatically reset the button to default
                setTimeout(resetHotkeyBtn, 5000);
            });
        }());
    }

    const local = "<b>Local</b> - storage only on one's own PC. More storage space than sync",
        localT = "<label for=\"local\"><input type=\"radio\" id=\"local\" data-storagetoset=\"local\"/><b>Local</b></label> - storage only on one's own PC locally. Safer than sync, and has more storage space. Note that on migration from sync to local, data stored on sync across all PCs would be deleted, and transfered into Local storage on this PC only.",
        sync1 = "<label for=\"sync\"><input type=\"radio\" id=\"sync\" data-storagetoset=\"sync\"/><b>Sync</b></label> - select if this is the first PC on which you are setting sync storage",
        sync2 = "<label for=\"sync2\"><input type=\"radio\" id=\"sync2\" data-storagetoset=\"sync\"/><b>Sync</b></label> - select if you have already set up sync storage on another PC and want that PCs data to be transferred here.",
        sync = "<b>Sync</b> - storage synced across all PCs. Offers less storage space compared to Local storage.";

    function onDBLoad(DataResponse) {
        if (!window[PRIMITIVES_EXT_KEY]) {
            updateAllValuesPerWin(window);
        }
        // needs to be set before database actions
        $panelSnippets = qClsSingle("panel_snippets");
        $containerSnippets = $panelSnippets.qClsSingle("panel_content");
        // initialized here; but used in snippet_classes.js
        $containerFolderPath = $panelSnippets.qClsSingle("folder_path");

        $snipMatchDelimitedWordInput = q(".snippet_match_whole_word input[type=checkbox]");
        $tabKeyInput = qId("tabKey");
        $ctxEnabledInput = qId("ctxEnable");
        $snipNameDelimiterListDIV = qClsSingle("delimiter_list");

        window.Data = DataResponse;
        Folder.makeFolderIfList(Data);
        Folder.setIndices();

        const propertiesChanged = ensureRobustCompat(Data);
        if (propertiesChanged) {
            // do not alert a useless "Saved!" message
            saveOtherData(false);
        }

        // on load; set checkbox state to user preference
        $tabKeyInput.checked = Data.tabKey;
        $ctxEnabledInput.checked = Data.ctxEnabled;
        $snipMatchDelimitedWordInput.checked = Data.matchDelimitedWord;

        if (Data.matchDelimitedWord) {
            $snipNameDelimiterListDIV.addClass(SHOW_CLASS);
        }

        $blockSitesTextarea = q(".blocked-sites textarea");
        listBlockedSites();

        $autoInsertTable = qClsSingle("auto_insert");
        listAutoInsertChars();

        autoInsertWrapSelectionInput = q("[name=\"wrapSelectionAutoInsert\"");
        autoInsertWrapSelectionInput.checked = Data.wrapSelectionAutoInsert;
        autoInsertWrapSelectionInput.on("click", () => {
            Data.wrapSelectionAutoInsert = autoInsertWrapSelectionInput.checked;
            saveOtherData();
        });

        omniboxSearchURLInput = q(".search-provider input");
        // localStorage shared with background page
        localStorage.omniboxSearchURL = omniboxSearchURLInput.value = Data.omniboxSearchURL;
        omniboxSearchURLInput.on("keydown", function (e) {
            if (e.keyCode === 13) {
                Data.omniboxSearchURL = this.value;
                saveOtherData();
            }
        });

        // store text for each div
        const textMap = {
                local: [local, `${sync1}<br>${sync2}`],
                sync: [sync, localT],
            },
            currArr = textMap[getCurrentStorageType()];

        q(".storageMode .current p").html(currArr[0]);
        q(".storageMode .transfer p").html(currArr[1]);

        // display current hotkey combo
        qClsSingle("hotkey_display").html(getCurrentHotkey());

        updateStorageAmount();

        // we need to set height of logo equal to width
        // but css can't detect height so we need js hack
        const logo = qClsSingle("logo");
        window.addEventListener(
            "resize",
            debounce(() => {
                logo.style.width = `${logo.clientHeight}px`;
                Folder.implementChevronInFolderPath();
            }, 300),
        );

        afterDBLoad();
    }

    function onWindowLoad() {
        DBget(onDBLoad);
    }

    window.addEventListener("load", onWindowLoad);
}());
