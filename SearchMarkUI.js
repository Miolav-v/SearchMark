// SearchMarkUI.js: SearchMark front-end
// Copyright (C) 2010 Candy Yiu, and Akshay Dua
// GNU General Public License

$(document).ready(function() {
  // Устанавливаем слушатель сообщений от background.js
  chrome.runtime.onMessage.addListener((result) => {
    processSearchResult(result);
  });

  localStorage.setItem('uivisits', (parseInt(localStorage.getItem('uivisits') || 0) + 1));

  if (localStorage.getItem('uivisits') < 4) {
    $('#welcomesearchbox').append(
      '<div id="tiparea"><p><b>Tip:</b> Use "*". For example, to search for words beginning with "mar", type "mar*".</div>'
    );
  }
  if (localStorage.getItem('uivisits') == 3) {
    $('#tiparea').delay(3000).fadeOut('slow');
  }

  $('#searchbox').focus();
  $('#searchbox').keyup(function(e) {
    if (e.keyCode == 13) {
      leavePage('#welcomepage');
    }
  });

  $('#searchbutton').click(function() {
    leavePage('#welcomepage');
  });
});

function requestCachedPage(id) {
  chrome.runtime.sendMessage({ method: 'cached', bookmarkid: id });
}

var resultspagename = '#resultspage';

var results_page_top_html =
  '<div id="topsearch">' +
  '<table><tr>' +
  '<th id="thlogo"><img src="images/logotext-results.png"/></th>' +
  '<th id="thsearchbox"><input type="text" id="searchbox" class="searchbox"/>' +
  '<button type="button" id="searchbutton" class="searchbutton">Search</button></th>' +
  '</tr></table>' +
  '</div>';

function doSearch(searchwords) {
  $('body').append('<div id="resultspage"></div>');
  $('#resultspage').append(results_page_top_html);
  $('#resultspage').append('<div id="resultspagebtm"></div>');
  $('#resultspage #searchbutton').click(function() {
    leavePage(resultspagename);
  });

  chrome.runtime.sendMessage({ method: 'search', keywords: searchwords });
}

function leavePage(pagename) {
  var searchwords = $('#searchbox').val();
  $(pagename).remove();
  $('body').css('cursor', 'wait');
  doSearch(searchwords );
}

function processSearchResult(result) {
  if (result.matchType == "DONE") {
    $('body').css('cursor', 'auto');
    let resultString = result.error ? result.error : " ";
    $('#searchbox').focus();
    $('#searchbox').keyup(function(e) {
      if (e.keyCode == 13) {
        leavePage('#resultspage');
      }
    });
    $('#resultspagebtm').append(resultString);
  } else {
    let img = result.img == "" ? '<img src="" alt="No Image Available" width=400 />' : '<img src="' + result.img + '" width=400 />';
    let resultString =
      '<a href="' + result.url + '" target="_blank">' + result.title + '</a>' +
      '<br/>' + result.text + '<br/>' +
      '<span class="resulturl">' + result.url + '</span> ' +
      '<a href="#" class="resultactions">(Offline Version)</a><br/>' + img + '<p><br/>';
    $('#resultspagebtm').append(resultString);
    $('#resultspagebtm .resultactions').last().click(function() {
      requestCachedPage(result.id);
    });
  }
}
