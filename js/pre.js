// custom functions inspired from jQuery
// special thanks to
// bling.js - https://gist.github.com/paulirish/12fb951a8b893a454b32 
(function(){
	window.SNIP_NAME_LIMIT = 25;
	window.SNIP_BODY_LIMIT = 2000;
	
	window.$ = function(selector){
		var elms = document.querySelectorAll(selector);

		// return single element in case only one is found
		return elms.length > 1 ? elms : elms[0];
	};

	Node.prototype.on = window.on = function (name, fn, useCapture) {
		this.addEventListener(name, fn, useCapture);
	};

	NodeList.prototype.__proto__ = Array.prototype;

	NodeList.prototype.on = NodeList.prototype.addEventListener = function (name, fn) {
		this.forEach(function (elem) {
			elem.on(name, fn);
		});
	};

	// inserts the newNode after `this`
	Node.prototype.insertAfter =  function(newNode){
		this.parentNode.insertBefore(newNode, this.nextSibling);
	};

	// returns true if element has class; usage: Element.hasClass("class")
	Node.prototype.hasClass = function(className) {
		return this.className && new RegExp("(^|\\s)" + className + "(\\s|$)").test(this.className);
	};

	Node.prototype.toggleClass = function(cls){
		if(this.hasClass(cls)) this.classList.remove(cls);
		else this.classList.add(cls);
	};

	// replaces `this` with `newElm`; `newElm` is a string; returns new element
	Node.prototype.replaceWith = function(newElm, newClass, id, textToReplace){
		// string newClass, id, textToReplace (optional: to dictate which text should be in replaced element)
		// string event containing innerHTML of element

		var parent = this.parentNode,
			// new element ready
			newElement = document.createElement(newElm);

		if(newClass){
			newClass = newClass.split(" ");
			for(var i = 0; newClass[i]; i++)
				newElement.toggleClass(newClass[i]);
		}

		if(id) newElement.id = id;

		var mode = newElement.isTextBox() ? "makeHTML" : "makeEntity";

		// if should `replaceText`, get text from old and set it in new; always `formatHTML`
		if(textToReplace)
			setText(newElement, formatHTML(textToReplace, mode));
		else 
			setText(newElement, formatHTML(getText(this), mode));

		// perform replace function
		parent.replaceChild(newElement, this);

		// return original element
		return newElement;
	};

	Node.prototype.isTextBox = function(){
		return this.tagName === "INPUT" || this.tagName === "TEXTAREA";
	};

	window.getText = function(node){
		if(!node) return;
		
		var googleBool = window.isGoogle || false;
		
		switch(node.tagName){
			case "DIV":
				// return innerText to avoid div's and replace &nbsp with space
				return (googleBool ? node.innerText.replace(/\u00A0/g, " ") : node.innerHTML)
								.replace(/&nsbp;/g, " ").replace(/<br>/g, "\n");
			case "P":
			case "BUTTON":
			case "BODY":
			case "UL":
			case "SPAN":
			case "PRE":
				return node.innerHTML.replace(/&nsbp;/g, " ").replace(/<br>/g, "\n");
			case "TEXTAREA":
			case "INPUT":
				return node.value;
		}

		if(node.nodeType == 3)
			return node.textContent;
	};

	window.setText = function(node, newVal){
		var googleBool = window.isGoogle || false;
		
		switch(node.tagName){
			case "DIV":
				node.innerHTML = (googleBool ? newVal.replace(/\u00A0/g, " ") : newVal).replace(/ {2}/g, " &nbsp;").replace(/\n/g, "<br>");
				break;
			case "TEXTAREA":
			case "INPUT":
				node.value = newVal; break;
			case "BODY":
			case "UL":
			case "PRE":
			case "P":
			case "BUTTON":
			case "SPAN":
				node.innerHTML = newVal.replace(/ {2}/g, " &nbsp;").replace(/\n/g, "<br>");
				break;
		}
	};
	
	// replaces string's `<` with `&gt' or reverse; sop to render html as text and not html
	// in snip names and bodies
	window.formatHTML = function(string, mode){
		// gt-to-> = makeHTML

		if(mode == "makeHTML")
			return string.replace(/&gt;/g, ">").replace(/&lt;/g, "<");
		else
			return string.replace(/>/g, "&gt;").replace(/</g, "&lt;");
	};
	
	window.cloneObject = function(obj) {
		var clone = {}, elm;

		for(var i in obj) {
			elm = obj[i];
			clone[i] = Object.prototype.toString.call(elm) == "[object Object]" ? 
				cloneObject(elm) : elm;
		}
		return clone;
	};
	
	window.isEmpty = function(obj) {
		for(var prop in obj) {
			if(obj.hasOwnProperty(prop))
				return false;
		}
		return true;
	};
	
	window.escapeRegExp = function(str) {
		return str.replace(/[\-\[\]\/\{\}\(\)\*\+\?\.\\\^\$\|]/g, "\\$&");
	};
})();