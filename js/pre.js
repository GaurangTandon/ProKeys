/* global $, getHTML triggerEvent, setHTML, isContentEditable */

// custom functions inspired from jQuery
// special thanks to
// bling.js - https://gist.github.com/paulirish/12fb951a8b893a454b32 

function setNodeListProp(prop, func){
	// in case of custom created array of Nodes, Array.prototype is necessary
	Array.prototype[prop] = NodeList.prototype[prop] = function() {
		var args = [].slice.call(arguments, 0);
		this.forEach(function(node) {
			func.apply(node, args);
		});
		return this;
	};
	
	Node.prototype[prop] = func;
}

(function(){
	window.OBJECT_NAME_LIMIT = 30;
	window.MONTHS = ["January", "February", "March",
					"April", "May", "June", "July", "August", "September",
					"October", "November", "December"];
	window.DAYS = ["Sunday", "Monday", "Tuesday",
							"Wednesday", "Thursday", 
							"Friday", "Saturday"];
	
	NodeList.prototype.__proto__ = Array.prototype;
	
	// used for triggering context menu event
	// on window object
	window.triggerEvent = function(node, eventName, obj){
		var ev = new CustomEvent(eventName, {
			detail: obj || null
		});
		// those functions which need to access
		// the custom values will need to separately
		// access the "detail" property, in such a way:
		// (ev.detail && ev.detail[requiredProperty]) || ev[requiredProperty]
		// because if detail is not passed it's always null

		node.dispatchEvent(ev);
	};
	
	setNodeListProp("trigger", function(eventName, obj){
		triggerEvent(this, eventName, obj);
	});
	
	window.$ = function(selector){
		var elms = document.querySelectorAll(selector), elm;
		
		// cannot always return a NodeList/Array
		// as properties like firstChild, lastChild will only be able
		// to be accessed by elms[0].lastChild which is too cumbersome
		if(elms.length === 1){
			elm = elms[0];
			// so that I can access the length of the returned
			// value else length if undefined
			elm.length = 1;
			return elm;
		}
		else return elms;				
	};
	
	$.new = function(tagName){
		return document.createElement(tagName);
	};

	setNodeListProp("on", window.on = function (name, fn, useCapture) {
		var names = name.split(/,\s*/g);
		
		for(var i = 0, len = names.length; i < len; i++)
			this.addEventListener(names[i], fn, useCapture);
		
		return this;
	});
	
	// inserts the newNode after `this`
	setNodeListProp("insertAfter", function(newNode){
		this.parentNode.insertBefore(newNode, this.nextSibling);
		return this;
	});

	// returns true if element has class; usage: Element.hasClass("class")
	setNodeListProp("hasClass", function(className) {
		return this.className && new RegExp("(^|\\s)" + className + "(\\s|$)").test(this.className);
	});

	setNodeListProp("toggleClass", function(cls){
		this.classList.toggle(cls);
		return this;
	});
	
	setNodeListProp("addClass", function(cls){
		// multiple classes to add
		if(!Array.isArray(cls))
			cls = [cls];

		cls.forEach(function(e){
			this.classList.add(e);
		}.bind(this));		
		
		return this;
	});
	
	setNodeListProp("removeClass", function(cls){
		// multiple classes to remove
		if(!Array.isArray(cls))
			cls = [cls];

		cls.forEach(function(e){
			this.classList.remove(e);
		}.bind(this));		
		
		return this;
	});
	
	setNodeListProp("isTextBox", function(){
		return this.tagName === "INPUT" || this.tagName === "TEXTAREA";
	});
	
	// returns innerText
	window.getText = function(node){
		return getHTML(node, "innerText");
	};
	
	// sets innerText
	window.setText = function(node, newVal){
		return setHTML(node, newVal, "innerText");
	};
	
	window.getHTML = function(node, prop){
		if(!node) return;
		/*console.dir(node);
		console.dir(node.nodeType);console.dir(node.textContent.replace(/\u00a0/g, " "));*/
		
		if(isTextNode(node))
			return node.textContent.replace(/\u00a0/g, " ");
		
		switch(node.tagName){
			case "TEXTAREA":
			case "INPUT":
				return node.value;
			default:
				return node[prop || "innerHTML"];
		}	
	};
	
	window.setHTML = function(node, newVal, prop){	
		// in case number is passed; .replace won't work
		newVal = newVal.toString();
		
		if(isTextNode(node)){
			node.textContent = newVal.replace(/ /g, "\u00a0");
			return node;
		}
		
		switch(node.tagName){
			case "TEXTAREA":
			case "INPUT":
				node.value = newVal.replace("<br>", "\n")
									.replace("&nbsp;", " "); break;
			default:
//				console.log(newVal);
				if(prop === "innerText")
					// but innertext will collapse consecutive spaces
					// do not use textContent as it will collapse even single newlines
					node.innerText = newVal.replace("<br>", "\n")
											.replace("&nbsp;", " ");
				// first .replace is required as at the end of any text
				// as gmail will not display single space for unknown reason
				else {
					try{
						node.innerHTML = newVal.replace(/ $/g, "&nbsp;")
											.replace(/ {2}/g, " &nbsp;")
											.replace(/\n/g, "<br>");
					}catch(e){
						console.log("From setHTML: `node` argment is undefined");
					}
				}
		}
		
		return node;
	};
	
	// prototype alternative for setHTML/getHTML
	// use only when sure that Node is "not undefined"
	setNodeListProp("html", function(textToSet, prop){		
		// can be zero/empty string; make sure it's undefined
		return typeof textToSet !== "undefined" ?
				setHTML(this, textToSet, prop) :
				getHTML(this, prop);
	});
	
	// prototype alternative for setText/getText
	// use only when sure that Node is "not undefined"
	setNodeListProp("text", function(textToSet){	
		// can be zero/empty string; make sure it's undefined
		return this.html(textToSet, "innerText");
	});
	
	setNodeListProp("unwrap", function(){
		var children = this.childNodes,
			nextSibling = this.nextSibling, child,
			len = children.length,
			parent = this.parentNode;
		
		while(len > 0){
			child = children[len - 1];
			
			if(nextSibling) 
				parent.insertBefore(child, nextSibling);		
			else parent.appendChild(child);
			
			nextSibling = child;
			len--;
		}
		
		parent.removeChild(this);
	});
	
	// replaces string's `\n` with `<br>` or reverse
	// `convertForHTML` - true => convert text for display in html div (`.innerHTML`)
	// false => convrt text for dislplay in text area (`.value`)
	window.convertBetweenHTMLTags = function(string, convertForHTML){
		var map = [["<br>", "\\n"], [" &nbsp;", "  "]],		
			regexIndex = +convertForHTML, replacerIdx = +!convertForHTML, elm,
			i = 0, len = map.length;
		
		for(; i < len; i++){
			elm = map[i];
			string = string.replace(new RegExp(elm[regexIndex], "g"), elm[replacerIdx]);
		}
		
		var container = $.new("div").html(string),
			selector = "pre + br, blockquote + br, li + br, ol > br, ol + br, ul + br, ul > br",
			unnecessaryBRs = container.querySelectorAll(selector),
			count = unnecessaryBRs.length;
		
		for(i = 0; i < count; i++){
			elm = unnecessaryBRs[i];
			elm.parentNode.removeChild(elm);
		}

		return container.innerHTML.replace(/&nbsp; ?&nbsp;<li>/g, "<li>");
	};
	
	window.isEmpty = function(obj) {
		for(var prop in obj)
			if(obj.hasOwnProperty(prop))
				return false;
		
		return true;
	};
	
	window.escapeRegExp = function(str) {
		return str.replace(/[\-\[\]\/\{\}\(\)\*\+\?\.\\\^\$\|]/g, "\\$&");
	};

	// prepends 0 to single digit num and returns it
	// as a string
	window.padNumber = function(num){
		num = parseInt(num, 10);
		
		return (num <= 9 ? "0" : "") + num;
	};
	
	window.getFormattedDate = function(timestamp){
		var d = (timestamp ? new Date(timestamp) : new Date()).toString();

		// sample date would be:
		// "Sat Feb 20 2016 09:17:23 GMT+0530 (India Standard Time)"
		return d.substring(4, 15);
	};
	
	window.isObject = function(o){
		return Object.prototype.toString.call(o) === "[object Object]";
	};
	
	// should use this since users may use foreign language
	// characters which use up more than two bytes
	window.lengthInUtf8Bytes = function(str) {
		// Matches only the 10.. bytes that are non-initial characters in a multi-byte sequence.
		var m = encodeURIComponent(str).match(/%[89ABab]/g);
		return str.length + (m ? m.length : 0);
	};

	window.isTextNode = function(node){
		return node.nodeType === 3;
	};
	
	// if it is a callForParent, means that a child node wants 
	// to get its parents checked
	window.isContentEditable = function(node, callForParent){
		var tgN = node && node.tagName,
			attr, parentCount, parent, MAX_PARENTS_CHECKED = 3;

		// insanity checks first
		if(!node || tgN === "TEXTAREA" || tgN === "INPUT" || !node.getAttribute)
			return false;
		else{
			attr = node.getAttribute("contenteditable");
	
			// empty string to support <element contenteditable> markup
			if(attr === "" || attr === "true" || attr === "plaintext-only")
				return true;		
			
			// important part below
			// note that if we introduce a snippet
			// then it generates <span> elements in contenteditable `div`s
			// but they don't have content-editable true attribute
			// so they fail the test, hence, here is a new check for them
			// search if their parents are contenteditable
			// but only do this if the current node is not a textarea
			// which we have checked above

			if(callForParent) return false;
			
			parentCount = 1;
			parent = node;

			do{
				parent = parent.parentNode;
				parentCount++;

				if(!parent) return false;
				// parent check call
				if(isContentEditable(parent, true)) return true;
			}while(parentCount <= MAX_PARENTS_CHECKED);

			return false;
		}
	};

	window.checkRuntimeError = function(){
		if(chrome.runtime.lastError){
			alert("An error occurred! Please press Ctrl+Shift+J/Cmd+Shift+J, copy whatever is shown in the 'Console' tab and report it at my email: prokeys.feedback@gmail.com . This will help me resolve your issue and improve my extension. Thanks!");
			console.log(chrome.runtime.lastError);
			return true;
		}
	};
})();