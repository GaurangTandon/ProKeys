/* global isEmpty, padNumber, cloneObject, isObject, getFormattedDate */
/* global $, getHTML, SNIP_NAME_LIMIT, SNIP_BODY_LIMIT */
/* global triggerEvent, setHTML, MONTHS, chrome */
/* global escapeRegExp, getText, Folder, Data, Snip, Generic, saveSnippetData, OBJECT_NAME_LIMIT*/
/* global convertBetweenHTMLTags, Quill, $containerFolderPath, $containerSnippets, listOfSnippetCtxIDs, latestRevisionLabel */

/* this file is loaded both as a content script a
	as well as a background page*/

// functions common to Snip and Folder
window.Generic = function(){
	this.matchesUnique = function(name){
		return this.name.toLowerCase() === name.toLowerCase();
	};
	
	this.matchesLazy = function(text){		
		// searching is case-insensitive
		return new RegExp(text, "i").test(this.name + this.body);
	};
	
	this.matchesWord = function(text){
		return new RegExp("\\b" + text + "\\b", "i").test(this.name + this.body);
	};
	
	// deletes `this` from parent folder
	this.remove = function(){
		var index = Data.snippets.getUniqueObjectIndex(this.name, this.type),
			thisIndex = index.pop();
		
		var folder = Data.snippets;
		while(index.length > 0)
			folder = folder.list[index.shift()];

		folder.list.splice(thisIndex, 1);		
	};

	this.getParentFolder = function(){			
		var index = Data.snippets.getUniqueObjectIndex(this.name, this.type),
			parent = Data.snippets;
		
		// last element is `this` index, we want parent so -1
		for(var i = 0, lim = index.length - 1; i < lim; i++)
			parent = parent.list[index[i]];
		
		return parent;
	};		

	this.moveTo = function(newFolder){
		var x = this.clone();
		this.remove();
		Folder.insertObject(x, newFolder);			
	};
	
	// a folder cannot be nested under its subfolders, hence a check
	this.canNestUnder = function(newFolder){
		if(Folder.isFolder(this)){
			while(newFolder.name !== Folder.MAIN_SNIPPETS_NAME){
				if(this.name === newFolder.name)
					return false;
				
				newFolder = newFolder.getParentFolder();
			}
		}				
		
		// no need to check for snippets		
		return true;
	};
};
// class added to newly created snip/folder
// to highlight it
Generic.HIGHLIGHTING_CLASS = "highlighting";
// returns the DOM element for edit and delete button
Generic.getButtonsDOMElm = function(){
	var divButtons = $.new("div").addClass("buttons");	
	divButtons.appendChild($.new("div").addClass("edit_btn"))
		.setAttribute("title", "Edit");
	divButtons.appendChild($.new("div").addClass("delete_btn"))
		.setAttribute("title", "Delete");
	return divButtons;
};	

Generic.getDOMElement = function(objectNamesToHighlight){
	var divMain, divName, img;
	
	// security checks
	objectNamesToHighlight = objectNamesToHighlight === undefined ? [] :
							!Array.isArray(objectNamesToHighlight) ? [objectNamesToHighlight] :
							objectNamesToHighlight;

	divMain = $.new("div")
				.addClass([this.type, "generic", Snip.DOMContractedClass]);
	
	img = $.new("img");
	img.src = "../imgs/" + this.type + ".png";
	divMain.appendChild(img);
	
	// creating the short `div` element
	divName = $.new("div");
	// text with newlines does not fit in one line
	divName.text(this.name).addClass("name");
	divMain.appendChild(divName);
	
	divMain.appendChild(Generic.getButtonsDOMElm());
	
	if(objectNamesToHighlight.indexOf(this.name) > -1){
		divMain.removeClass(Snip.DOMContractedClass);
		// highlight so the user may notice it #ux
		// remove class after 3 seconds else it will
		// highlight repeatedly
		divMain.addClass(Generic.HIGHLIGHTING_CLASS);
		setTimeout(function(){
			divMain.removeClass(Generic.HIGHLIGHTING_CLASS);
		}, 3000); 
	}
	
	return divMain;
};

// when we attach click handler to div.snip/.folder
// .buttons div click handlers get overrided
Generic.preventButtonClickOverride = function(handler){
	return function(e){
		if(!e.target.matches(".buttons, .buttons div"))
			handler.call(this, e);
	};
};

Generic.getDuplicateObjectsText = function(text, type){
	return "A " + type + " with name '" + text + 
			"' already exists (possibly with the same letters in upper/lower case.)";
};

Generic.isValidName = function(name, type){
	return  name.length === 0   ? "Empty name field" :
			name.length > OBJECT_NAME_LIMIT ? "Name cannot be greater than " + OBJECT_NAME_LIMIT  + 
									" characters. Current name has " + (name.length - OBJECT_NAME_LIMIT) +
									" more characters." : 
			Data.snippets.getUniqueObject(name, type) ?
				Generic.getDuplicateObjectsText(name, type) : "true";
};

Generic.FOLDER_TYPE = "folder";
Generic.SNIP_TYPE = "snip";
Generic.CTX_START = {};
Generic.CTX_START[Generic.SNIP_TYPE] = Generic.SNIP_TYPE + "_";
Generic.CTX_START[Generic.FOLDER_TYPE] = Generic.FOLDER_TYPE + "_";
Generic.CTX_SNIP_REGEX = new RegExp(Generic.CTX_START[Generic.SNIP_TYPE]);
	
window.Snip = function(name, body, timestamp){
	this.name = name;
	this.body = body;
	this.timestamp = timestamp || Date.now();
	this.type = Generic.SNIP_TYPE;

	this.edit = function(newName, newBody){
		this.name = newName;
		this.body = newBody;
	};
			
	// "index" is index of this snip in Data.snippets
	this.getDOMElement = function(objectNamesToHighlight){
		function toggleDivBodyText(snip){
			if(divMain.hasClass(Snip.DOMContractedClass)){
				divBody.html(snip.body.replace(/\n/g, " "));

				// during this call is going on, divName has't been shown on screen yet
				// so clientWidth returns zero, hence, wait for a short duration before
				// setting style.width
				setTimeout(function(){
					divBody.style.width = "calc(100% - 90px - " + divName.clientWidth + "px)";
				}, 1);
			}
			else{
				divBody.html(snip.body);				
				divBody.style.width = "";				
			}
		}
		
		var divMain = Generic.getDOMElement.call(this, objectNamesToHighlight),
			divName = divMain.querySelector(".name"), divBody;
		
		// our `div` body element; with Snip body
		divBody = $.new("div").addClass("body");
		toggleDivBodyText(this);
		divMain.appendChild(divBody);		
		
		divMain.appendChild(Snip.getClickableDOMElm())
			.on("click", 
			Generic.preventButtonClickOverride(function(){
				divMain.toggleClass(Snip.DOMContractedClass);
				toggleDivBodyText(this);
			}.bind(this)));
					
		var timestampElm = $.new("div")
							.addClass("timestamp")
							.html(Snip.getTimestampString(this));			
		divMain.appendChild(timestampElm);
		
		return divMain;
	};

	this.clone = function(){
		return new Snip(this.name, this.body, this.timestamp);
	};

	// returns object representation of this Snip object
	this.toArray = function(){
		return {
			name : this.name,
			body : this.body,
			timestamp : this.timestamp
		};
	};
};
Snip.prototype = new Generic();

Snip.fromObject = function(snip){
	var nSnip = new Snip(snip.name, snip.body);
	
	// remove "Created on " part from timestamp
	nSnip.timestamp = 
				!snip.timestamp ? Date.now() : // can be undefined
					typeof snip.timestamp === "number" ? 
						snip.timestamp :
						Date.parse(snip.timestamp.substring(11));
	
	return nSnip;
};
Snip.isValidName = function(name){
	var vld = Generic.isValidName(name, Generic.SNIP_TYPE),
		delimiterMatchExists  = name.match(window.snipNameDelimiterListRegex);
	
	return  Data.matchDelimiterWord &&
				delimiterMatchExists ? "Name contains delimiter - '" + delimiterMatchExists[0] + 
									"' Please change delimiters in Settings page or remove this character from snip name.":
			vld !== "true"       ? vld :
			/^%.+%$/.test(name)  ? "Name cannot be of the form '%abc%'" :
			"true";
};
Snip.isValidBody = function (body){
	return body.length ? "true" : "Empty body field";
};
Snip.getTimestampString = function(snip){
	return "Created on " + getFormattedDate(snip.timestamp);
};

/*
1. removes and replaces the spammy p nodes with \n
2. replaces <strong>,<em> with <b>,<i>
3. leaves pre, blockquote, u, etc. as it is (since they're useful in markdown) 
4. replaces br element with \n
*/
Snip.makeHTMLSuitableForTextarea = function(htmlNode){
	function getProperTagPair(elm){
		var map = {
				"strong": "b",
				"em": "i"
			}, returnArray,
			tag = elm.tagName.toLowerCase();
		
		if(map[tag]) tag = map[tag];
		
		returnArray = ["<" + tag + ">", "</" + tag + ">"];
		
		if(tag === "a")
			returnArray[0] = "<a href='" + elm.href + "'>";
		
		// span is used for font family, sizes, color
		// and is therefore not shown  
		return 	tag !== "span" ? returnArray : ["", ""];
	}
	
	// sanitizes top-level elements
	function topLevelElementSanitize(node){		
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
		var tagName = node.tagName,
			resultString = "", elm, tags,
			children = node.childNodes, // returns [] for no nodes
			i = 0, childrenCount = children.length;
		
		if(tagName === "PRE"){
			// can't use outerHTML since it includes atributes
			// (like spellcheck=false) 
			tags = getProperTagPair(node);
			return tags[0] + node.innerHTML + tags[1];
		}
		
		if(tagName === "P" &&
			childrenCount === 1 && 
			children[0].tagName === "BR")
			return "";

		for(; i < childrenCount; i++){
			elm = children[i];
			
			// element node
			if(elm.nodeType == 1){
				tags = getProperTagPair(elm);					
				
				resultString +=
						tags[0]
						+ topLevelElementSanitize(elm)
						+ tags[1];
			}
			else resultString += elm.textContent;
		}
		
		return node.tagName === "BLOCKQUOTE" ?
				"<blockquote>" + resultString + "</blockquote>" : 
				resultString;
	}
	
	var children = htmlNode.children, // concerned with element nodes only (not text nodes)
		finalString = "";
	
	/*
	the container consists of top-level elements - p, pre, blockquote (more?)
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
	// possibly it was only an <input> element
	if(children.length === 0) return htmlNode.value;
	var len = children.length, i = 0, elm; 
	
	while(i < len){
		elm = children[i];
		finalString += topLevelElementSanitize(elm) + "\n";
		i++;
	}
	
	finalString = finalString.replace(/&nbsp;/g, " ");
	// quilljs auto inserts a \n in the end; remove it
	finalString = finalString.substring(0, finalString.length - 1);
	return finalString;
};

// if we set divMain.click, then .body gets clicked
// even when user is selecting text in it
// hence we should put a selectable but transparent
// element at the top
Snip.getClickableDOMElm = function(){
	return $.new("div").addClass("clickable");
};

// class added to .snip when it is contracted
// i.e., .body is shown with ellipsis
Snip.DOMContractedClass = "contracted";

window.Folder = function(name, list, timestamp, isSearchResultFolder){
	this.name = name;
	this.type = Generic.FOLDER_TYPE;
	this.timestamp = timestamp || Date.now();
	this.list = (list || []).slice(0);
	this.isSearchResultFolder = !!isSearchResultFolder;
	
	// only options page mutates list
	if(window.IN_OPTIONS_PAGE) observeList(this.list);
	
	function getObjectCount(type){
		return function(){
			return this.list.reduce(function(count, object){
				return object.type === type ? count + 1 : count;
			}, 0);
		};
	}
	
	this.getSnippetCount = getObjectCount(Generic.SNIP_TYPE);
	this.getFolderCount = getObjectCount(Generic.FOLDER_TYPE);
	
	this.getLastFolderIndex = function(){
		var i = 0, len = this.list.length;
		
		while(i < len && Folder.isFolder(this.list[i]))
			i++;
		
		return i - 1;
	};
	
	function adder(isSnippet){
		return function(name, body, timestamp){
			var folderName = this.name, newObj;
			
			newObj = isSnippet ?
						new Snip(name, body, timestamp) :
						new Folder(name);
			
			Folder.insertObject(newObj, this);
			
			latestRevisionLabel = "created " + newObj.type + " \"" + newObj.name + "\"";
			
			saveSnippetData(undefined, folderName, newObj.name);
		};
	}
	
	this.addSnip = adder(true);
	
	function editer(type){
		return function(oldName, newName, body){
			var object = Data.snippets.getUniqueObject(oldName, type),
				parent = object.getParentFolder();
			
			object.edit(newName, body);
			latestRevisionLabel = "edited " + type + " \"" + oldName + "\"";
			
			saveSnippetData(undefined, parent.name, newName);
		};
	}
	
	this.editSnip = editer(Generic.SNIP_TYPE);

	this.addFolder = adder(false);
	
	this.editFolder = editer(Generic.FOLDER_TYPE);

	this.edit = function(newName){
		this.name = newName;
	};

	this.getDOMElement = function(objectNamesToHighlight){
		// get prepared divMain from Generic class
		// and add click handler to the divMain and then return it
		return Generic.getDOMElement.call(this, objectNamesToHighlight)					
			.on("click", Generic.preventButtonClickOverride(this.listSnippets.bind(this)));
	};

	this.getDOMElementFull = function(objectNamesToHighlight) {
		var div = $.new("div"),
			listElm, htmlElm, emptyDiv;
		
		for(var i = 0, len = this.list.length; i < len; i++){
			listElm = this.list[i];
			htmlElm = listElm.getDOMElement(objectNamesToHighlight);
			div.appendChild(htmlElm);
		}
		console.log(this.list);
		if(len === 0){
			emptyDiv = $.new("div");
			emptyDiv.addClass("empty_folder")
					.html(this.isSearchResultFolder ?
								"No matches found" : "This folder is empty");
			div.appendChild(emptyDiv);
		}

		return div;
	};
		
	this.getUniqueObject = function(name, type){
		var index = this.getUniqueObjectIndex(name, type);
		
		if(!index) return null;
		
		var	folder = this;
		
		for(var i = 0, len = index.length; i < len; i++)		
			folder = folder.list[index[i]];
		
		return folder;
	};
	
	this.getUniqueObjectIndex = function(name, type){
		return Folder.indices[type][name.toLowerCase()];
	};
	
	function getUniqueObjectFn(type){
		return function(name){				
			return this.getUniqueObject(name, type);
		};
	}
	
	function getUniqueObjectIndexFn(type){
		return function(name){
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
	
	this.searchSnippets = function(text){
		text = escapeRegExp(text);

		return new Folder(Folder.SEARCH_RESULTS_NAME + this.name,
				this.list.reduce(function(result, listElm){
					if(Folder.isFolder(listElm))
						result = result.concat(listElm.searchSnippets(text).list);
					
					if(listElm.matchesLazy(text))
						result.push(listElm);
					
					return result;
				}, []).sort(function(a, b){
					return  b.matchesUnique(text) ? 1 :
							!a.matchesUnique(text) &&
								b.matchesWord(text) ? 1 :
							-1;
							
				}), undefined, true
			);
	};
	
	this.sort = function(filterType, descendingFlag){
		function sort(arr){
			arr.sort(function(a, b){
				return isAlphabeticSort ?
					a.name.localeCompare(b.name) :
					// default to alphabetical sort in case timestamps are same
					(a.timestamp - b.timestamp || a.name.localeCompare(b.name));
			});
			
			return descendingFlag ? arr.reverse() : arr;
		}
		
		// sort folders&snippets separately so that
		// folders are always above snippets
		var isAlphabeticSort = filterType === "alphabetic",			
			firstSnippetIndex = this.getLastFolderIndex() + 1,
			folders = this.list.slice(0, firstSnippetIndex),
			snippets = this.list.slice(firstSnippetIndex);
				
		this.list = sort(folders).concat(sort(snippets));			
		
		saveSnippetData(undefined, this.name);
	};
	
	this.listSnippets = function(objectNamesToHighlight){
		// can also be a MouseEvent (generated on click)
		objectNamesToHighlight = isObject(objectNamesToHighlight) ? 
									undefined : objectNamesToHighlight;
		$containerSnippets.html("") // first remove previous content
			.appendChild(this.getDOMElementFull(objectNamesToHighlight));
		this.insertFolderPathDOM();
	};
	
	function insertPathPartDivs(name){
		var pathPart = $.new("div").addClass("path_part"),
			rightArrow = $.new("div").addClass("right_arrow");
			
		$containerFolderPath.appendChild(pathPart.html(name));
		$containerFolderPath.appendChild(rightArrow);
	}
	
	this.insertFolderPathDOM = function(){
		$containerFolderPath.html(""); // clear previous data			
		
		if(this.isSearchResultFolder){
			insertPathPartDivs(this.name); return;
		}
		
		insertPathPartDivs(Folder.MAIN_SNIPPETS_NAME);
		
		var index = Data.snippets.getUniqueFolderIndex(this.name),
			i = 0, len = index.length, folder = Data.snippets;
		
		for(; i < len; i++){
			folder = folder.list[index[i]];
			insertPathPartDivs(folder.name);
		}
		
		Folder.implementChevronInFolderPath();
	};

	// returns array representation of this Folder object
	this.toArray = function(){
		return [this.name, this.timestamp]
				.concat(this.list.map(function(listElm){				
					return listElm.toArray();
				}));
	};

	this.getFolderSelectList = function(nameToNotShow){
		var mainContainer = $.new("div"),
			$folderName = $.new("p").html(this.name),
			childContainer, hasChildFolder = false;
		
		mainContainer.appendChild($folderName);
		
		if(this.name !== Folder.MAIN_SNIPPETS_NAME)
			mainContainer.addClass("collapsed");
		
		this.list.forEach(function(e){
			if(Folder.isFolder(e) && e.name !== nameToNotShow){
				hasChildFolder = true;
				childContainer = e.getFolderSelectList(nameToNotShow);
				childContainer.style.marginLeft = "15px";
				mainContainer.appendChild(childContainer);
			}
		});
		
		if(!hasChildFolder)
			mainContainer.addClass("empty");
		
		return mainContainer;
	};

	this.clone = function(){
		return new Folder(this.name, this.list, this.timestamp);
	};
	
	this.getUniqueSnippetAtCaretPos = function (node, pos){
		var val = getText(node), snip, stringToCheck = "",
			foundSnip = null, delimiterChar = val[pos - 1],
			lim = pos < OBJECT_NAME_LIMIT ? pos : OBJECT_NAME_LIMIT;
		
		for(var i = 1; i <= lim; i++){
			// the previous delimiter char gets added to the
			// string to check as we move towards left			
			stringToCheck = delimiterChar + stringToCheck;
			delimiterChar = val[pos - 1 - i];
			
			if((snip = this.getUniqueSnip(stringToCheck))){
				console.log(delimiterChar);
				if(Data.matchDelimitedWord && window.snipNameDelimiterListRegex){
					console.log(delimiterChar);
					// delimiter char may not exist if snip name
					// is at the beginning of the textbox
					if(!delimiterChar ||
						window.snipNameDelimiterListRegex.test(delimiterChar) ||
						delimiterChar === "\n") // a new line character is always a delimiter
						foundSnip = snip;
				}
				else foundSnip = snip;
			}
		}

		return foundSnip;
	};
	
	// parentID (optional) - if undefined, defaults to top-level
	this.createCtxMenuEntry = function(parentId){
		var id, emptyFolderText = "Empty folder ";
		
		this.list.forEach(function(object){
			id = Generic.CTX_START[object.type] + object.name;
			
			chrome.contextMenus.create({
				contexts: ["editable"],
				id: id, // unique id
				title: object.name,
				parentId: parentId
			}, function(){
				if(chrome.runtime.lastError)
					console.log("whoops!" + chrome.runtime.lastError);
				// do nothing
			});

			listOfSnippetCtxIDs.push(id);
			
			if(Folder.isFolder(object)) object.createCtxMenuEntry(id);
		});
		
		if(this.list.length === 0){
			id = emptyFolderText + this.name;

			chrome.contextMenus.create({
				contexts: ["editable"],
				id: id, // unique id
				title: emptyFolderText,
				parentId: parentId
			}, function(){
				if(chrome.runtime.lastError);
				// do nothing
			});
			
			listOfSnippetCtxIDs.push(id);
		}
	};	
};
Folder.prototype = new Generic();

// returns a Folder object based on Array
Folder.fromArray = function(arr){
	// during 2.8.0 version, first element of arr
	// was not the name of folder
	if(typeof arr[0] !== "string")
		arr.unshift(Folder.MAIN_SNIPPETS_NAME);
	
	// 2nd elm is timestamp
	if(typeof arr[1] !== "number")
		arr.splice(1, 0, Date.now());
	
	// name of folder is arr's first element
	var folder = new Folder(arr.shift(), undefined, arr.shift());
	
	folder.list = arr.map(function(listElm){
		return Array.isArray(listElm) ? 
				Folder.fromArray(listElm) :
				Snip.fromObject(listElm);
	});
	
	// only options page mutates list
	if(window.IN_OPTIONS_PAGE)
		observeList(folder.list);
	
	return folder;
};
Folder.isValidName = function(name){
	return Generic.isValidName(name, Generic.FOLDER_TYPE);
};
Folder.isFolder = function(elm){
	return elm.type === Generic.FOLDER_TYPE;
};
Folder.MAIN_SNIPPETS_NAME = "Snippets";
Folder.SEARCH_RESULTS_NAME = "Search Results in ";
Folder.CHEVRON_TEXT = "<<";
Folder.setIndices = function(){
	// indexArray is an array denoting nested levels inside folders
	function set(type, name, indexArray){
		Folder.indices[type][name.toLowerCase()] = indexArray;
	}
	
	// mainIndexArray - denotes indexArray of parent folder
	// currIndexArray - denotes indexArray of current object
	function repeat(folder, mainIndexArray){
		var indexCounter = 0, currIndexArray;
		
		set(folder.type, folder.name, mainIndexArray);
	
		folder.list.forEach(function(elm){	
			// using concat to clone arrays and hence avoid mutation
			currIndexArray = mainIndexArray.concat(indexCounter);
			
			if(Folder.isFolder(elm)) repeat(elm, currIndexArray);
			else set(elm.type, elm.name, currIndexArray);
			
			indexCounter++;
		});		
	}

	// reset
	Folder.indices = {};
	Folder.indices[Generic.FOLDER_TYPE] = {};
	Folder.indices[Generic.SNIP_TYPE] = {};
	
	repeat(Data.snippets, []);
};
Folder.copyContents = function(fromFolder, toFolder){
	fromFolder.list.forEach(function(e){
		Folder.insertObject(e.clone(), toFolder);
	});
};
Folder.insertObject = function(object, folder){
	if(Folder.isFolder(object)) folder.list.unshift(object);
	else folder.list.splice(folder.getLastFolderIndex() + 1, 0, object);
};
Folder.insertBulkActionDOM = function(listedFolder){
	var	container = $.new("div");
	
	listedFolder.list.forEach(function(listElm){
		var $generic = $.new("div").addClass("generic"),
			checkbox = $.new("input"),
			img = $.new("img"),
			div = $.new("div").addClass("name").html(listElm.name);
			
		checkbox.type = "checkbox";			
		img.src = "../imgs/" + listElm.type + ".png";
		div.on("click", function(){
			checkbox.checked = !checkbox.checked;
		});
		
		$generic.appendChild(checkbox);
		$generic.appendChild(img);			
		$generic.appendChild(div);
		container.appendChild($generic);
	});
	
	$containerSnippets.html("") // first remove previous content
		.appendChild(container);		
	
	return container;
};
Folder.getSelectedFolderInSelectList = function(selectList){
	var selectFolderName = selectList.querySelector(".selected").html();
	
	return Data.snippets.getUniqueFolder(selectFolderName);
};
Folder.refreshSelectList = function(selectList){
	selectList.html("")
		.appendChild(Data.snippets.getFolderSelectList());
	
	// select top-most "Snippets" folder; do not use fistChild as it may
	// count text nodes
	selectList.children[0].children[0].addClass("selected");
};
// do not remove newly inserted chevron as it will again exceed
// width causing recursion
Folder.implementChevronInFolderPath = function(notRemoveChevron){
	var ACTUAL_ARROW_WIDTH = 15;
	
	function computeTotalWidth(){			
		var arrowCount = 0,
			totalWidth =
				[].slice.call($containerFolderPath.children, 0).reduce(function(sum, elm){
					var isArrow = elm.hasClass("right_arrow");
					return isArrow ? (arrowCount++, sum) : sum + elm.offsetWidth;
				}, 0);
			
		// arrows, being titled, actually take up less space (falf their width)
		totalWidth += arrowCount * ACTUAL_ARROW_WIDTH;
		
		return totalWidth;
	}
	
	var width = $containerFolderPath.offsetWidth,
		totalWidth = computeTotalWidth(),
		lastPathPart = $containerFolderPath.lastChild.previousElementSibling,
		pathPart, doesChevronExist,
		folderObj = Folder.getListedFolder();
	
	if(totalWidth > width){
		pathPart = $containerFolderPath.querySelector(".path_part:not(.chevron)");
		
		if(pathPart === lastPathPart){
			pathPart.style.width = $containerFolderPath.offsetWidth
									- ACTUAL_ARROW_WIDTH - 50 // for the chevron
									+ "px";
			pathPart.addClass("ellipsized");
		}
		else{
			doesChevronExist = !!$containerFolderPath.querySelector(".chevron");
			
			// remove the right arrow
			$containerFolderPath.removeChild(pathPart.nextElementSibling);
			
			// only one chevron allowed
			if(doesChevronExist) $containerFolderPath.removeChild(pathPart);
			else pathPart.addClass("chevron").html(Folder.CHEVRON_TEXT);
			
			// recheck if width fits correctly now
			Folder.implementChevronInFolderPath(true);
		}
	}
	// clear previous chevrons
	else if(!notRemoveChevron && $containerFolderPath.querySelector(".chevron"))
		folderObj.insertFolderPathDOM();
};
Folder.getListedFolderName = function(){
	return $containerFolderPath.querySelector(":nth-last-child(2)").html();
};
Folder.getListedFolder = function(){
	var name = Folder.getListedFolderName(),
		idx = name.indexOf(Folder.SEARCH_RESULTS_NAME);
	
	if(idx != -1) name = name.substring(Folder.SEARCH_RESULTS_NAME.length);
	
	return Data.snippets.getUniqueFolder(name);
};

// inserts a combo rich (quill) and plain (textarea) textbox (default)
// inside of the $container argument with options to swap b/w the two,
// get rich/plain contents, etc.
/* "transferContents" - in case user switches from rich to plain view, he'll
lose all his formatting, so show alert box for a warning and then accordingly transfer contents
to the new shown box */
window.DualTextbox = function($container, transferContentsToShownEditor){	
	// contants/flags
	var SHOW_CLASS = "show",
		RICH_EDITOR_CONTAINER_CLASS = "rich_editor_container",
		RICH_EDITOR_CLASS = ".ql-editor",
		isCurrModePlain = true; // default is textarea
	
	// create navbar
	var $nav = $.new("DIV").addClass("nav"),
		$span = $.new("SPAN").text("Swap editor mode: "),
		$pTextarea = $.new("P").text("Textarea").addClass(SHOW_CLASS),
		$pRich = $.new("P").text("Styled textbox");		
	$pTextarea.dataset.containerSelector = "textarea";
	$pRich.dataset.containerSelector = "." + RICH_EDITOR_CONTAINER_CLASS;
	$pTextarea.dataset.editorSelector = "textarea";
	$pRich.dataset.editorSelector = RICH_EDITOR_CLASS;
	
	$nav.appendChild($span);
	$nav.appendChild($pTextarea);
	$nav.appendChild($pRich);
	$container.appendChild($nav);
	$container.addClass("dualBoxContainer"); // for applying css styling
	
	// create rich/plain boxes
	// (textarea doesn't need a container; so assume itself to be the container)
	var $textarea = $.new("TEXTAREA").addClass([SHOW_CLASS, $pTextarea.dataset.containerSelector]),
		$richEditorContainer = $.new("DIV").addClass(RICH_EDITOR_CONTAINER_CLASS),
		$richEditor = $.new("DIV"),
		quillObj;
		
	$container.appendChild($textarea);
	$richEditorContainer.appendChild($richEditor);
	$container.appendChild($richEditorContainer);
	quillObj = initializeQuill($richEditor, $richEditorContainer);
	$richEditor = $container.querySelector(RICH_EDITOR_CLASS);

	function initializeQuill($editor, $container){		
		var toolbarOptions = [
			["bold", "italic", "underline", "strike"],        // toggled buttons
			["blockquote", "code-block", "link"],

			[{ "list": "ordered"}, { "list": "bullet" }],
			[{ "script": "sub"}, { "script": "super" }],      // superscript/subscript

			[{ "size": ["small", false, "large", "huge"] }],  // custom dropdown

			[{ "color": [] }, { "background": [] }],          // dropdown with defaults from theme
			[{ "font": [] }],
			[{ "align": [] }],

			["clean"]                                         // remove formatting button
		];

		var Link = Quill.import('formats/link');		
		var builtInFunc = Link.sanitize;
		Link.sanitize = function sanitizeLinkInput(linkValueInput){
			var val = linkValueInput;
			// do nothing, since this implies user's already using a custom protocol
			if(/^\w+:/.test(val));
			else if(!/^https?:/.test(val))
				val = "http:" + val;

			return builtInFunc.call(this, val);
		};
		
		return new Quill($editor, {
			modules: {
				toolbar: toolbarOptions,				
				history: true,		
				clipboard: true
			},
			placeholder: "Expansion text goes here...",
			theme: "snow",
			bounds: $container
		});
	}
	
	// implement swapping of textbox and richEditor
	$nav.on("click", function(e){
		var node =
			(e.detail && e.detail.target) || e.target; // event delegation

		if(!(node.tagName == "P") ||
			// only show if not already shown
			node.hasClass(SHOW_CLASS)) return true;	
		
		var currShown = $container.querySelectorAll("." + SHOW_CLASS),
			currShownEditor = currShown[1],
			$newlyShownContainer, $newlyShownEditor;			
		currShown.removeClass(SHOW_CLASS);
		currShownEditor.removeAttribute("tab-index");

		// add show class to `p` and corresponding box
		node.addClass(SHOW_CLASS);
		$newlyShownContainer = $container.querySelector(node.dataset.containerSelector);
		$newlyShownEditor = $container.querySelector(node.dataset.editorSelector);
		$newlyShownContainer.addClass(SHOW_CLASS);
		$newlyShownEditor.setAttribute("tab-index", 20);
		$newlyShownEditor.focus();
		
		isCurrModePlain = !isCurrModePlain; // reverse

		if(transferContentsToShownEditor){
			// <b> tags get converted to bold formatted text (and vc-vs)
			if(isCurrModePlain) this.setPlainText(this.getRichText());
			else this.setRichText(convertBetweenHTMLTags(this.getPlainText(), true));
		}			
	}.bind(this));
		
	this.switchToDefaultView = function(){		
		$nav.trigger("click", {
			target: $pTextarea
		});
	};

	this.setPlainText = function(text){
		$textarea.text(text);
		return this;
	};
	
	this.setRichText = function(html){
		quillObj.clipboard.dangerouslyPasteHTML(html);
		return this;
	};
	
	this.setShownText = function(text){
		if(isCurrModePlain)	$textarea.value = text;
		else quillObj.clipboard.dangerouslyPasteHTML(text);
	};	
	
	this.getPlainText = function(){
		//console.log($textarea.value);
		return $textarea.value;
	};

	this.getRichText = function(){
		return Snip.makeHTMLSuitableForTextarea($richEditor);		
	};
	
	this.getShownText = function(){
		if(isCurrModePlain) return this.getPlainText();
		else return this.getRichText();
	};
};

function observeList(list){
	var watchProperties = ["push", "pop", "shift", "unshift", "splice"],
		i = 0, len = watchProperties.length, prop;
	
	for(; i < len; i++){
		prop = watchProperties[i];
		
		Object.defineProperty(list, prop, {
			configurable: false,
			enumerable: false,
			writable: false,
			value: (function(prop){
				return function(){
					// do not use list[prop] because it is already overwritten
					// and so will lead to inifinite recursion						
					var ret = [][prop].apply(list, [].slice.call(arguments, 0));												
					Folder.setIndices();
					return ret; 
				};					
			})(prop)
		});
	}
}