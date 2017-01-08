// TEMPORARY
this.switchToRichEditor = function(){
		// remove show class from `p` and corresponding box
		$container.querySelectorAll("." + SHOW_CLASS).removeClass(SHOW_CLASS);
		
		// add show class to `p` and corresponding box
		$pRich.addClass(SHOW_CLASS);
		$textarea.addClass(SHOW_CLASS);
		
		if(transferContentsToShownEditor)
			this.setPlainText(this.getRichShownText());			
		
		// finally reverse the mode
		isCurrModePlain = !isCurrModePlain;
	};
	
	this.switchToTextarea = function(){
		// remove show class from `p` and corresponding box
		$container.querySelectorAll("." + SHOW_CLASS).removeClass(SHOW_CLASS);
		
		// add show class to `p` and corresponding box
		$pTextarea.addClass(SHOW_CLASS);
		$textarea.addClass(SHOW_CLASS);
		
		if(transferContentsToShownEditor)
			this.setPlainText(this.getRichShownText());			
		
		// finally reverse the mode
		isCurrModePlain = !isCurrModePlain;
	};
