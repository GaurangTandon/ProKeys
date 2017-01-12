
	this.switchToTextarea = function(transferContentsToShownEditor){
		// remove show class from `p` and corresponding box
		$pRich.removeClass(SHOW_CLASS);
		$richEditorContainer.removeClass(SHOW_CLASS);
		
		// add show class to `p` and corresponding box
		$pTextarea.addClass(SHOW_CLASS);
		$textarea.addClass(SHOW_CLASS).setAttribute("tab-index", 20);
		
		isCurrModePlain = !isCurrModePlain;
		
		if(transferContentsToShownEditor)
			this.setPlainText(this.getRichText());		
	};
	
	this.switchToRichEditor = function(transferContentsToShownEditor){
		// remove show class from `p` and corresponding box
		$pTextarea.removeClass(SHOW_CLASS);
		$textarea.removeClass(SHOW_CLASS);
		
		// add show class to `p` and corresponding box
		$pRich.addClass(SHOW_CLASS);
		$richEditorContainer.addClass(SHOW_CLASS);
		
		isCurrModePlain = !isCurrModePlain;
		
		if(transferContentsToShownEditor)
			this.setRichText(convertBetweenHTMLTags(this.getPlainText(), true));		
	};
