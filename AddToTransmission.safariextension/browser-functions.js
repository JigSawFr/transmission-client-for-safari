var locales = {};

function getExtensionVersion() {
	// Safari
	if(isSafari) {
		var r = new XMLHttpRequest();
		r.open("GET", "Info.plist", false);
		r.send(null);
		var data = r.responseText;
		var currentVersion;
		$.each($(data).find("key"), function(index, key){
			if($(key).text() == 'CFBundleVersion') {
				currentVersion = parseInt($(key).next().text());
			}
		});
		return currentVersion;
	}
	
	// Chrome
	else if(isChrome) {
		var details = chrome.app.getDetails();
		return details.version;
	}
}

function getBrowserLanguage()
{
	var language = navigator.language.toLowerCase()
	var parts = language.split('-');
	if(parts.length === 2)
		language = parts[0].toLowerCase() + '_' + parts[1].toUpperCase();
	
	return language;
}

function getLocalizedString(name, language) {
	if(typeof language === 'undefined')
		language = getBrowserLanguage();
	
	// Safari
	if(isSafari) {
		var locale = getLocale(language);
		
		if(locale !== null && typeof locale === 'object' && typeof locale[name] === 'object' && typeof locale[name]["message"] === 'string')
			return locale[name]["message"];
		
		else if(language.split('_').length == 2)
			return getLocalizedString(name, language.split('_')[0]);
		
		else if(language != "en")
			return getLocalizedString(name, "en");
		
		else
			return name;
	}
	
	// Chrome
	else if(isChrome) {
		var message = chrome.i18n.getMessage(name);
		if(message.length == 0)
			message = name;
		return message
	}
}

/**
* Returns the object with localizations for the specified language and
* caches the localization file to limit file read actions. Returns null
* if the localization is not available.
**/
function getLocale(language) {
	if(typeof locales[language] === 'object')
		return locales[language];
	else {
		try {
			var url = safari.extension.baseURI + "_locales/" + language + "/messages.json";
			var r = new XMLHttpRequest();
			r.open("GET", url, false);
			r.send(null);
			var data = $.parseJSON(r.responseText);
			locales[language] = data;
		} catch(e){
			locales[language] = null;
		}
		return locales[language];
	}
}

function createTab(url) {
	// Safari
	if(isSafari) {
		if (!url.match(/^http/)) {
			url = safari.extension.baseURI + url;
		}
		var browserWindow = safari.application.activeBrowserWindow;
		if(browserWindow == null)
			browserWindow = safari.application.openBrowserWindow();
		
		browserWindow.openTab().url = url;
	}
	
	// Chrome
	else if(isChrome) {
		chrome.tabs.create({"url":url});
	}
}

function createWindow(url) {
	if(isSafari) {
		if (!url.match(/^http/)) {
			url = safari.extension.baseURI + url;
		}
		
		var browserWindow = safari.application.openBrowserWindow();
		browserWindow.tabs[0].url = url;
	}
	else if(isChrome) {
		chrome.windows.create({url: url, focused: true});
	}
}

function setBadge(text) {
	// Safari
	if(isSafari) {
		var toolbarItems = safari.extension.toolbarItems;
		for(var i = 0; i < toolbarItems.length; i++) {
			if(toolbarItems[i].identifier == "safariTRToolbarButton")
				toolbarItems[i].badge = text;
		}
	}
	
	// Chrome
	else if(isChrome) {
		chrome.browserAction.setBadgeBackgroundColor({color:[0, 200, 0, 100]});
		chrome.browserAction.setBadgeText({text:String(text)});
	}
	
}

function getPopovers() {
	var popovers = new Array();
	// Safari
	if(isSafari) {
		$.each(safari.extension.popovers, function(index, popover) {
			popovers.push(popover.contentWindow);
		});
	}
	
	// Chrome
	else if(isChrome) {
		popovers = chrome.extension.getViews({type: 'popup'});
	}
	
	return popovers;
}

function getSafariPopoverObjects() {
	var popovers = new Array();
	// Safari
	if(isSafari) {
		$.each(safari.extension.popovers, function(index, popover) {
			popovers.push(popover);
		});
	}
	return popovers;
}

function getBackgroundPage() {
	var bp;
	// Safari
	if(isSafari) {
		bp = safari.extension.globalPage.contentWindow;
	}
	
	// Chrome
	else if(isChrome) {
		bp = chrome.extension.getBackgroundPage();
	}
	
	return bp;
}

function transferSafariSettingsToLocalStorage() {
	if(isSafari && localStorage["safariSettingsTransferred"] != "true"
							&& safari.extension.settings.getItem('url') != null
							&& safari.extension.settings.getItem('username') != null
							&& safari.extension.settings.getItem('password') != null) {
		
		var ss = safari.extension.settings;
		localStorage["protocol"] 	= ss.protocol;
		localStorage["url"]			= ss.url;
		localStorage["port"]		= ss.port;
		if(safari.extension.secureSettings.username !== undefined)
			localStorage["username"]	= safari.extension.secureSettings.username;
		if(safari.extension.secureSettings.password !== undefined)
			localStorage["password"]	= safari.extension.secureSettings.password;
		localStorage["hideSeedingTorrents"] = ss.hideSeedingTorrents;
		localStorage["updateInBackground"]	= ss.updateInBackground;
		localStorage["backgroundUpdateInterval"]	= ss.backgroundUpdateInterval;
		localStorage["firstLaunch"]	= ss.firstLaunch;
		
		safari.extension.settings.clear();
		safari.extension.secureSettings.clear()
		_gaq.push(['_trackEvent' , 'Startup' , 'Settings transfered to localStorage' ]);
		console.log("Safari settings have been transferred to localStorage");
	}
	else if(localStorage["safariSettingsTransferred"] == "true")
	{
		safari.extension.settings.clear();
		safari.extension.secureSettings.clear()
		localStorage.removeItem('safariSettingsTransferred');
		_gaq.push(['_trackEvent' , 'Startup' , 'Settings cleared' ]);
		console.log("Safari settings cleared");
	}
}

function safariCheckForUpdate()
{
	var lastCheck = localStorage["lastUpdateCheck"] || 0;
	var now = new Date().getTime();
	
	if((now-lastCheck) > 172800000) { // Two days
		//console.log('Last check for new version was more than two days ago. Checking for new version now..');
		
		var currentVersion = getExtensionVersion();
		
		$.ajax({
			type: 'GET',
			url: safariUpdateManifest,
			success: function(data) {
				// Find dictionary for this extension
				$.each($(data).find("key"), function(index, key){
					if($(key).text() == 'CFBundleIdentifier' && $(key).next().text() == 'nl.luukdobber.safaridownloadstation') {
						var dict = $(key).closest('dict');
						var updateUrl;
						// Find the latest version
						$.each(dict.find("key"), function(index, key){
							if($(key).text() == 'URL') {
								updateUrl = $(key).next().text();
							}
						});
						
						$.each(dict.find("key"), function(index, key){
							if($(key).text() == 'CFBundleVersion') {
								var latestVersion = parseInt($(key).next().text());
								compareVersions(currentVersion, latestVersion, updateUrl);
								localStorage["lastUpdateCheck"] = now;
							}
						});
					}
				});
			},
			dataType: 'xml'
		});
	} else {
		//console.log('Last update check was less than two days ago. Skip update check.');
	}
}

function compareVersions(currentVersion, latestVersion, updateUrl)
{
	if (currentVersion < latestVersion) {
		//console.log('New version with BundleVersion '+latestVersion+' available. Current BundleVersion: '+currentVersion);
		
		showNotification(
			'Synology Download Station',
			getLocalizedString('newVersionAvailable'),
			true,
			updateUrl
		);
	} else {
		//console.log('No new version of Safari Download Station available. Current BundleVersion: '+currentVersion+', hosted version: '+latestVersion+'.');
	}
}