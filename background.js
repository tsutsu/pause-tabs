const OFFSET_FRAGMENT_PATTERN = /#@(\d+)x(\d+)px$/;
const PAUSABLE_URL_PATTERN = /^(http(s)?)|(data):/i;

const PAGE_ACTION_STATE_DESCRIPTIONS = {
  'pause': 'Pause tab',
  'restore': 'Restore from paused tab'
};

var getPausedTabsFolder = function(callback) {
  var createPausedTabsFolder = function(callback) {
    chrome.bookmarks.create({'parentId': '1', 'title': 'Paused Tabs'}, function(ptf) {
      localStorage.paused_tabs_folder_id = ptf.id;
      callback(ptf.id);
    });
  };

  if(!('paused_tabs_folder_id' in localStorage)) {
    return createPausedTabsFolder(callback);
  }

  var curr_ptf_id = localStorage.paused_tabs_folder_id;

  try {
    chrome.bookmarks.get(curr_ptf_id, function(ptf) {
      callback(curr_ptf_id);
    });
  } catch(e) {
    createPausedTabsFolder(callback);
  }
}

var deleteBookmarkIfExists = function(bookmark_url, callback) {
  chrome.bookmarks.search(bookmark_url, function(result_set) {
    for(var i = 0; i < result_set.length; i++) {
      var bookmark = result_set[i];

      if(bookmark.parentId === localStorage.paused_tabs_folder_id) {
        chrome.bookmarks.remove(bookmark.id);
      }
    }

    callback();
  });
};

var getPausedTabBookmarkVersion = function(source_url, found_callback, err_callback) {
  chrome.bookmarks.search(source_url, function(result_set) {
    var found_bookmark = null;

    for(var i = 0; i < result_set.length; i++) {
      var bookmark = result_set[i];

      if(bookmark.url.length > source_url.length && (bookmark.url.indexOf(source_url) === 0) && bookmark.parentId == localStorage.paused_tabs_folder_id) {
        found_bookmark = bookmark;
        break;
      }
    }

    if(found_bookmark) {
      found_callback(found_bookmark);
    } else {
      err_callback();
    }
  });
}

var pauseTab = function(tab) {
  chrome.tabs.executeScript(tab.id, {file: "pause_tab_handler.js"}, function() {
    chrome.tabs.sendMessage(tab.id, 'getPausedTabProperties', function(tab_page) {
      var save_url = tab.url.replace(/#(.*)$/, '') + '#@' + tab_page.offset.x + 'x' + tab_page.offset.y + 'px';

      getPausedTabsFolder(function(folder_id) {
        chrome.bookmarks.create({
          'parentId': folder_id,
          'title': tab_page.title,
          'url': save_url
        });
      });

      chrome.tabs.remove(tab.id);
    });
  });
};

var restorePausedTabFromBookmark = function(tab, bookmark) {
  chrome.tabs.update(tab.id, {url: bookmark.url}, function() {
    chrome.bookmarks.remove(bookmark.id);
  })
};

var restorePausedTabFromLocationHash = function(tab) {
  deleteBookmarkIfExists(tab.url, function() {
    chrome.tabs.executeScript(tab.id, {file: "restore_tab_handler.js"}, function() {
      renderPageAction(tab, 'pause');
    });
  });
}

var renderPageAction = function(tab, state) {
  chrome.pageAction.setTitle({tabId: tab.id, title: PAGE_ACTION_STATE_DESCRIPTIONS[state]});
  chrome.pageAction.setIcon({tabId: tab.id, path: {'19': ('action_' + state + '.1x.png'), '38': ('action_' + state + '.2x.png')}}, function() {
    chrome.pageAction.show(tab.id);
  });
}

chrome.pageAction.onClicked.addListener(function(tab) {
  if(!tab.url.match(PAUSABLE_URL_PATTERN)) {
    return;
  }

  getPausedTabBookmarkVersion(tab.url,
    function(bookmark) { restorePausedTabFromBookmark(tab, bookmark); },
    function() { pauseTab(tab); }
  );
});

chrome.tabs.onUpdated.addListener(function(tabId, changeInfo, tab) {
  var is_loaded = (changeInfo.status === 'complete');
  var is_pausable_url = tab.url.match(PAUSABLE_URL_PATTERN);

  if(!(is_loaded && is_pausable_url)) {
    chrome.pageAction.hide(tabId);
    return;
  }

  if(tab.url.match(OFFSET_FRAGMENT_PATTERN)) {
    restorePausedTabFromLocationHash(tab);
  } else {
    getPausedTabBookmarkVersion(tab.url,
      function(bookmark) { renderPageAction(tab, 'restore'); },
      function() { renderPageAction(tab, 'pause'); }
    );
  }
});