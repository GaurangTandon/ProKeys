// TEMPORARY
// previous code of navigation bar switcher of dual textbox might help when we implement "preview" snippets feature
$nav.on("click", (function(currObj){  // preserve ref without `bind`ing handler		
		return function(e){
			var node = e.target, parent, // event delegation
				newlyShownEditor;
				
			if(!(node.tagName == "P") ||
				// only show if not already shown
				node.hasClass(SHOW_CLASS)) return true;	

			parent = this.parentNode;
			// remove show class from `p` and corresponding box
			parent.querySelectorAll("." + SHOW_CLASS).removeClass(SHOW_CLASS);
			
			// add show class to `p` and corresponding box
			node.addClass(SHOW_CLASS);
			newlyShownEditor = parent.querySelector(node.dataset.selector);
			newlyShownEditor.addClass(SHOW_CLASS);
			newlyShownEditor.setAttribute("tab-index", )
			
			if(transferContentsToShownEditor){
				// <b> tags get converted to bold formatted text
				// and vice-versa
				// (mode still not reversed because have to use getPlain"Shown"Text;
				// so if isCurrModePlain => text taken from curr textarea and pasted
				// into rich editor)
				if(isCurrModePlain)
					currObj.setRichText(convertBetweenHTMLTags(currObj.getPlainShownText(), true));
				else currObj.setPlainText(currObj.getRichShownText());
			}
			
			// finally reverse the mode
			isCurrModePlain = !isCurrModePlain;
		};
	})(this));
