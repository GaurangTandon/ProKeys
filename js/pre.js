// custom functions inspired from jQuery
// special thanks to
// bling.js - https://gist.github.com/paulirish/12fb951a8b893a454b32 
(function(){
	window.SNIP_NAME_LIMIT = 25;
	window.SNIP_BODY_LIMIT = 2000;
	window.MONTHS = ["January", "February", "March",
					"April", "May", "June", "July", "August", "September",
					"October", "November", "December"];
	window.snipLimits = {
		"name": SNIP_NAME_LIMIT,
		"Name": SNIP_NAME_LIMIT,
		"input": SNIP_NAME_LIMIT,
		"body": SNIP_BODY_LIMIT,
		"Body": SNIP_BODY_LIMIT,
		"textarea": SNIP_BODY_LIMIT
	};
	
	function hasEvent(elm, type) {
		return type in elm.pEvents;
	}

	function addRemoveEvent(elm, type, callback, isAdder) {
		if (isAdder) elm.pEvents[type] = callback;
		else delete elm.pEvents[type];
	}

	function makeListener(name, isAdder) {
		var f = EventTarget.prototype[name + "EventListener"];

		return function (type, callback, capture) {
			// pEvents -> prokeys events
			if(!this.pEvents) this.pEvents = {};

			var has = hasEvent(this, type);

			// event has already been added with
			// another or same listener
			// so first remove it
			if (isAdder && has)
				this.removeEventListener(type, this.pEvents[type]);			
			
			f.call(this, type, callback, capture);
			addRemoveEvent(this, type, callback, isAdder);

			return true;
		};
	}

	EventTarget.prototype.addEventListener = makeListener("add", true);
	EventTarget.prototype.removeEventListener = makeListener("remove", false);
	
	window.$ = function(selector){
		var elms = document.querySelectorAll(selector);

		// return single element in case only one is found
		return elms.length > 1 ? elms : elms[0];
	};

	Node.prototype.on = window.on = function (name, fn, useCapture) {
		this.addEventListener(name, fn, useCapture);
		return this;
	};

	NodeList.prototype.__proto__ = Array.prototype;

	NodeList.prototype.on = NodeList.prototype.addEventListener = function (name, fn) {
		this.forEach(function (elem) {
			elem.on(name, fn);
		});
		return this;
	};

	// inserts the newNode after `this`
	Node.prototype.insertAfter =  function(newNode){
		this.parentNode.insertBefore(newNode, this.nextSibling);
		return this;
	};

	// returns true if element has class; usage: Element.hasClass("class")
	Node.prototype.hasClass = function(className) {
		return this.className && new RegExp("(^|\\s)" + className + "(\\s|$)").test(this.className);
	};

	Node.prototype.toggleClass = function(cls){
		if(this.hasClass(cls)) this.classList.remove(cls);
		else this.classList.add(cls);
		return this;
	};
	
	Node.prototype.addClass = function(cls){
		// multiple classes to add
		if(Array.isArray(cls)){
			cls.forEach(function(e){
				this.addClass(e);
			}.bind(this));
			return this;
		}
		
		this.classList.add(cls);
		return this;
	};
	
	Node.prototype.removeClass = function(cls){
		// multiple classes to remove
		if(Array.isArray(cls)){
			cls.forEach(function(e){
				this.removeClass(e);
			}.bind(this));
			return this;
		}
		
		this.classList.remove(cls);
		return this;
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

		// if should `replaceText`, get text from old and set it in new; always `formatTextForNodeDisplay`		
		setHTML(newElement, formatTextForNodeDisplay(newElement, textToReplace || getHTML(this)));

		// perform replace function
		parent.replaceChild(newElement, this);

		// return original element
		return newElement;
	};

	Node.prototype.isTextBox = function(){
		return this.tagName === "INPUT" || this.tagName === "TEXTAREA";
	};

	Node.prototype.trigger = function(eventName, obj){
		var ev = new CustomEvent(eventName, obj || {});
		
		this.dispatchEvent(ev);
	};
	
	// returns innerText
	window.getText = function(node){
		return getHTML(node, "innerText");
	};
	
	// sets innerText
	window.setText = function(node, newVal){
		return setHTML(node, newVal, "innerText");
	};
	
	// prototype alternative for setText/getText
	// use only when sure that Node is "not undefined"
	Node.prototype.text = function(textToSet){		
		// can be zero/empty string; make sure it's undefined
		return this.html(textToSet, "innerText");
	};
	
	window.getHTML = function(node, prop){
		if(!node) return;
		
		var googleBool = window.isGoogle || false;
		
		// prop used by getText
		prop = prop || "innerHTML";
		
		if(node.nodeType == 3)
			return node.textContent;
		
		switch(node.tagName){
			case "DIV":
				// return innerText to avoid div's and replace &nbsp with space
				return (googleBool ? node.innerText.replace(/\u00A0/g, " ") : node[prop])
								.replace(/&nsbp;/g, " ").replace(/<br>/g, "\n");
			case "TEXTAREA":
			case "INPUT":
				return node.value;
			default:
				return node[prop].replace(/&nsbp;/g, " ").replace(/<br>/g, "\n");			
		}	
	};
	
	window.setHTML = function(node, newVal, prop){
		var googleBool = window.isGoogle || false;
		
		// in case number is passed; .replace won't work
		newVal = newVal.toString();
		
		// prop used by setText
		prop = prop || "innerHTML";
		
		if(node.nodeType === 3){
			node.textContent = newVal;
			return node;
		}
		
		switch(node.tagName){
			case "DIV":
				node[prop] = (googleBool ? newVal.replace(/\u00A0/g, " ") : newVal).replace(/ {2}/g, " &nbsp;").replace(/\n/g, "<br>");
				break;
			case "TEXTAREA":
			case "INPUT":
				node.value = newVal; break;
			default:
				node[prop] = newVal.replace(/ {2}/g, " &nbsp;").replace(/\n/g, "<br>");
				break;
		}	
		
		return node;
	};
	
	// prototype alternative for setHTML/getHTML
	// use only when sure that Node is "not undefined"
	Node.prototype.html = function(textToSet, prop){		
		// can be zero/empty string; make sure it's undefined
		return typeof textToSet !== "undefined" ?
				setHTML(this, textToSet, prop) :
				getHTML(this, prop);
	};
	
	// replaces string's `<` with `&gt' or reverse; sop to render html as text and not html
	// in snip names and bodies
	window.formatTextForNodeDisplay = function(node, string, overwrite){
		var mode = overwrite || (node.isTextBox() ? "makeHTML" : "makeEntity");
		
		if(mode == "makeHTML")
			return string.replace(/&gt;/g, ">").replace(/&lt;/g, "<");
		else
			return string.replace(/>/g, "&gt;").replace(/</g, "&lt;");
	};
	
	window.setTextForNode = function(node, text){
		setHTML(node, formatTextForNodeDisplay(node, text));
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

	// prepends 0 to single digit num and returns it
	// as a string
	window.padNumber = function(num){
		num = parseInt(num, 10);
		
		return (num <= 9 ? "0" : "") + num;
	};
	
	window.getFormattedDate = function(){
		var d = new Date(),
			date = padNumber(parseInt(d.getDate(), 10));

		return MONTHS[d.getMonth()] + " " + date + ", " + d.getFullYear();
	};
	
	// Returns a function, that, as long as it continues to be invoked, will not
	// be triggered. The function will be called after it stops being called for
	// N milliseconds. If `immediate` is passed, trigger the function on the
	// leading edge, instead of the trailing.
	window.debounce = function(func, wait, immediate) {
		var timeout;
		
		return function() {
			var context = this, args = arguments;
			var later = function() {
				timeout = null;
				if (!immediate) func.apply(context, args);
			};
			var callNow = immediate && !timeout;
			clearTimeout(timeout);
			timeout = setTimeout(later, wait);
			if (callNow) func.apply(context, args);
		};
	};

	window.isObject = function(o){
		return Object.prototype.toString.call(o) === "[object Object]";
	};
})();