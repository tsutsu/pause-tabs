chrome.extension.onMessage.addListener(function(request, sender, sendResponse) {
	if(request !== 'getPausedTabProperties') {
		return;
	}

	sendResponse({
		title: document.title,

		offset: {
			x: window.pageXOffset,
			y: window.pageYOffset
		}
	});
});