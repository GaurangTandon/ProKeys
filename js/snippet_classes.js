/* global q, chrome, pk */
/* global Folder, Data, Snip, Generic, saveSnippetData */
/* global Quill, $containerFolderPath, $containerSnippets, listOfSnippetCtxIDs */

/* this file is loaded both as a content script
    as well as a background page */

// TODO: added Folder.setIndices() to .remove and .insertAdjacent, hopefully it doesn't cause any issue :/

// functions common to Snip and Folder
window.Generic = function () {
    this.matchesUnique = function (name) {
        return this.name.toLowerCase() === name.toLowerCase();
    };

    this.matchesNameLazy = function (text) {
        return new RegExp(text, "i").test(this.name);
    };

    // CAUTION: used only by searchField (since `strippedBody` set)
    this.matchesLazy = function (text) {
        // searching is case-insensitive
        return new RegExp(text, "i").test(this.name + this.strippedBody);
    };

    // CAUTION: used only by searchField (since `strippedBody` set)
    this.matchesWord = function (text) {
        return new RegExp(`\\b${text}\\b`, "i").test(this.name + this.strippedBody);
    };

    // deletes `this` from parent folder
    this.remove = function () {
        const index = Data.snippets.getUniqueObjectIndex(this.name, this.type),
            thisIndex = index[index.length - 1];

        this.getParentFolder().list.splice(thisIndex, 1);
        Folder.setIndices();
    };

    this.getParentFolder = function () {
        let index = Data.snippets.getUniqueObjectIndex(this.name, this.type),
            parent = Data.snippets;

        // last element is `this` index, we want parent so -1
        for (let i = 0, lim = index.length - 1; i < lim; i++) {
            parent = parent.list[index[i]];
        }

        return parent;
    };

    this.moveTo = function (newFolder) {
        const x = this.getDuplicatedObject();
        this.remove();
        Folder.insertObject(x, newFolder);
        return x;
    };

    // a folder cannot be nested under its subfolders, hence a check
    this.canNestUnder = function (newFolder) {
        if (Folder.isFolder(this)) {
            while (newFolder.name !== Folder.MAIN_SNIPPETS_NAME) {
                if (this.name === newFolder.name) {
                    return false;
                }

                newFolder = newFolder.getParentFolder();
            }
        }

        // no need to check for snippets
        return true;
    };

    this.clone = function () {
        /**
         * Mechanism: if a folder X that has objects a, b, c is cloned
         * then new folder is X (1) with objects a (1), b (1), c (1)
         * @param {*} folder
         */
        function cloneIndividualSnippetsOfFolder(folder) {
            let i = 0,
                len = folder.list.length;

            for (; i < len; i++) {
                folder.list[i] = getClone(folder.list[i]);
            }
        }

        /**
         * secondary name to be assigned to a cloned object
         * that has a name like "name (1)"
         * @param {String} name : to use as primary name
         */
        function generateSecondaryName(name, type) {
            let counter = 0,
                found = true,
                newName;

            while (found) {
                newName = `${name} (${++counter})`;
                // we are only concerned whether the object exists
                // and NOT what its index is
                found = Data.snippets.getUniqueObjectIndex(newName, type);
            }

            return newName;
        }

        /**
         * Returns the clone of given object
         * @param {Generic} object to clone
         */
        function getClone(object) {
            let newName = generateSecondaryName(object.name, object.type),
                newObject;

            if (Folder.isFolder(object)) {
                newObject = new Folder(newName, object.list);
                cloneIndividualSnippetsOfFolder(newObject);
            } else {
                newObject = new Snip(newName, object.body);
            }

            return newObject;
        }

        function insertCloneOf(object) {
            const newObject = getClone(object),
                countersMatch = newObject.name.match(/\d+/g),
                counter = countersMatch[countersMatch.length - 1];

            object.insertAdjacent(newObject, counter);

            return newObject;
        }

        return insertCloneOf(this);
    };

    /**
     * @return {Generic} clone of this object
     * (if it is a folder, its snippets' names remain as they were)
     */
    this.getClone = function () {
        if (this.type === Generic.SNIP_TYPE) {
            return new Snip(this.name, this.body, this.timestamp);
        }

        const clonedFolder = new Folder(this.name, [], this.timestamp);
        this.list.forEach((object) => {
            clonedFolder.list.push(object.getClone());
        });

        return clonedFolder;
    };

    /**
     * inserts the given object stepValue places after/before this under the same parent folder list
     * to maintain sanity you should pass the clone of the object you're trying to insert
     * @param {Generic} newObject to be inserted at given position
     * @param {Number} stepValue how far after this to be inserted (default immediately next)
     */
    this.insertAdjacent = function (newObject, stepValue, insertBeforeFlag) {
        const thisName = this.name,
            thisType = this.type,
            thisIndexArray = Data.snippets.getUniqueObjectIndex(thisName, thisType),
            thisIndex = thisIndexArray[thisIndexArray.length - 1],
            parentFolderList = this.getParentFolder().list,
            posToInsertObject = thisIndex + (stepValue ? +stepValue : 1) * (insertBeforeFlag ? 0 : 1);

        parentFolderList.splice(posToInsertObject, 0, newObject);
        Folder.setIndices();
    };
};
/**
 * class added to newly created snip/folder
 * to highlight it
 */
Generic.HIGHLIGHTING_CLASS = "highlighting";
/**
 * returns the DOM element for edit and delete button
 */
Generic.getButtonsDOMElm = function () {
    const divButtons = q.new("div").addClass("buttons");
    divButtons.appendChild(q.new("div").addClass("clone_btn")).attr("title", "Clone");
    divButtons.appendChild(q.new("div").addClass("edit_btn")).attr("title", "Edit");
    divButtons.appendChild(q.new("div").addClass("delete_btn")).attr("title", "Delete");
    return divButtons;
};

Generic.getDOMElement = function (objectNamesToHighlight) {
    let divMain,
        divName,
        img;

    objectNamesToHighlight = objectNamesToHighlight === undefined
        ? []
        : !Array.isArray(objectNamesToHighlight)
            ? [objectNamesToHighlight]
            : objectNamesToHighlight;

    divMain = q.new("div").addClass([this.type, "generic", Snip.DOMContractedClass]);

    img = q.new("img");
    img.src = `../imgs/${this.type}.svg`;

    divMain.appendChild(img);

    // creating the short `div` element
    divName = q.new("div");
    // text with newlines does not fit in one line
    divName.text(this.name).addClass("name");
    divMain.appendChild(divName);

    divMain.appendChild(Generic.getButtonsDOMElm());

    if (objectNamesToHighlight.indexOf(this.name) > -1) {
        if (objectNamesToHighlight[0] !== false) {
            divMain.removeClass(Snip.DOMContractedClass);
        }

        // highlight so the user may notice it #ux
        // remove class after 3 seconds else it will
        // highlight repeatedly
        divMain.addClass(Generic.HIGHLIGHTING_CLASS);
        setTimeout(() => {
            divMain.removeClass(Generic.HIGHLIGHTING_CLASS);
        }, 3000);
    }

    return divMain;
};

// when we attach click handler to div.snip/.folder
// .buttons div click handlers get overrided
Generic.preventButtonClickOverride = function (handler) {
    return function (e) {
        if (!e.target.matches(".buttons, .buttons div")) {
            handler.call(this, e);
        }
    };
};

Generic.getDuplicateObjectsText = function (text, type) {
    return `A ${type} with name '${text}' already exists (possibly with the same letters in upper/lower case.)`;
};

Generic.isValidName = function (name, type) {
    return name.length === 0
        ? "Empty name field"
        : name.length > pk.OBJECT_NAME_LIMIT
            ? `Name cannot be greater than ${
                pk.OBJECT_NAME_LIMIT
            } characters. Current name has ${name.length - pk.OBJECT_NAME_LIMIT} more characters.`
            : Data.snippets.getUniqueObject(name, type)
                ? Generic.getDuplicateObjectsText(name, type)
                : "true";
};

/**
 * it returns the snip/folder object associated with the listElm
 * @param: listElm: The DOM element .snip or .folder, whose buttons or anything are clicked
 */
Generic.getObjectThroughDOMListElm = function (listElm) {
    const isSnip = listElm.classList.contains("snip"),
        type = isSnip ? Generic.SNIP_TYPE : Generic.FOLDER_TYPE,
        name = listElm.qClsSingle("name").innerHTML;

    return Data.snippets.getUniqueObject(name, type);
};

Generic.FOLDER_TYPE = "folder";
Generic.SNIP_TYPE = "snip";
Generic.CTX_START = {};
Generic.CTX_START[Generic.SNIP_TYPE] = `${Generic.SNIP_TYPE}_`;
Generic.CTX_START[Generic.FOLDER_TYPE] = `${Generic.FOLDER_TYPE}_`;
Generic.CTX_SNIP_REGEX = new RegExp(Generic.CTX_START[Generic.SNIP_TYPE]);

window.Snip = function (name, body, timestamp) {
    this.name = name;
    this.body = body;
    this.timestamp = timestamp || Date.now();
    this.type = Generic.SNIP_TYPE;

    this.edit = function (newName, newBody) {
        this.name = newName;
        this.body = newBody;
    };

    // "index" is index of this snip in Data.snippets
    this.getDOMElement = function (objectNamesToHighlight) {
        const divMain = Generic.getDOMElement.call(this, objectNamesToHighlight),
            divName = divMain.qClsSingle("name"),
            // our `div` body element; with Snip body
            divBody = q.new("div").addClass("body");

        function makeSuitableCollapsedDisplay(bodyText) {
            const replacer = " ";

            return bodyText
                .substring(0, Snip.MAX_COLLAPSED_CHARACTERS_DISPLAYED)
                .replace(/\n|<br>/g, replacer)
                .replace(/(<\/[a-z]+>)/gi, `$1${replacer}`);
        }

        function toggleDivBodyText(snip) {
            if (divMain.hasClass(Snip.DOMContractedClass)) {
                // snip.body contains HTML tags/or \n as well
                // insert a space whenever line break or closing tag occurs
                // so (1) set the html, (2) grab and set the text back
                divBody.html(makeSuitableCollapsedDisplay(snip.body));
                divBody.text(divBody.text());

                // during this call is going on, divName has't been shown on screen yet
                // so clientWidth returns zero, hence, wait for a short duration before
                // setting style.width
                setTimeout(() => {
                    divBody.style.width = `calc(100% - 100px - ${divName.clientWidth}px)`;
                }, 1);
            } else {
                divBody.html(snip.body, "", true).style.width = "";
            }
        }

        // if we set divMain.click, then .body gets clicked
        // even when user is selecting text in it
        // hence we should put a selectable but transparent
        // element at the top
        function getClickableElm() {
            return q
                .new("div")
                .addClass("clickable")
                .on(
                    "click",
                    Generic.preventButtonClickOverride(() => {
                        divMain.toggleClass(Snip.DOMContractedClass);
                        toggleDivBodyText(this);
                    }),
                );
        }

        toggleDivBodyText(this);
        divMain.appendChild(divBody);

        divMain.appendChild(getClickableElm.call(this));

        const timestampElm = q
            .new("div")
            .addClass("timestamp")
            .html(Snip.getTimestampString(this));
        divMain.appendChild(timestampElm);

        return divMain;
    };

    this.getDuplicatedObject = function () {
        return new Snip(this.name, this.body, this.timestamp);
    };

    // returns object representation of this Snip object
    this.toArray = function () {
        return {
            name: this.name,
            body: this.body,
            timestamp: this.timestamp,
        };
    };

    this.formatMacros = function (callback) {
        const embeddedSnippetsList = [this.name],
            // optimization for more than one embeds of the same snippet
            embeddingResultsCached = {};

        function embedSnippets(snipBody) {
            return snipBody.replace(/\[\[%s\((.*?)\)\]\]/g, (wholeMatch, snipName) => {
                // to avoid circular referencing
                if (embeddedSnippetsList.indexOf(snipName) > -1) {
                    return wholeMatch;
                }

                const matchedSnip = Data.snippets.getUniqueSnip(snipName),
                    matchedSnipName = matchedSnip && matchedSnip.name;

                if (matchedSnip) {
                    embeddedSnippetsList.push(matchedSnipName);
                    if (embeddingResultsCached[matchedSnipName]) {
                        return embeddingResultsCached[matchedSnipName];
                    }
                    embeddingResultsCached[matchedSnipName] = embedSnippets(matchedSnip.body);
                    return embeddingResultsCached[matchedSnipName];
                }
                return wholeMatch;
            });
        }

        const MAX_LENGTH = 100;

        function getListTillN(string, delimiter, length, startReplacement) {
            string = string.replace(new RegExp(`^\\${startReplacement}`), "");

            const array = string.split(new RegExp(`\\${delimiter}`, "g")),
                usefulArray = array.slice(0, length),
                output = usefulArray.join(delimiter);

            return output ? startReplacement + output : "";
        }

        function getExactlyNthItem(string, delimiter, index, startReplacement) {
            return string.replace(new RegExp(`^\\${startReplacement}`), "").split(delimiter)[
                index - 1
            ];
        }

        // snippet embedding shuold be performed first, so that if the newly embedded
        // snippet body has some macros, they would be evaluated in the below replacements
        let snipBody = embedSnippets(this.body);

        // Date/Time macro replacement
        // sameTimeFlag: indicates whether all calculations will be dependent (true)
        // on each other or independent (false) of each other
        snipBody = snipBody.replace(
            /\[\[%d\((!?)(.*?)\)\]\]/g,
            (wholeMatch, sameTimeFlag, userInputMacroText) => {
                let macro,
                    macroRegex,
                    macroRegexString,
                    elm,
                    macroFunc,
                    dateArithmeticChange,
                    date = new Date(),
                    operableDate,
                    // `text` was earlier modifying itself
                    // due to this, numbers which became shown after
                    // replacement got involved in dateTime arithmetic
                    // to avoid it; we take a substitute
                    replacedOutput = userInputMacroText;

                sameTimeFlag = !!sameTimeFlag;

                // operate on text (it is the one inside brackets of %d)
                for (let i = 0, len = Snip.MACROS.length; i < len; i++) {
                    // macros has regex-function pairs
                    macro = Snip.MACROS[i];
                    [macroRegexString, elm] = macro;
                    macroRegex = new RegExp(macroRegexString, "g");
                    [macroFunc, dateArithmeticChange] = elm;

                    userInputMacroText.replace(macroRegex, (match, dateArithmeticMatch) => {
                        let timeChange = 0;

                        if (dateArithmeticMatch) {
                            dateArithmeticMatch = parseInt(dateArithmeticMatch, 10);

                            // if the macro is a month, we need to account for the deviation days being changed
                            if (/M/.test(macroRegexString)) {
                                timeChange
                                    += Date.getTotalDeviationFrom30DaysMonth(dateArithmeticMatch)
                                    * Date.MILLISECONDS_IN_A_DAY;
                            }

                            timeChange += dateArithmeticChange * dateArithmeticMatch;
                        } else {
                            macroRegexString = macroRegexString
                                .replace(/[^a-zA-Z\\\/]/g, "")
                                .replace("\\d", "");
                        }

                        if (sameTimeFlag) {
                            date.setTime(date.getTime() + timeChange);
                        }

                        operableDate = sameTimeFlag ? date : new Date(Date.now() + timeChange);

                        replacedOutput = replacedOutput.replace(
                            new RegExp(macroRegexString),
                            macroFunc(operableDate),
                        );
                    });
                }

                return replacedOutput;
            },
        );

        // browser URL macros
        snipBody = snipBody.replace(/\[\[%u\((.*?)\)\]\]/g, (wholeMatch, query) => {
            let output = "",
                pathLength = query.match(/(q?)\d+/),
                searchParamLength = query.match(/q(\d+)/);

            pathLength = !pathLength ? MAX_LENGTH : pathLength[1] ? 0 : +pathLength[0];
            searchParamLength = !searchParamLength
                ? 0
                : !searchParamLength[1]
                    ? MAX_LENGTH
                    : +searchParamLength[1];

            if (/p/i.test(query)) {
                output += `${window.location.protocol}//`;
            }
            if (/w/i.test(query)) {
                output += "www.";
            }

            output += window.location.host;

            output += getListTillN(window.location.pathname, "/", pathLength, "/");

            output += getListTillN(window.location.search, "&", searchParamLength, "?");

            if (/h/i.test(query)) {
                output += window.location.hash;
            }

            return output;
        });

        snipBody = snipBody.replace(/\[\[%u\{(\w|\d+|q\d+)\}\]\]/g, (wholeMatch, query) => {
            let hash;

            if (Number.isInteger(+query)) {
                return getExactlyNthItem(window.location.pathname, "/", +query, "/");
            }
            if (query === "p") {
                return window.location.protocol.replace(/:$/, "");
            }
            if (query === "w") {
                return "www";
            }
            if (query === "h") {
                ({ hash } = window.location);
                return (hash && hash.substring(1)) || "";
            }
            if (query[0] === "q") {
                return getExactlyNthItem(window.location.search, "&", +query.substring(1), "?");
            }

            return "";
        });

        if (Snip.PASTE_MACRO_REGEX.test(snipBody)) {
            chrome.runtime.sendMessage("givePasteData", (pasteData) => {
                pk.checkRuntimeError("givePasteData")();
                callback(snipBody.replace(Snip.PASTE_MACRO_REGEX, pasteData));
            });
        } else {
            callback(snipBody);
        }
    };
};
Snip.prototype = new Generic();
Snip.MAX_COLLAPSED_CHARACTERS_DISPLAYED = 200; // issues#67
Snip.DOMContractedClass = "contracted"; // to show with ellipsis
Snip.PASTE_MACRO_REGEX = /\[\[%p\]\]/gi;
Snip.CARET_POSITION_CLASS = "caretPlacement";
Snip.CARET_POSITION_EMPTY_REGEX = /\[\[%c(\(\))?\]\]/;
Snip.CARET_POSITION_STUFFED_REGEX = /\[\[%c\([v^<>\d]+\)\]\]/;
Snip.CARET_POSITION_SELECTION_START_REGEX = /\[\[%c\(s\)\]\]/;
Snip.CARET_POSITION_SELECTION_END_REGEX = /\[\[%c\(e\)\]\]/;
Snip.CARET_POSITION_SELECTION_END_STRING = "[[%c(e)]]";
Snip.MACROS = [
    [
        "\\bs([+-]\\d+)?\\b",
        [
            function (date) {
                return Number.padNumber(date.getSeconds());
            },
            1000,
        ],
    ],
    [
        "\\bm([+-]\\d+)?\\b",
        [
            function (date) {
                return Number.padNumber(date.getMinutes());
            },
            60000,
        ],
    ],
    [
        "\\bhh([+-]\\d+)?\\b",
        [
            function (date) {
                return Number.padNumber(date.getHours());
            },
            3600000,
        ],
    ],
    [
        "\\bh([+-]\\d+)?\\b",
        [
            function (date) {
                return Number.padNumber(Date.to12Hrs(date.getHours())[0]);
            },
            3600000,
        ],
    ],
    [
        "\\ba\\b",
        [
            function (date) {
                return Date.to12Hrs(date.getHours())[1];
            },
            Date.MILLISECONDS_IN_A_DAY,
        ],
    ],
    [
        "\\bDo([+-]\\d+)?\\b",
        [
            function (date) {
                return Date.formatDate(date.getDate());
            },
            Date.MILLISECONDS_IN_A_DAY,
        ],
    ],
    [
        "\\bD([+-]\\d+)?\\b",
        [
            function (date) {
                return Number.padNumber(date.getDate());
            },
            Date.MILLISECONDS_IN_A_DAY,
        ],
    ],
    [
        "\\bdddd([+-]\\d+)?\\b",
        [
            function (date) {
                return Date.parseDay(date.getDay(), "full");
            },
            Date.MILLISECONDS_IN_A_DAY,
        ],
    ],
    [
        "\\bddd([+-]\\d+)?\\b",
        [
            function (date) {
                return Date.parseDay(date.getDay(), "half");
            },
            Date.MILLISECONDS_IN_A_DAY,
        ],
    ],
    [
        "\\bMMMM([+-]\\d+)?\\b",
        [
            function (date) {
                return Date.parseMonth(date.getMonth(), "full");
            },
            Date.MILLISECONDS_IN_A_DAY * 30,
        ],
    ],
    [
        "\\bMMM([+-]\\d+)?\\b",
        [
            function (date) {
                return Date.parseMonth(date.getMonth(), "half");
            },
            Date.MILLISECONDS_IN_A_DAY * 30,
        ],
    ],
    [
        "\\bMM([+-]\\d+)?\\b",
        [
            function (date) {
                return Number.padNumber(date.getMonth() + 1);
            },
            Date.MILLISECONDS_IN_A_DAY * 30,
        ],
    ],
    [
        "\\bYYYY([+-]\\d+)?\\b",
        [
            function (date) {
                return date.getFullYear();
            },
            Date.MILLISECONDS_IN_A_DAY * 365,
        ],
    ],
    [
        "\\bYY([+-]\\d+)?\\b",
        [
            function (date) {
                return date.getFullYear() % 100;
            },
            Date.MILLISECONDS_IN_A_DAY * 365,
        ],
    ],
    [
        "\\bZZ\\b",
        [
            function (date) {
                return date.toString().match(/\((.*)\)/)[1];
            },
            0,
        ],
    ],
    [
        "\\bZ\\b",
        [
            function (date) {
                return date
                    .toString()
                    .match(/\((.*)\)/)[1]
                    .split(" ")
                    .reduce((a, b) => a + b[0], "");
            },
            0,
        ],
    ],
    [
        "\\bz\\b",
        [
            function (date) {
                return date.toString().match(/GMT(.*?) /)[1];
            },
            0,
        ],
    ],
    [
        "\\bJ\\b",
        [
            function (date) {
                return date.getDayOfYear();
            },
            0,
        ],
    ],
    ["\\bdate\\b", [Date.getFormattedDate, 0]],
    ["\\btime\\b", [Date.getCurrentTimestamp, 0]],
];
Snip.fromObject = function (snip) {
    const nSnip = new Snip(snip.name, snip.body);

    // remove "Created on " part from timestamp
    nSnip.timestamp = !snip.timestamp
        ? Date.now() // can be undefined
        : typeof snip.timestamp === "number"
            ? snip.timestamp
            : Date.parse(snip.timestamp.substring(11));

    return nSnip;
};
Snip.isValidName = function (name) {
    const vld = Generic.isValidName(name, Generic.SNIP_TYPE);

    return /^%.+%$/.test(name) ? "Name cannot be of the form '%abc%'" : vld;
};
Snip.isValidBody = function (body) {
    return body.length ? "true" : "Empty body field";
};
Snip.getTimestampString = function (snip) {
    return `Created on ${Date.getFormattedDate(snip.timestamp)}`;
};
/*
1. removes and replaces the spammy p nodes with \n
2. leaves pre, blockquote, u, etc. as it is (since they're useful in markdown)
3. replaces br element with \n
*/
Snip.makeHTMLSuitableForTextareaThroughString = function (html) {
    const htmlNode = q.new("DIV");
    function preProcessTopLevelElement(tle) {
        let tgN = tle.tagName,
            replaced;

        switch (tgN) {
        case "PRE":
        case "BLOCKQUOTE":
        case "P":
            break;
        case "OL":
        case "UL":
            Snip.formatOLULInListParentForCEnode(tle);
            break;
            // these top-level elements are inserted by user
        default:
            replaced = q.new("P");
            // issues#156
            if (tgN === "A") {
                tle.href = Snip.defaultLinkSanitize(tle.href);
            }

            replaced.innerHTML = tle.outerHTML;
            htmlNode.replaceChild(replaced, tle);
        }
    }
    function preProcessTopLevelElements() {
        // top-level elements can only be p, pre, blockquote, ul, ol
        // which `makeHTMLSuitableForTextarea` expects
        // our top-level elements might be textnodes or <a> elements
        let children = htmlNode.childNodes,
            child,
            childText,
            replaced;

        for (let i = 0, len = children.length; i < len; i++) {
            child = children[i];

            if (child.nodeType !== 3) {
                preProcessTopLevelElement(child);
                continue;
            }

            // deal with textnodes here
            // presence of ONE newline is automated by the presence of
            // separate top-level elements
            childText = child.textContent.replace(/\n/, "").replace(/\n/, "<br>");
            replaced = q.new("P").html(child.textContent);

            if (childText.length !== 0) {
                htmlNode.replaceChild(replaced, child);
            } else {
                htmlNode.removeChild(child);
                len--;
                i--;
            }
        }
    }

    htmlNode.innerHTML = html;

    if (Snip.isSuitableForPastingInTextareaAsIs(html)) {
        htmlNode.Q("ol, ul").forEach(Snip.formatOLULInListParentForTextarea);

        return htmlNode.innerHTML;
    }
    preProcessTopLevelElements();

    return Snip.makeHTMLSuitableForTextarea(htmlNode);
};
Snip.makeHTMLSuitableForTextarea = function (htmlNode) {
    const DELETE_NEWLINE_SYMBOL = "<!!>";

    function getProperTagPair(elm) {
        const tag = elm.tagName.toLowerCase(),
            returnArray = [`<${tag}>`, `</${tag}>`];

        if (tag === "a") {
            returnArray[0] = `<a href='${elm.href}'>`;
        }

        // span is used for font family, sizes, color
        // and is therefore not shown
        return tag !== "span" ? returnArray : ["", ""];
    }

    // sanitizes elements (starting from top-level and then recursize)
    function elementSanitize(node) {
        /*
        WORKING of container:
        Consecutive structures like this can be achieved:
        <strong><em><s><u>aati</u></s></em></strong>
        -----
        A <p> element can at max contain the following:
        1. text nodes
        2. strong,em,u,strike,sub,sup elm nodes
        3. span elements with classes for size, font, color
        -----
        Alignment classes are applied on the <p> element only
        */

        if (pk.isTextNode(node)) {
            // if textnode already contains ONE NEWLINE,
            // then remove it as caller is going to add one
            return node.textContent;
        }

        let { tagName } = node,
            resultString = "",
            elm,
            tags,
            children = node.childNodes, // returns [] for no nodes
            i = 0,
            childrenCount = children.length,
            content,
            firstChild,
            firstChildText;

        if (tagName === "PRE") {
            // can't use outerHTML since it includes atributes
            // (like spellcheck=false)
            tags = getProperTagPair(node);
            return tags[0] + node.innerHTML + tags[1];
        }

        if (tagName === "P" && childrenCount === 1) {
            firstChild = children[0];
            firstChildText = firstChild.innerText || firstChild.textContent;

            if (firstChild.tagName === "BR") {
                return "";
            }
            // issues#55
            if (firstChildText.length === 0) {
                return "";
            }
        }

        for (; i < childrenCount; i++) {
            elm = children[i];

            if (elm.nodeType == 1) {
                tags = getProperTagPair(elm);

                content = tags[0] + elementSanitize(elm) + tags[1];

                if (elm.tagName === "LI") {
                    resultString += `    ${content}\n`;
                } else {
                    resultString += content;
                }
            } else {
                resultString += elm.textContent;
            }
        }

        switch (tagName) {
        case "BLOCKQUOTE":
            return `<blockquote>${resultString}</blockquote>`;
        case "OL":
            return `<ol>\n${resultString}</ol>`;
        case "UL":
            return `<ul>\n${resultString}</ul>`;
        default:
            return resultString;
        }
    }

    let children = htmlNode.childNodes,
        finalString = "",
        /*
            the container consists of top-level elements - p, pre, blockquote, ul, ol (more?)
            hence, we keep looping while there exist top-level children of container
            at each iteration, we understand that it is a new line so add the html content
            of the top-level htmlNode (after a pElementSanitization) along with a `\n`
            -----
            single new line is represented by beginning of a new `p`, pre, bq element
            -----
            in this editor, mutliple consecutive new lines are done as:
            <p><br></p>
            <p><br></p>
            <p><br></p>
            each sanitize calls returns "" since br has no childnodes and after each call
            a "\n" is appended by this method
            -----
            inside pre element, absolutely NO formatting is allowed. hence, it is copied as it is.
            */

        len = children.length,
        i = 0,
        elm,
        sanitizedText;

    while (i < len) {
        elm = children[i];
        sanitizedText = elementSanitize(elm);
        finalString += sanitizedText === DELETE_NEWLINE_SYMBOL ? "" : `${sanitizedText}\n`;
        i++;
    }

    finalString = finalString.replace(/&nbsp;/g, " ");
    // quilljs auto inserts a \n in the end; remove it
    finalString = finalString.substring(0, finalString.length - 1);
    return finalString;
};
/**
 * replaces all the "ql-size-huge" types of classes with
 * proper tags that render as expected in external websites
 */
Snip.makeHTMLValidForExternalEmbed = function (html, isListingSnippets) {
    const $container = q.new("div");

    let cls,
        elms;

    // when both class name and property value share diff text
    // as in font size
    function replacer(cls, prop, val) {
        elms = $container.qCls(cls);

        if (elms.length) {
            elms.removeClass(cls);
            elms.forEach((elm) => {
                elm.style[prop] = val;
            });
        }
    }

    // when both class name and property value share same text
    // as in align and font family
    function replacerThroughArray(clsList, clsPrefix, prop) {
        for (let i = 0, len = clsList.length; i < len; i++) {
            replacer(clsPrefix + clsList[i], prop, clsList[i]);
        }
    }

    // only called when NOT listing snippets
    function processPElm(pElm) {
        let content;
        // replace pElm with its text node and inline elements
        // and insert a br in the end
        // but don't do it if it's an alignment class
        if (!/text-align:/.test(pElm.attr("style"))) {
            content = pElm.innerHTML;
            // <p>Hi</p> becomes Hi<br> (insert <br> only in this case)
            // <p><br></p> becomes <br>
            // <p>Hi</p> if is last child remains "Hi"
            // <p><br></p> if is last child remains <br>
            if (content !== "<br>" && !(pElm === $container.lastChild)) {
                content += "<br>";
            }

            pElm.outerHTML = content;
        }
    }
    /* DETAILS:
            it should remove the given class names and
            add corresponding style rule
        1. .ql-size-(small|huge|large) to style="font-size: 0.75|1.5|2.5em"
        2. .ql-font-(monospace|serif) to style="font-family: monospace|serif"
        3. .ql-align-(justify|center|right) to style="text-align: (same)"
        4. existing 'style="color/background-color: rgb(...);"' remains as is

        Note that these classes aren't necessarily on span elms
        they might also be present on sub/sup/etc.
        */

    // messy area; don't use built-in .html() here
    $container.innerHTML = html;
    const fontSizesEm = { small: 0.75, large: 1.5, huge: 2.5 },
        fontFamilies = ["monospace", "serif"],
        textAligns = ["justify", "center", "right"];

    // problem5 issues#153
    // remove <p> tags when this method is called by
    // detector.js; don't remove them when
    if (!isListingSnippets) {
        $container.Q("p").forEach(processPElm);
    }

    // 1. font size
    for (const fontSize in Object.keys(fontSizesEm)) {
        cls = `ql-size-${fontSize}`;
        replacer(cls, "font-size", `${fontSizesEm[fontSize]}em`);
    }

    // others
    replacerThroughArray(fontFamilies, "ql-font-", "font-family");
    replacerThroughArray(textAligns, "ql-align-", "text-align");

    $container.Q("ol, ul").forEach(Snip.formatOLULInListParentForCEnode);

    // access by window to get `undefined` and not any error
    // problem 9 issues#153
    if (window.isGmail) {
        $container
            .Q("blockquote")
            .addClass("gmail_quote")
            .attr(
                "style",
                "margin: 0px 0px 0px 0.8ex; border-left: 1px solid rgb(204, 204, 204); padding-left: 1ex;",
            );
    }

    // issues#161
    const DEFAULT_EMPTY_QUILL_TEXT = "<p><br></p>";
    html = $container.innerHTML;
    if (html === DEFAULT_EMPTY_QUILL_TEXT) {
        return "";
    }

    return html;
};

/**
 * replace `style`s of font-size, font-family earlier obtained
 * from `Snip.makeHTMLValidForExternalEmbed` into
 * required quill classes
 * WHY? since Quill editor collapses unrecognized span elements
 * (which we were using to insert font size, family)
 * NOTE: alignment set on `p` elements = unaffected
 */
Snip.makeHTMLSuitableForQuill = function (html) {
    const $container = q.new("DIV");

    function replacer(sel, prop, cls, val) {
        const elms = $container.Q(sel);

        if (elms) {
            elms.forEach((e) => {
                e.style[prop] = "";
                e.addClass(`ql-${cls}-${val}`);
            });
        }
    }

    function replacerThroughArray(values, prop) {
        for (let i = 0, len = values.length; i < len; i++) {
            replacer(`span[style*="${prop}: ${values[i]}"]`, prop, "font", values[i]);
        }
    }

    // problem6 issues#153
    // substitute <br> for <p><br></p>
    function replaceTrailingBRsWithPElms() {
        let lastBR = $container.lastChild,
            $pContainer;
        while (lastBR && lastBR.tagName === "BR") {
            $pContainer = q.new("P");
            $pContainer.innerHTML = "<br>";
            $container.replaceChild($pContainer, lastBR);
            lastBR = $pContainer.previousElementSibling;
        }
    }

    $container.innerHTML = html;

    const fontSizesEm = { "0.75em": "small", "1.5em": "large", "2.5em": "huge" },
        fontFamilies = ["monospace", "serif"];

    for (const fontSize in fontSizesEm) {
        if (fontSizesEm.hasOwnProperty(fontSize)) {
            replacer(
                `[style*="font-size: ${fontSize}"]`,
                "font-size",
                "size",
                fontSizesEm[fontSize],
            );
        }
    }

    replacerThroughArray(fontFamilies, "font-family");
    replaceTrailingBRsWithPElms();

    return $container.innerHTML;
};
Snip.isSuitableForPastingInTextareaAsIs = function (html) {
    return !(
        Snip.hasFormattedLossyContentWoQuillCls(html)
        // imported snippet body might have no fonts but lots of paragraphs
        // which make it unsuitable for a textarea
        || /<p>|<br>/.test(html)
    );
};
Snip.hasFormattedLossyContentWoQuillCls = function (html) {
    const regElms = [
        /background-color: /,
        /color: /,
        /text-align: /,
        /font-size: /,
        /font-family: /,
    ];

    for (let i = 0, len = regElms.length; i < len; i++) {
        if (regElms[i].test(html)) {
            return true;
        }
    }

    return false;
};
Snip.getQuillClsForFormattedLossyContent = function (html) {
    const reqElms = [
        [/ql-font/, "font"],
        [/ql-align/, "alignment"],
        [/ql-size/, "size"],
        [/color: /, "color"],
        [/background-color: /, "background color"],
    ];

    for (let i = 0, len = reqElms.length; i < len; i++) {
        if (reqElms[i][0].test(html)) {
            return reqElms[i][1];
        }
    }

    return null;
};
Snip.stripAllTags = function (html, $refDiv) {
    if (!$refDiv) {
        $refDiv = q.new("DIV");
    }
    if (html) {
        $refDiv.innerHTML = html;
    }
    // otherwise that elm's html is already set (nested calls)

    const { tagName } = $refDiv;

    switch (tagName) {
    case "DIV": // when not a recursive call
    case "OL":
    case "UL":
        break;
        // for all other elements
    default:
        return $refDiv.innerText || $refDiv.textContent;
    }

    const children = $refDiv.childNodes,
        len = children.length;
    let result = "",
        i = 0;
    if (len === 0) {
        return $refDiv.innerText || $refDiv.textContent;
    }

    for (; i < len; i++) {
        result += `${Snip.stripAllTags("", children[i])}\n`;
    }

    return result;
};
Snip.defaultLinkSanitize = function (linkVal) {
    // remove the default extension protocol just in case it was
    // prepended by Chrome
    linkVal = linkVal.replace(/^chrome-extension:\/\/[a-z]+\/html\//, "");

    // do nothing, since this implies user's already using a custom protocol
    if (/^\w+:/.test(linkVal)) {
    } else if (!/^https?:/.test(linkVal)) {
        // TODO: why's this semicolon unnecessary
        linkVal = `http:${linkVal}`;
    }

    return linkVal;
};
/**
 * add indents to `<li>`s; it is NOT innerHTML;
 * content is obtained through regex
 */
(function () {
    function genericFormatterCreator(sep0, sep1) {
        return function (listParent) {
            let resultString = sep1;

            listParent.Q("li").forEach((li) => {
                resultString += `${sep0}<li>${li.innerHTML}</li>${sep1}`;
            });

            listParent.innerHTML = resultString;
        };
    }

    Snip.formatOLULInListParentForTextarea = genericFormatterCreator("    ", "\n");

    // CE node does not have indentation otherwise
    // &nbsp; will occupy the place and mess up display
    Snip.formatOLULInListParentForCEnode = genericFormatterCreator("", "");
}());

/*
  main motto here is to leave the text "as is"
  albeit with some necessary modifications
1. sanitize links
2. remove spaces between consecutive <li>s as they're
    converted into &nbsp; by setHTML
*/
Snip.sanitizeTextareaTextForSave = function (text) {
    const htmlNode = q.new("div");
    htmlNode.innerHTML = text;
    // textarea text does not have ANY &nbsp; but adding innerHTML
    // inserts &nbsp; for some unknown reason
    // refer problem4 issue#153
    htmlNode.innerHTML = htmlNode.innerHTML.replace(/&nbsp;/g, " ");

    const aHREFs = htmlNode.Q("a");
    aHREFs.forEach((a) => {
        a.href = Snip.defaultLinkSanitize(a.href);
    });

    const listParents = htmlNode.Q("ol, ul");
    listParents.forEach(Snip.formatOLULInListParentForTextarea);

    return htmlNode.innerHTML;
};
Snip.validate = function (arr, parentFolder, index) {
    let correctProps = ["name", "body", "timestamp"],
        expectedPropsLength = correctProps.length,
        checks = {
            body: Snip.isValidBody,
            name: Snip.isValidName,
        },
        propVal,
        checkFunc,
        propCounter,
        snippetVld,
        snippetUnderFolderString = `${index}th snippet under folder ${parentFolder}`;

    if (Array.isArray(arr)) {
        if ((snippetVld = Folder.validate(arr)) !== "true") {
            return snippetVld;
        }
    } else if (!pk.isObject(arr)) {
        return `${snippetUnderFolderString} is not an object.`;
    } else {
        propCounter = 0;

        // check whether this item has all required properties
        for (const prop in arr) {
            if (!arr.hasOwnProperty(prop)) {
                continue;
            }

            // if invalid property or not of string type
            if (correctProps.indexOf(prop) === -1) {
                delete arr[prop];
                continue;
            } else {
                propCounter++;
            }

            propVal = arr[prop];
            checkFunc = checks[prop];

            if (
                checkFunc
                && (snippetVld = checkFunc(propVal)) !== "true"
                && Generic.getDuplicateObjectsText(propVal, Generic.SNIP_TYPE) !== snippetVld
            ) {
                return `Invalid value for property ${prop} in ${snippetUnderFolderString}; received error: ${snippetVld}`;
            }
        }

        if (propCounter !== expectedPropsLength) {
            return `${snippetUnderFolderString} is missing one of the properties: ${JSON.stringify(
                correctProps,
            )}`;
        }
    }

    return "true";
};
window.Folder = function (name, list, timestamp, isSearchResultFolder) {
    this.name = name;
    this.type = Generic.FOLDER_TYPE;
    this.timestamp = timestamp || Date.now();
    this.list = (list || []).slice(0);
    this.isSearchResultFolder = !!isSearchResultFolder;

    // only options page mutates list
    if (window.IN_OPTIONS_PAGE) {
        observeList(this.list);
    }

    function getObjectCount(type) {
        return function () {
            return this.list.reduce(
                (count, object) => (object.type === type ? count + 1 : count),
                0,
            );
        };
    }

    this.getSnippetCount = getObjectCount(Generic.SNIP_TYPE);
    this.getFolderCount = getObjectCount(Generic.FOLDER_TYPE);

    this.getLastFolderIndex = function () {
        let i = 0,
            len = this.list.length;

        while (i < len && Folder.isFolder(this.list[i])) {
            i++;
        }

        return i - 1;
    };

    function adder(isSnippet) {
        /**
         * body is actually .list in case of folder
         */
        return function (name, body, timestamp) {
            let folderName = this.name,
                newObj;

            newObj = isSnippet
                ? new Snip(name, body, timestamp)
                : new Folder(name, body, timestamp);

            Folder.insertObject(newObj, this);

            latestRevisionLabel = `created ${newObj.type} "${newObj.name}"`;

            saveSnippetData(undefined, folderName, newObj.name);
        };
    }

    this.addSnip = adder(true);

    function editer(type) {
        return function (oldName, newName, body) {
            const object = Data.snippets.getUniqueObject(oldName, type),
                parent = object.getParentFolder();

            object.edit(newName, body);
            latestRevisionLabel = `edited ${type} "${oldName}"`;

            saveSnippetData(undefined, parent.name, newName);
        };
    }

    this.editSnip = editer(Generic.SNIP_TYPE);

    this.addFolder = adder(false);

    this.editFolder = editer(Generic.FOLDER_TYPE);

    this.edit = function (newName) {
        this.name = newName;
    };

    this.getDOMElement = function (objectNamesToHighlight) {
        // get prepared divMain from Generic class
        // and add click handler to the divMain and then return it
        return Generic.getDOMElement
            .call(this, objectNamesToHighlight)
            .on("click", Generic.preventButtonClickOverride(this.listSnippets.bind(this)));
    };

    this.getDOMElementFull = function (objectNamesToHighlight) {
        let div = q.new("div"),
            listElm,
            htmlElm,
            emptyDiv,
            len = this.list.length;

        for (let i = 0; i < len; i++) {
            listElm = this.list[i];
            htmlElm = listElm.getDOMElement(objectNamesToHighlight);
            div.appendChild(htmlElm);
        }

        if (len === 0) {
            emptyDiv = q.new("div");
            emptyDiv
                .addClass("empty_folder")
                .html(this.isSearchResultFolder ? "No matches found" : "This folder is empty");
            div.appendChild(emptyDiv);
        }

        return div;
    };

    this.getUniqueObject = function (name, type) {
        const index = this.getUniqueObjectIndex(name, type);

        if (!index) {
            return null;
        }

        let folder = this;

        for (let i = 0, len = index.length; i < len; i++) {
            folder = folder.list[index[i]];
        }

        return folder;
    };

    this.getUniqueObjectIndex = function (name, type) {
        return Folder.indices[type][name.toLowerCase()];
    };

    function getUniqueObjectFn(type) {
        return function (name) {
            return this.getUniqueObject(name, type);
        };
    }

    function getUniqueObjectIndexFn(type) {
        return function (name) {
            return this.getUniqueObjectIndex(name, type);
        };
    }

    this.getUniqueSnip = getUniqueObjectFn(Generic.SNIP_TYPE);

    // return value of index is a n-length array of indexes
    // where each int from 0 to n-2 index in array
    // is the index of folder (0=outermost; n-2=innermost)
    // and (n-1)th value is index of snippet in innnermost folder
    this.getUniqueSnipIndex = getUniqueObjectIndexFn(Generic.SNIP_TYPE);

    this.getUniqueFolder = getUniqueObjectFn(Generic.FOLDER_TYPE);

    this.getUniqueFolderIndex = getUniqueObjectIndexFn(Generic.FOLDER_TYPE);

    // called whens searching starts
    // removes all tags from text and stores as new prperty
    // tags present in snippets might interfere with search
    // we only should work with plaintext
    this.stripAllSnippetsTags = function ($refDiv) {
        $refDiv = $refDiv || q.new("DIV"); // reuse existing DOM
        this.hasStrippedSnippets = true;

        this.list.forEach((elm) => {
            if (Folder.isFolder(elm)) {
                elm.stripAllSnippetsTags($refDiv);
            } else {
                elm.strippedBody = Snip.stripAllTags(elm.body, $refDiv);
            }
        });
    };

    this.searchSnippets = function (text) {
        text = pk.escapeRegExp(text);

        if (!this.hasStrippedSnippets) {
            this.stripAllSnippetsTags();
        }

        return new Folder(
            Folder.SEARCH_RESULTS_NAME + this.name,
            this.list
                .reduce((result, listElm) => {
                    if (Folder.isFolder(listElm)) {
                        result = result.concat(listElm.searchSnippets(text).list);
                    }

                    if (listElm.matchesLazy(text)) {
                        result.push(listElm);
                    }

                    return result;
                }, [])
                .sort((a, b) => (b.matchesUnique(text)
                    ? 1
                    : !a.matchesUnique(text)
                        ? b.matchesNameLazy(text)
                            ? 1
                            : !a.matchesNameLazy(text) && b.matchesWord(text)
                                ? 1
                                : -1
                        : -1)),
            undefined,
            true,
        );
    };

    this.sort = function (filterType, descendingFlag) {
        // sort folders&snippets separately so that
        // folders are always above snippets
        const isAlphabeticSort = filterType === "alphabetic",
            firstSnippetIndex = this.getLastFolderIndex() + 1,
            folders = this.list.slice(0, firstSnippetIndex),
            snippets = this.list.slice(firstSnippetIndex);

        function sort(arr) {
            arr.sort((a, b) => {
                const alphaResult = a.name.localeCompare(b.name);
                // default to alphabetical sort in case timestamps are same
                return isAlphabeticSort ? alphaResult : a.timestamp - b.timestamp || alphaResult;
            });

            return descendingFlag ? arr.reverse() : arr;
        }

        this.list = sort(folders).concat(sort(snippets));

        saveSnippetData(undefined, this.name);
    };

    this.listSnippets = function (objectNamesToHighlight) {
        // can also be a MouseEvent (generated on click)
        objectNamesToHighlight = pk.isObject(objectNamesToHighlight)
            ? undefined
            : objectNamesToHighlight;
        $containerSnippets
            .html("") // first remove previous content
            .appendChild(this.getDOMElementFull(objectNamesToHighlight));
        this.insertFolderPathDOM();
    };

    function insertPathPartDivs(name) {
        const pathPart = q.new("div").addClass("path_part"),
            rightArrow = q.new("div").addClass("right_arrow");

        $containerFolderPath.appendChild(pathPart.html(name));
        $containerFolderPath.appendChild(rightArrow);
    }

    this.insertFolderPathDOM = function () {
        $containerFolderPath.html(""); // clear previous data

        if (this.isSearchResultFolder) {
            insertPathPartDivs(this.name);
            return;
        }

        insertPathPartDivs(Folder.MAIN_SNIPPETS_NAME);

        let index = Data.snippets.getUniqueFolderIndex(this.name),
            i = 0,
            len = index.length,
            folder = Data.snippets;

        for (; i < len; i++) {
            folder = folder.list[index[i]];
            insertPathPartDivs(folder.name);
        }

        Folder.implementChevronInFolderPath();
    };

    // returns array representation of this Folder object
    this.toArray = function () {
        return [this.name, this.timestamp].concat(this.list.map(listElm => listElm.toArray()));
    };

    function stripHTMLTags(text) {
        /**
         * the docs say that "You must escape the five predefined entities to display them as text"
         * however my code doesn't work (gives "xml no name" error) on doing it, and actually works without doing it
         */

        let div = q.new("div"),
            output; /* ,
            replacementMap = [["&", "&amp;"], ["<", "&lt;"], [">", "&gt;"], ["'", "&apos;"], ["\"", "&quot;"]] */

        div.innerHTML = text;
        output = div.innerText.replace(/\n/g, " ");

        /* replacementMap.forEach(function (element) {
            output = output.replace(element[0], element[1]);
        }); */

        return output;
    }

    function highlightMatchText(keyword, textToMatch) {
        return textToMatch.replace(
            new RegExp(pk.escapeRegExp(keyword), "ig"),
            $0 => `<match>${$0}</match>`,
        );
    }

    this.filterSnippetsForOmnibox = function (text, callback) {
        let snipArray = [],
            description,
            searchResults = this.searchSnippets(text);

        searchResults.forEachSnippet((snip) => {
            snip.formatMacros((snipBody) => {
                snipBody = stripHTMLTags(snipBody);
                description = `<url>${highlightMatchText(text, snip.name)}</url> - `;
                description += `<dim>${highlightMatchText(text, snipBody)}</dim>`;

                snipArray.push({
                    content: snipBody,
                    description,
                });
            });
        });

        const checkFullyLoaded = setInterval(() => {
            if (snipArray.length === searchResults.getSnippetCount()) {
                clearInterval(checkFullyLoaded);
                callback(snipArray);
            }
        }, 200);
    };

    this.getFolderSelectList = function (nameToNotShow) {
        let mainContainer = q.new("div"),
            $folderName = q.new("p").html(this.name),
            childContainer,
            hasChildFolder = false;

        mainContainer.appendChild($folderName);

        if (this.name !== Folder.MAIN_SNIPPETS_NAME) {
            mainContainer.addClass("collapsed");
        }

        this.forEachFolder((e) => {
            if (e.name !== nameToNotShow) {
                hasChildFolder = true;
                childContainer = e.getFolderSelectList(nameToNotShow);
                childContainer.style.marginLeft = "15px";
                mainContainer.appendChild(childContainer);
            }
        }, true);

        if (!hasChildFolder) {
            mainContainer.addClass("empty");
        }

        return mainContainer;
    };

    this.getDuplicatedObject = function () {
        return new Folder(this.name, this.list, this.timestamp);
    };

    this.getUniqueSnippetAtCaretPos = function (node, pos) {
        let val = pk.getText(node),
            snip,
            stringToCheck = "",
            foundSnip = null,
            delimiterChar = val[pos - 1],
            lim = pos < pk.OBJECT_NAME_LIMIT ? pos : pk.OBJECT_NAME_LIMIT;

        for (let i = 1; i <= lim; i++) {
            // the previous delimiter char gets added to the
            // string to check as we move towards left
            stringToCheck = delimiterChar + stringToCheck;
            delimiterChar = val[pos - 1 - i];
            snip = this.getUniqueSnip(stringToCheck);

            if (snip) {
                if (Data.matchDelimitedWord && pk.snipNameDelimiterListRegex) {
                    // delimiter char may not exist if snip name
                    // is at the beginning of the textbox
                    if (
                        !delimiterChar
                        || pk.snipNameDelimiterListRegex.test(delimiterChar)
                        || delimiterChar === "\n"
                    ) {
                        // a new line character is always a delimiter
                        foundSnip = snip;
                    }
                } else {
                    foundSnip = snip;
                }
            }

            if (foundSnip) { break; }
        }

        return foundSnip;
    };

    // parentID (optional) - if undefined, defaults to top-level
    this.createCtxMenuEntry = function (parentId) {
        let id,
            emptyFolderText = "Empty folder ";

        this.list.forEach((object) => {
            id = Generic.CTX_START[object.type] + object.name;

            chrome.contextMenus.create(
                {
                    contexts: ["editable"],
                    id, // unique id
                    title: object.name,
                    parentId,
                },
                () => {
                    if (chrome.runtime.lastError) {
                        console.log("Error while creating context menu: ");
                        console.log(chrome.runtime.lastError);
                    }
                    // do nothing
                },
            );

            listOfSnippetCtxIDs.push(id);

            if (Folder.isFolder(object)) {
                object.createCtxMenuEntry(id);
            }
        });

        if (this.list.length === 0) {
            id = emptyFolderText + this.name;

            chrome.contextMenus.create(
                {
                    contexts: ["editable"],
                    id, // unique id
                    title: emptyFolderText,
                    parentId,
                },
                pk.checkRuntimeError("SCJS-CTX-CRE"),
            );

            listOfSnippetCtxIDs.push(id);
        }
    };

    function genericLooper(type) {
        /**
         * @param {Function} fn : function to execute on matching list elm; doesn't retain `this` context
         * @param {boolean} shouldNotNest : calls `fn` on snippets/folders inside `this.list` by default
         */
        const ret = function (fn, shouldNotNest) {
            this.list.forEach((listElm) => {
                if (!shouldNotNest && Folder.isFolder(listElm)) {
                    ret.call(listElm, fn, false);
                }

                if (listElm.type === type) {
                    fn(listElm);
                }
            });
        };

        return ret;
    }

    this.forEachSnippet = genericLooper(Generic.SNIP_TYPE);
    this.forEachFolder = genericLooper(Generic.FOLDER_TYPE);
};
Folder.prototype = new Generic();

// returns a Folder object based on Array
Folder.fromArray = function (arr) {
    // during 2.8.0 version, first element of arr
    // was not the name of folder
    if (typeof arr[0] !== "string") {
        arr.unshift(Folder.MAIN_SNIPPETS_NAME);
    }

    // 2nd elm is timestamp
    if (typeof arr[1] !== "number") {
        arr.splice(1, 0, Date.now());
    }

    // name of folder is arr's first element
    const folder = new Folder(arr.shift(), undefined, arr.shift());

    folder.list = arr.map(listElm => (Array.isArray(listElm) ? Folder.fromArray(listElm) : Snip.fromObject(listElm)));

    // only options page mutates list
    if (window.IN_OPTIONS_PAGE) {
        observeList(folder.list);
    }

    return folder;
};
Folder.isValidName = function (name) {
    return Generic.isValidName(name, Generic.FOLDER_TYPE);
};
Folder.isFolder = function (elm) {
    return elm.type === Generic.FOLDER_TYPE;
};
Folder.MAIN_SNIPPETS_NAME = "Snippets";
Folder.SEARCH_RESULTS_NAME = "Search Results in ";
Folder.CHEVRON_TEXT = "<<";
Folder.setIndices = function () {
    // indexArray is an array denoting nested levels inside folders
    function set(type, name, indexArray) {
        Folder.indices[type][name.toLowerCase()] = indexArray;
    }

    // mainIndexArray - denotes indexArray of parent folder
    // currIndexArray - denotes indexArray of current object
    function repeat(folder, mainIndexArray) {
        let indexCounter = 0,
            currIndexArray;

        set(folder.type, folder.name, mainIndexArray);

        folder.list.forEach((elm) => {
            // using concat to clone arrays and hence avoid mutation
            currIndexArray = mainIndexArray.concat(indexCounter);

            if (Folder.isFolder(elm)) {
                repeat(elm, currIndexArray);
            } else {
                set(elm.type, elm.name, currIndexArray);
            }

            indexCounter++;
        });
    }

    // reset
    Folder.indices = {};
    Folder.indices[Generic.FOLDER_TYPE] = {};
    Folder.indices[Generic.SNIP_TYPE] = {};

    repeat(Data.snippets, []);
};
Folder.copyContents = function (fromFolder, toFolder) {
    let { list } = fromFolder,
        len = list.length,
        i = len - 1;

    // loop in reverse order, so that they are inserted in the correct order
    for (; i >= 0; i--) {
        Folder.insertObject(list[i].getDuplicatedObject(), toFolder);
    }
};
Folder.insertObject = function (object, folder) {
    if (Folder.isFolder(object)) {
        folder.list.unshift(object);
    } else {
        folder.list.splice(folder.getLastFolderIndex() + 1, 0, object);
    }
};
Folder.insertBulkActionDOM = function (listedFolder) {
    const container = q.new("div");

    listedFolder.list.forEach((listElm) => {
        const $generic = q.new("div").addClass("generic"),
            checkbox = q.new("input"),
            img = q.new("img"),
            div = q
                .new("div")
                .addClass("name")
                .html(listElm.name);

        checkbox.type = "checkbox";
        img.src = `../imgs/${listElm.type}.svg`;

        $generic.appendChild(checkbox);
        $generic.appendChild(img);
        $generic.appendChild(div);
        container.appendChild($generic);
    });

    $containerSnippets
        .html("") // first remove previous content
        .appendChild(container);

    return container;
};
Folder.getSelectedFolderInSelectList = function (selectList) {
    const selectFolderName = selectList.qClsSingle("selected").html();

    return Data.snippets.getUniqueFolder(selectFolderName);
};
Folder.refreshSelectList = function (selectList) {
    selectList.html("").appendChild(Data.snippets.getFolderSelectList());

    // select top-most "Snippets" folder; do not use fistChild as it may
    // count text nodes
    selectList.children[0].children[0].addClass("selected");
};
// do not remove newly inserted chevron as it will again exceed
// width causing recursion
Folder.implementChevronInFolderPath = function (notRemoveChevron) {
    const ACTUAL_ARROW_WIDTH = 15;

    function computeTotalWidth() {
        let arrowCount = 0,
            totalWidth = [].slice.call($containerFolderPath.children, 0).reduce((sum, elm) => {
                const isArrow = elm.hasClass("right_arrow");
                return isArrow ? (arrowCount++, sum) : sum + elm.offsetWidth;
            }, 0);

        // arrows, being titled, actually take up less space (falf their width)
        totalWidth += arrowCount * ACTUAL_ARROW_WIDTH;

        return totalWidth;
    }

    let width = $containerFolderPath.offsetWidth,
        totalWidth = computeTotalWidth(),
        lastPathPart = $containerFolderPath.lastChild.previousElementSibling,
        pathPart,
        doesChevronExist,
        folderObj = Folder.getListedFolder();

    if (totalWidth > width) {
        pathPart = $containerFolderPath.q(".path_part:not(.chevron)");

        if (pathPart === lastPathPart) {
            pathPart.style.width = `${
                $containerFolderPath.offsetWidth - ACTUAL_ARROW_WIDTH - 50 // for the chevron
            }px`;
            pathPart.addClass("ellipsized");
        } else {
            doesChevronExist = !!$containerFolderPath.qClsSingle("chevron");

            // remove the right arrow
            $containerFolderPath.removeChild(pathPart.nextElementSibling);

            // only one chevron allowed
            if (doesChevronExist) {
                $containerFolderPath.removeChild(pathPart);
            } else {
                pathPart.addClass("chevron").html(Folder.CHEVRON_TEXT);
            }

            // recheck if width fits correctly now
            Folder.implementChevronInFolderPath(true);
        }
    } else if (!notRemoveChevron && $containerFolderPath.qClsSingle("chevron")) {
        // clear previous chevrons
        folderObj.insertFolderPathDOM();
    }
};
Folder.getListedFolderName = function () {
    return $containerFolderPath.q(":nth-last-child(2)").html();
};
Folder.getListedFolder = function () {
    let name = Folder.getListedFolderName(),
        idx = name.indexOf(Folder.SEARCH_RESULTS_NAME);

    if (idx !== -1) {
        name = name.substring(Folder.SEARCH_RESULTS_NAME.length);
    }

    return Data.snippets.getUniqueFolder(name);
};
Folder.validate = function (arr) {
    if (typeof arr[0] !== "string") {
        // possibly before 300 version
        arr.unshift(Date.now());
        arr.unshift(Folder.MAIN_SNIPPETS_NAME);
    }

    /* Note: Generic.getDuplicateObjectsText is being used below
        to suppress duplicate snippets warnings. They will NOT be checked.
        If a user creates duplicate folders, it's his own fault. */
    let folderName = arr[0],
        folderTimestamp = arr[1],
        snippets = arr.slice(2),
        folderMsg = `Folder ${folderName}`,
        folderVld,
        snippetVld;

    if (typeof folderName !== "string") {
        return `Name of ${folderMsg} is not a string.`;
    }

    folderVld = Folder.isValidName(folderName);

    if (
        folderVld !== "true"
        && Generic.getDuplicateObjectsText(folderName, Generic.FOLDER_TYPE) !== folderVld
    ) {
        return `Name of ${folderMsg} is invalid because: ${folderVld}`;
    }

    if (typeof folderTimestamp !== "number") {
        return `Timestamp for ${folderMsg} is not a number`;
    }

    for (let i = 0, len = snippets.length, elm; i < len; i++) {
        elm = snippets[i];

        snippetVld = Snip.validate(elm, folderName, i);

        if (snippetVld !== "true") {
            return snippetVld;
        }
    }

    return "true";
};
Folder.getDefaultSnippetData = function () {
    const name1 = "README-New_UI_Details",
        // using + operator avoids the inadvertently introduced tab characters
        body1 = "Dear user, here are some things you need to know in this new UI:\n\n"
            + "1. You need to click on the name or body of the listed snippet to expand it completely. In the following image, "
            + "the purple area shows where you can click to expand the snippet.\n\n<img src='../imgs/help1.png'>\n\n"
            + "2. Click on the pencil icon to edit and the dustbin icon to delete a snippet/folder.\n"
            + "3. Click on the folder, anywhere in the purple area denoted below, to view its contents.\n\n<img src='../imgs/help2.png'>\n\n"
            + "4. Click on a folder name in the navbar to view its contents. In the example below, the navbar consists of 'Snippets', 'sampleFolder' and 'folder2', "
            + " each nested within the previous.\n\n"
            + "<img src='../imgs/help3.png'>",
        name2 = "clipboard_macro",
        body2 = "Use this snippet anywhere and the following - [[%p]] - will be replaced by "
            + " your clipboard data. Clipboard data includes text that you have previously copied or cut with intention to paste.",
        ts = Date.now(),
        snips = [
            Folder.MAIN_SNIPPETS_NAME,
            ts,
            ["sampleFolder", ts],
            {
                name: "sampleSnippet",
                body:
                    "Hello new user! Thank you for using ProKeys!\n\nThis is a sample snippet. Try using it on any webpage by typing 'sampleSnippet' (snippet name; without quotes), and press the hotkey (default: Shift+Space), and this whole text would come in place of it.",
                timestamp: ts,
            },
            {
                name: "letter",
                body:
                    "(Sample snippet to demonstrate the power of ProKeys snippets; for more detail on Placeholders, see the Help section)\n\nHello %name%,\n\nYour complaint number %complaint% has been noted. We will work at our best pace to get this issue solved for you. If you experience any more problems, please feel free to contact at me@organization.com.\n\nRegards,\n%my_name%,\nDate: [[%d(D-MM-YYYY)]]",
                timestamp: ts,
            },
            {
                name: "brb",
                body: "be right back",
                timestamp: ts,
            },
            {
                name: "my_sign",
                body:
                    "<b>Aquila Softworks ©</b>\n<i>Creator Of ProKeys</i>\n<u>prokeys.feedback@gmail.com</u>",
                timestamp: ts,
            },
            {
                name: "dateArithmetic",
                body:
                    "Use this snippet in any webpage, and you'll see that the following: [[%d(Do MMMM YYYY hh:m:s)]] is replaced by the current date and time.\n\nMoreover, you can perform date/time arithmetic. The following: [[%d(D+5 MMMM+5 YYYY+5 hh-5:m-5:s-5)]] gives the date, month, year, forward by five; and hour, minutes, and seconds backward by 5.\n\nMore info on this in the Help section.",
                timestamp: ts,
            },
            {
                name: "urlMacro",
                body:
                    "Use the URL macro (details in the Help page) to retrieve information about the current webpage URL. For example, when executed on any webpage, the code - [[%u(0)]] - outputs the full website name on which it is executed.",
                timestamp: ts,
            },
            {
                name: name1,
                body: body1,
                timestamp: ts,
            },
            {
                name: name2,
                body: body2,
                timestamp: ts,
            },
        ];

    return snips;
};
// inserts a combo rich (quill) and plain (textarea) textbox (default)
// inside of the $container argument with options to swap b/w the two,
// get rich/plain contents, etc.
/* "transferContents" - in case user switches from rich to plain view, he'll
lose all his formatting, so show alert box for a warning and then accordingly transfer contents
to the new shown box */
window.DualTextbox = function ($container, isTryItEditor) {
    // contants/flags
    let SHOW_CLASS = "show",
        RICH_EDITOR_CONTAINER_CLASS = "rich_editor_container",
        RICH_EDITOR_CLASS = isTryItEditor ? "normal-editor" : "ql-editor",
        isCurrModePlain = true, // default is textarea
        transferContentsToShownEditor = !isTryItEditor,
        // create navbar
        $nav = q.new("DIV").addClass("nav"),
        $span = q.new("SPAN").text("Swap editor mode: "),
        $pTextarea = q
            .new("P")
            .text("Textarea")
            .addClass(SHOW_CLASS),
        $pRich = q.new("P").text("Styled textbox");
    $pTextarea.dataset.containerSelector = "textarea";
    $pRich.dataset.containerSelector = `.${RICH_EDITOR_CONTAINER_CLASS}`;
    $pTextarea.dataset.editorSelector = "textarea";
    $pRich.dataset.editorSelector = `.${RICH_EDITOR_CLASS}`;

    $nav.appendChild($span);
    $nav.appendChild($pTextarea);
    $nav.appendChild($pRich);
    $container.appendChild($nav);
    $container.addClass("dualBoxContainer"); // for css styling

    // create rich/plain boxes
    // (textarea doesn't need a container; so assume itself to be the container)
    let $textarea = q.new("TEXTAREA").addClass([SHOW_CLASS, $pTextarea.dataset.containerSelector]),
        $richEditorContainer = q.new("DIV").addClass(RICH_EDITOR_CONTAINER_CLASS),
        $richEditor = q.new("DIV"),
        quillObj;

    $container.appendChild($textarea);
    $richEditorContainer.appendChild($richEditor);
    $container.appendChild($richEditorContainer);

    // issues#115
    if (isTryItEditor) {
        $richEditor.addClass(RICH_EDITOR_CLASS).attr("contenteditable", "true");
    } else {
        quillObj = initializeQuill($richEditor, $richEditorContainer);
        $richEditor = $container.q($pRich.dataset.editorSelector);
    }

    function initializeQuill($editor, $container) {
        const toolbarOptions = [
                ["bold", "italic", "underline", "strike"], // toggled buttons
                ["blockquote", "code-block", "link"],

                [{ list: "ordered" }, { list: "bullet" }],
                [{ script: "sub" }, { script: "super" }], // superscript/subscript

                [{ size: ["small", false, "large", "huge"] }], // custom dropdown

                [{ color: [] }, { background: [] }], // dropdown with defaults from theme
                [{ font: [] }],
                [{ align: [] }],

                ["clean"], // remove formatting button
            ],
            Link = Quill.import("formats/link"),
            builtInFunc = Link.sanitize;
        Link.sanitize = function sanitizeLinkInput(linkValueInput) {
            return builtInFunc.call(this, Snip.defaultLinkSanitize(linkValueInput));
        };

        return new Quill($editor, {
            modules: {
                toolbar: toolbarOptions,
                history: true,
                clipboard: true,
            },
            placeholder: "Expansion text goes here...",
            theme: "snow",
            bounds: $container,
        });

        // cannot modify dangerouslyPasteHTML to have custom matcher
        // for font-size/-family. It's as much work as making Snip.makeHTMLSuitableForQuill
    }

    // implement swapping of textbox and richEditor
    $nav.on("click", (e) => {
        const node = (e.detail && e.detail.target) || e.target; // event delegation

        if (
            !(node.tagName === "P")
            // only show if not already shown
            || node.hasClass(SHOW_CLASS)
        ) {
            return true;
        }

        // from rte to textarea
        if (
            transferContentsToShownEditor
            && !isCurrModePlain
            && !this.userAllowsToLoseFormattingOnSwapToTextarea()
        ) {
            return false;
        }

        let currShown = $container.qCls(SHOW_CLASS),
            currShownEditor = currShown[1],
            $newlyShownContainer,
            $newlyShownEditor;
        currShown.removeClass(SHOW_CLASS);
        currShownEditor.removeAttribute("tab-index");

        // add show class to `p` and corresponding box
        node.addClass(SHOW_CLASS);
        $newlyShownContainer = $container.q(node.dataset.containerSelector);
        $newlyShownEditor = $container.q(node.dataset.editorSelector);
        $newlyShownContainer.addClass(SHOW_CLASS);
        $newlyShownEditor.attr("tab-index", 20).focus();

        isCurrModePlain = !isCurrModePlain; // reverse

        if (transferContentsToShownEditor) {
            // <b> tags get converted to bold formatted text (and vc-vs)
            if (isCurrModePlain) {
                this.setPlainText(this.getRichText());
            } else {
                this.setRichText(pk.convertBetweenHTMLTags(this.getPlainText(), true));
            }
        }
    });

    // if user did NOT set alignment, font color, size, family, returns true
    // else gives a confirm box
    this.userAllowsToLoseFormattingOnSwapToTextarea = function () {
        const detected = Snip.getQuillClsForFormattedLossyContent($richEditor.innerHTML);

        if (
            detected
            && !window.confirm(
                `We detected formatted text ${detected} in your expansion. You will lose it after this swap. Are you sure you wish to continue?`,
            )
        ) {
            return false;
        }
        return true;
    };

    this.switchToDefaultView = function (textToSet) {
        $nav.trigger("click", {
            target: Snip.isSuitableForPastingInTextareaAsIs(textToSet) ? $pTextarea : $pRich,
        });

        return this;
    };

    this.setPlainText = function (text) {
        $textarea.text(text);
        return this;
    };

    this.setRichText = function (html) {
        // NOTE: also used by Tryit editor which does not have Quill
        if (quillObj) {
            quillObj.clipboard.dangerouslyPasteHTML(Snip.makeHTMLSuitableForQuill(html));
        } else {
            $richEditor.innerHTML = html;
        }
        return this;
    };

    /**
     * PRECONDITION: default view has been decided beforehand
     * and has been switched to
     */
    this.setShownText = function (text) {
        // NOTE: do not use .html() since it loses
        // the custom styles for font-size/-family
        if (isCurrModePlain) {
            // since we've switched to default view
            // we're already in textarea and saving a textarea suitable snippet
            // no need to preprocess or do anything to it.
            // BUT BUT BUT we need to format the OL and UL with indentation
            $textarea.value = Snip.makeHTMLSuitableForTextareaThroughString(text);
        } else {
            // without dangerouslyPasteHTML we end up having lots
            // of <p> elements at unwarranted locations
            quillObj.clipboard.dangerouslyPasteHTML(Snip.makeHTMLSuitableForQuill(text));
        }

        return this;
    };

    this.getPlainText = function () {
        return $textarea.value;
    };

    this.getRichText = function () {
        return Snip.makeHTMLSuitableForTextarea($richEditor);
    };

    this.getShownTextForSaving = function () {
        // calling makeHTMLSuitableForTextareaThroughString for
        // making the string well-formatted for display in website textareas
        if (isCurrModePlain) {
            return Snip.sanitizeTextareaTextForSave(this.getPlainText());
        }
        return Snip.makeHTMLValidForExternalEmbed($richEditor.innerHTML, true);
    };
};

function observeList(list) {
    let watchProperties = ["push", "pop", "shift", "unshift", "splice"],
        i = 0,
        len = watchProperties.length,
        prop;

    for (; i < len; i++) {
        prop = watchProperties[i];

        Object.defineProperty(list, prop, {
            configurable: false,
            enumerable: false,
            writable: false,
            value: (function (prop) {
                return function (...args) {
                    // do not use list[prop] because it is already overwritten
                    // and so will lead to inifinite recursion
                    const ret = [][prop].apply(list, args);
                    Folder.setIndices();
                    return ret;
                };
            }(prop)),
        });
    }
}
