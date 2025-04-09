// parseUri 1.2.2
// (c) Steven Levithan <stevenlevithan.com>
// MIT License
function parseUri(str) {
  var o = parseUri.options,
      m = o.parser[o.strictMode ? "strict" : "loose"].exec(str),
      uri = {},
      i = 14;
  while (i--) uri[o.key[i]] = m[i] || "";
  uri[o.q.name] = {};
  uri[o.key[12]].replace(o.q.parser, function ($0, $1, $2) {
    if ($1) uri[o.q.name][$1] = $2;
  });
  return uri;
}
parseUri.options = {
  strictMode: false,
  key: ["source","protocol","authority","userInfo","user","password","host","port","relative","path","directory","file","query","anchor"],
  q: {
    name: "queryKey",
    parser: /(?:^|&)([^&=]*)=?([^&]*)/g
  },
  parser: {
    strict: /^(?:([^:\/?#]+):)?(?:\/\/((?:(([^:@]*)(?::([^:@]*))?)?@)?([^:\/?#]*)(?::(\d*))?))?((((?:[^?#\/]*\/)*)([^?#]*))(?:\?([^#]*))?(?:#(.*))?)/,
    loose: /^(?:(?![^:@]+:[^:@\/]*@)([^:\/?#.]+):)?(?:\/\/)?((?:(([^:@]*)(?::([^:@]*))?)?@)?([^:\/?#]*)(?::(\d*))?)(((\/(?:[^?#](?![^?#\/]*\.[^?#\/.]+(?:[?#]|$)))*\/?)?([^?#\/]*))(?:\?([^#]*))?(?:#(.*))?)/
  }
};

// SearchMark back-end
// Copyright (C) 2010 Akshay Dua, and Candy Yiu
// GNU General Public License

// GLOBALS
var SearchMarkDB = {};
var gPort;
var uiHighlightStart = '<span class=highlight>';
var uiHighlightEnd = '</span>';
var uiEllipses = '<b>...</b>';
var uiContextLen = -30;

// DATABASE API
SearchMarkDB.db = null;
SearchMarkDB.open = function() {
  try {
    var dbSize = 200 * 1024 * 1024; // 200 MB
    SearchMarkDB.db = window.openDatabase('SearchMarkDB', '1.0', 'Bookmark Page Storage', dbSize);
  } catch (e) {
    console.error("Failed to open database: " + e.message);
  }
};

SearchMarkDB.createTable = function() {
  if (!SearchMarkDB.db) return;
  SearchMarkDB.db.transaction(
    function(tx) {
      tx.executeSql('CREATE VIRTUAL TABLE IF NOT EXISTS pages USING fts3(id INTEGER PRIMARY KEY, url TEXT, title TEXT, page TEXT, time INTEGER, img TEXT)',
        [], () => console.debug("Created pages table"), (tx, e) => console.error("Failed to create pages: " + e.message));
      tx.executeSql('CREATE TABLE IF NOT EXISTS rawpages (id INTEGER PRIMARY KEY, htmlpage TEXT)',
        [], () => console.debug("Created rawpages table"), (tx, e) => console.error("Failed to create rawpages: " + e.message));
    }
  );
};

SearchMarkDB.addBookmarkedPage = function(newId, newUrl, newTitle, newPlainPage, newTime, newPageImg, newHtmlPage) {
  if (!SearchMarkDB.db) return;
  SearchMarkDB.db.transaction(
    function(tx) {
      tx.executeSql('INSERT INTO pages(id, url, title, page, time, img) VALUES (?,?,?,?,?,?)',
        [newId, newUrl, newTitle, newPlainPage, newTime, newPageImg],
        () => console.debug("Inserted page: " + newId + " " + newUrl),
        (tx, e) => console.error("Failed to insert page: " + e.message));
      tx.executeSql('INSERT INTO rawpages(id, htmlpage) VALUES (?,?)',
        [newId, newHtmlPage],
        () => console.debug("Inserted raw page: " + newId + " " + newUrl),
        (tx, e) => console.error("Failed to insert raw page: " + e.message));
    }
  );
};

SearchMarkDB.removeBookmarkedPage = function(theId) {
  if (!SearchMarkDB.db) return;
  SearchMarkDB.db.transaction(
    function(tx) {
      tx.executeSql('DELETE FROM pages WHERE id=?', [theId],
        () => console.debug("Removed page: " + theId),
        (tx, e) => console.error("Failed to remove page: " + e.message));
      tx.executeSql('DELETE FROM rawpages WHERE id=?', [theId],
        () => console.debug("Removed raw page: " + theId),
        (tx, e) => console.error("Failed to remove raw page: " + e.message));
    }
  );
};

SearchMarkDB.updateBookmarkedPage = function(theId, theUrl, theTitle, thePlainPage, theTime, thePageImg, theHtmlPage) {
  if (!SearchMarkDB.db) return;
  SearchMarkDB.db.transaction(
    function(tx) {
      tx.executeSql('UPDATE pages SET url=?, title=?, page=?, img=? WHERE id=?',
        [theUrl, theTitle, thePlainPage, thePageImg, theId],
        () => console.debug("Updated page: " + theUrl),
        (tx, e) => console.error("Failed to update page: " + e.message));
      tx.executeSql('UPDATE rawpages SET htmlpage=? WHERE id=?',
        [theHtmlPage, theId],
        () => console.debug("Updated raw page: " + theUrl),
        (tx, e) => console.error("Failed to update raw page: " + e.message));
    }
  );
};

SearchMarkDB.getStoredBookmarks = function() {
  if (!SearchMarkDB.db) return;
  SearchMarkDB.db.transaction(
    function(tx) {
      tx.executeSql('SELECT id,url,title FROM pages', [],
        (tx, r) => {
          for (let i = 0; i < r.rows.length; i++) {
            console.log("Stored page: " + r.rows.item(i).url);
          }
        },
        (tx, e) => console.error("Failed to get pages: " + e.message));
      tx.executeSql('SELECT id FROM rawpages', [],
        (tx, r) => console.log("Raw pages count: " + r.rows.length),
        (tx, e) => console.error("Failed to get raw pages: " + e.message));
    }
  );
};

SearchMarkDB.getRawHtmlPage = function(id, callback) {
  if (!SearchMarkDB.db) return;
  SearchMarkDB.db.transaction(
    function(tx) {
      tx.executeSql('SELECT htmlpage FROM rawpages WHERE id = ?', [id],
        callback,
        (tx, e) => console.error("Failed to get raw page: " + e.message));
    }
  );
};

SearchMarkDB.doSearch = function(callback, keywords) {
  if (!SearchMarkDB.db) return;
  SearchMarkDB.db.transaction(
    function(tx) {
      tx.executeSql('SELECT id,url,title,img,snippet(pages, "' + uiHighlightStart + '", "' + uiHighlightEnd + '", "' + uiEllipses + '", -1, ' + uiContextLen + ') as snippet FROM pages WHERE pages MATCH ? ORDER BY time DESC',
        [keywords],
        callback,
        (tx, e) => console.error("Search failed: " + e.message));
    }
  );
};

SearchMarkDB.clear = function() {
  if (!SearchMarkDB.db) return;
  SearchMarkDB.db.transaction(
    function(tx) {
      tx.executeSql('DELETE FROM pages', [],
        () => console.debug("Cleared pages"),
        (tx, e) => console.error("Failed to clear pages: " + e.message));
      tx.executeSql('DELETE FROM rawpages', [],
        () => console.debug("Cleared rawpages"),
        (tx, e) => console.error("Failed to clear rawpages: " + e.message));
    }
  );
};

SearchMarkDB.purge = function() {
  if (!SearchMarkDB.db) return;
  SearchMarkDB.db.transaction(
    function(tx) {
      tx.executeSql('DROP TABLE IF EXISTS pages', [],
        () => console.debug("Dropped pages"),
        (tx, e) => console.error("Failed to drop pages: " + e.message));
      tx.executeSql('DROP TABLE IF EXISTS rawpages', [],
        () => console.debug("Dropped rawpages"),
        (tx, e) => console.error("Failed to drop rawpages: " + e.message));
    }
  );
};

// CORE
SearchMarkDB.open();
console.debug("Opened SearchMark database.");

if (!localStorage.getItem('newversion')) {
  localStorage.setItem('newversion', '2.5');
}
if (!localStorage.getItem('oldversion')) {
  localStorage.setItem('oldversion', '1.1');
}
if (parseFloat(localStorage.getItem('newversion')) > parseFloat(localStorage.getItem('oldversion'))) {
  if (localStorage.getItem('initialized')) {
    console.log("Upgrading to version " + localStorage.getItem('newversion'));
    doUpgrade();
  }
  localStorage.setItem('oldversion', localStorage.getItem('newversion'));
}

init();

chrome.action.onClicked.addListener((tab) => {
  chrome.tabs.create({ url: chrome.runtime.getURL('SearchMarkUI.html') });
});

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.method == 'search') {
    gPort = { postMessage: (msg) => sendResponse(msg) }; // Mock port for compatibility
    console.debug("search " + request.keywords);
    SearchMarkDB.doSearch(searchBookmarkedPagesCb, "'" + request.keywords + "'");
    return true; // Keep message channel open
  } else if (request.method == 'cached') {
    SearchMarkDB.getRawHtmlPage(request.bookmarkid, (tx, r) => displayRawPage(tx, r));
    console.debug("cache request " + request.bookmarkid);
    sendResponse();
  } else {
    sendResponse();
  }
});

chrome.bookmarks.onChanged.addListener((id, changeInfo) => {
  if (!localStorage.getItem('initialized')) return;
  getAndStoreBookmarkContent(
    { id: id, url: changeInfo.url, title: changeInfo.title, time: 0 },
    SearchMarkDB.updateBookmarkedPage
  );
});

chrome.bookmarks.onCreated.addListener((id, newBookmark) => {
  localStorage.setItem('totalbookmarks', (parseInt(localStorage.getItem('totalbookmarks') || 0) + 1));
  if (!localStorage.getItem('initialized')) return;
  getAndStoreBookmarkContent(
    { id: id, url: newBookmark.url, title: newBookmark.title, time: newBookmark.dateAdded },
    SearchMarkDB.addBookmarkedPage
  );
});

chrome.bookmarks.onRemoved.addListener((id, removeInfo) => {
  localStorage.setItem('totalbookmarks', (parseInt(localStorage.getItem('totalbookmarks') || 0) - 1));
  if (!localStorage.getItem('initialized')) return;
  SearchMarkDB.removeBookmarkedPage(id);
});

// CORE API
function init() {
  console.log("Initializing...");
  if (localStorage.getItem('added') && localStorage.getItem('totalbookmarks') &&
      localStorage.getItem('added') != localStorage.getItem('totalbookmarks')) {
    cleanupStorage();
  }
  if (!localStorage.getItem('initialized') || localStorage.getItem('initialized') == '0') {
    SearchMarkDB.createTable();
    chrome.bookmarks.getTree((bookmarks) => {
      localStorage.setItem('added', '0');
      localStorage.setItem('totalbookmarks', '0');
      initBookmarkDatabase(bookmarks);
    });
    localStorage.setItem('uivisits', '0');
    localStorage.setItem('initialized', '1');
  } else {
    localStorage.setItem('initialized', (parseInt(localStorage.getItem('initialized')) + 1));
  }
}

function doUpgrade() {
  if (localStorage.getItem('oldversion')) cleanupStorage();
}

function cleanupStorage() {
  console.log("Cleaning up...");
  console.log("Clearing database tables");
  SearchMarkDB.clear();
  console.log("Removing the tables");
  SearchMarkDB.purge();
  console.log("Setting to 'not initialized'");
  localStorage.setItem('initialized', '0');
}

function handleRequest(request, sender, callback) {
  // Legacy function, kept for compatibility
}

function displayRawPage(tx, r) {
  if (r.rows.length) {
    chrome.tabs.create({ url: chrome.runtime.getURL('rawPageView.html') }, (tab) => {
      chrome.runtime.sendMessage({ name: "rawPageView", html: r.rows.item(0).htmlpage });
    });
  } else {
    console.log("Error: Page not cached. Please file a bug report.");
  }
}

function searchBookmarkedPagesCb(tx, r) {
  var result = {};
  for (let i = 0; i < r.rows.length; i++) {
    result.matchType = "page";
    result.id = r.rows.item(i).id;
    result.url = r.rows.item(i).url;
    result.title = r.rows.item(i).title;
    result.text = r.rows.item(i).snippet;
    result.img = r.rows.item(i).img;
    console.log(result.img);
    gPort.postMessage(result);
    result = {};
  }
  result.matchType = "DONE";
  gPort.postMessage(result);
}

function removeHTMLfromPage(page) {
  var pagetxt = page.replace(/\s+/gm, " ");
  pagetxt = pagetxt.replace(/<\s*?head.*?>.*?<\s*?\/\s*?head\s*?>/i, " ");
  pagetxt = pagetxt.replace(/<\s*?script.*?>.*?<\s*?\/\s*?script\s*?>/gi, " ");
  pagetxt = pagetxt.replace(/<\s*?style.*?>.*?<\s*?\/\s*?style\s*?>/gi, " ");
  pagetxt = pagetxt.replace(/<.*?\/?>/g, " ");
  pagetxt = pagetxt.replace(/&.*?;/g, " ");
  pagetxt = pagetxt.replace(/(<!--|-->)/g, " ");
  pagetxt = pagetxt.replace(/\s+/gm, " ");
  return pagetxt;
}

function extractPageImg(page, url) {
  var imgstart = page.indexOf("<img", 0);
  if (imgstart == -1) return "";
  var srcstart = page.indexOf("src", imgstart);
  if (srcstart == -1) return "";
  var quote = '"';
  srcstart = page.indexOf(quote, srcstart);
  if (srcstart == -1) {
    quote = "'";
    srcstart = page.indexOf(quote, srcstart);
  }
  if (srcstart == -1) return "";
  var srcend = page.indexOf(quote, srcstart + 1);
  if (srcend == -1) return "";
  var src = page.substring(srcstart + 1, srcend);
  if (src.indexOf("://", 0) != -1) {
    // Full path
  } else if (src[0] == '/') {
    if (src[1] == '/') src = src.substring(2);
    else src = parseUri(url).host + src;
  } else {
    src = parseUri(url).host + parseUri(url).directory + src;
  }
  console.debug("extracted image: " + src + ", url: " + url);
  return src;
}

function getAndStoreBookmarkContent(bookmark, storeInDB) {
  try {
    var xhr = new XMLHttpRequest();
    xhr.open("GET", bookmark.url, true);
    xhr.onreadystatechange = function() {
      try {
        if (this.readyState == 4) {
          var pageNoHtml = removeHTMLfromPage(this.responseText);
          storeInDB(
            bookmark.id,
            bookmark.url,
            bookmark.title,
            pageNoHtml,
            bookmark.dateAdded,
            extractPageImg(this.responseText, bookmark.url),
            this.responseText
          );
          this.abort();
        }
      } catch (e) {
        console.log(e.message);
        storeInDB(bookmark.id, bookmark.url, bookmark.title, bookmark.dateAdded, "", "", "");
      }
    };
    xhr.send();
  } catch (e) {
    console.log(e.message + bookmark.url);
    storeInDB(bookmark.id, bookmark.url, bookmark.title, bookmark.dateAdded, "", "", "");
  }
}

function initBookmarkDatabase(bookmarks) {
  bookmarks.forEach((bookmark) => {
    if (bookmark.url && bookmark.url.match("^https?://*")) {
      console.debug("Adding " + bookmark.url);
      localStorage.setItem('totalbookmarks', (parseInt(localStorage.getItem('totalbookmarks') || 0) + 1));
      getAndStoreBookmarkContent(bookmark, SearchMarkDB.addBookmarkedPage);
    } else {
      console.debug("Skipping. " + bookmark.url);
    }
    if (bookmark.children) initBookmarkDatabase(bookmark.children);
  });
}
