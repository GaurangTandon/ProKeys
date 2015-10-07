/*var blockedSites = [];

function escapeRegExp(str) {
	return str.replace(/[\-\[\]\/\{\}\(\)\*\+\?\.\\\^\$\|]/g, "\\$&");
}

// returns whether site is blocked by user
function isBlockedSite(domain){
	for(var i = 0, len = blockedSites.length; i < len; i++)
		if(new RegExp("^" + escapeRegExp(domain)).test(blockedSites[i]))
			return true;

	return false;
}*/
	
function injectScript(tab){
	// it's js you know!
	if (!tab || !tab.id) return;

	// loop through content scripts and execute in order
	var contentScripts = chrome.runtime.getManifest().content_scripts[0].js;
	console.log(contentScripts);
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
		title = "ProKeys successfully installed!";
		text = "Thank you for installing ProKeys! Please reload all active tabs for changes to take effect. Check out the popup box at the top-right to get started!";
		
		// inject script into all active tabs
		// so that user is not required to do manual reload
		chrome.tabs.query({}, function(tabs){
			for (var i = 0, len = tabs.length; i < len; i++) {
				injectScript(tabs[i]);
			}
		});
	}else if(details.reason === "update"){
		version = chrome.runtime.getManifest().version;
		title = "ProKeys successfully updated to v" + version;
		text = "Please reload active tabs to use new version, which gives you a faster and better ProKeys :)";
	}

	// either update or install was there
	if(text !== void 0){
		// the empty function and string is required < Chrome 42
		chrome.notifications.create("", {
			type: "basic",
			iconUrl: "imgs/r.png",
			title: title,
			message: text
		}, function(id){});
	}
});
/*
chrome.runtime.onMessage.addListener(function(msg, sender){
	var url;
	
	if(msg == "updateDB")
		DB_load();
});

chrome.contextMenus.create({
	type: "normal",
	id: "block",
	title: "Block this site",
});

chrome.tabs.onUpdated.addListener(updateContextMenuStr);

var blockContextStr, blockURL;


function updateContextMenuStr(id, tab){
	if(tab.status == "loading"){
		
		console.log(tab.url);
		setTimeout(updateContextMenuStr, 500, tab);
		return;
	}
	
	console.log("loaded");
	
	var url = tab.url.match(/(\w+\.)*\w+\.\w+/);
		
	if(url && url.length > 1){
		url = url[0];
		blockURL = url;
	
		blockContextStr = (isBlockedSite(url) ? "Unblock " : "Block ")  + url;
	}else{
		blockContextStr = "Unknown site.."
	}
	
	chrome.contextMenus.update("block", {
		title: blockContextStr
	});
}

chrome.tabs.onActivated.addListener(function(info){
	chrome.tabs.get(info.tabId, updateContextMenuStr);
});

chrome.contextMenus.onClicked.addListener(function(info, tab){
	var id = info.menuItemId,
		url = info.pageUrl;	
	
	addRemoveBlockedSite(blockURL, /Block/.test(blockContextStr), tab.id);
});

function addRemoveBlockedSite(url, flag, tab){
	if(flag)
		blockedSites.push(url);
	else
		blockedSites.splice(blockedSites.indexOf(url), 1);
	
	console.log({blockSites: blockedSites});
	
	if(tab){
		chrome.tabs.sendMessage(tab, {blockSites: blockedSites});
	}	
}*/