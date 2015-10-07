function injectScript(tab){
	// it's js you know!
	if (!tab || !tab.id) return;

	// loop through content scripts and execute in order
	var contentScripts = chrome.runtime.getManifest().content_scripts[0].js;
	
	for (var i = 0, len = contentScripts.length; i < len; i++){
		if(!/chrome:\/\//.test(tab.url))
			chrome.tabs.executeScript(tab.id, {
				file: contentScripts[i]
			});
	}
}
	
chrome.runtime.onInstalled.addListener(function(details){
	var text, title, version;
	
	if(details.reason === "install"){
		title = "ProKeys installed successfully!";
		text = "Thank you for installing ProKeys! Please reload all active tabs for changes to take effect. Check out the popup box at the top-right to get started!";
	}else if(details.reason === "update"){
		version = chrome.runtime.getManifest().version;
		title = "ProKeys updated successfully to v" + version;
		text = "Please reload active tabs to use new version. Major changes:\nArithmetic support in date/time macros. For more, visit the changelog in \"About\" page.";
	}

	// either update or install was there
	if(text !== void 0){
		// the empty function and string is required < Chrome 42
		chrome.notifications.create("", {
			type: "basic",
			iconUrl: "imgs/logo128.png",
			title: title,
			message: text
		}, function(id){});
	}
});

chrome.runtime.onMessage.addListener(function(msg, sender){
	if(msg == "inject"){
		// inject script into all active tabs
		// so that user is not required to do manual reload
		chrome.tabs.query({}, function(tabs){
			for (var i = 0, len = tabs.length; i < len; i++) {
				injectScript(tabs[i]);
			}
		});
	}
});
