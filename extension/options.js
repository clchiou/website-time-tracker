// Copyright (C) 2014 Che-Liang Chiou.


(function () {
  'use strict';

  var onSetSpreadsheet, onSetWorksheet, onSetVerboseLevel,
    onRetrieveToken, getSelectedOptionValue, addOptions,
    spreadsheetsElement, worksheetsElement, verboseLevelElement,
    baseUrl, oauthToken;

  baseUrl = 'https://spreadsheets.google.com/feeds';
  oauthToken = undefined;

  spreadsheetsElement = document.getElementById('spreadsheets');
  worksheetsElement = document.getElementById('worksheets');
  verboseLevelElement = document.getElementById('verbose-level');

  onSetSpreadsheet = function () {
    var apiUrl, id = getSelectedOptionValue(spreadsheetsElement);
    console.log('onSetSpreadsheet (): id=' + id);
    chrome.runtime.sendMessage({action: 'set-spreadsheet-id', args: [id]});
    chrome.storage.sync.set({'spreadsheet-id': id});
    apiUrl = baseUrl + '/worksheets/' + id + '/private/full';
    addOptions(apiUrl, worksheetsElement, oauthToken);
  };

  onSetWorksheet = function () {
    var id = getSelectedOptionValue(worksheetsElement);
    console.log('onSetWorksheet (): id=' + id);
    chrome.runtime.sendMessage({action: 'set-worksheet-id', args: [id]});
    chrome.storage.sync.set({'worksheet-id': id});
  };

  onSetVerboseLevel = function () {
    var level = parseInt(getSelectedOptionValue(verboseLevelElement), 10);
    console.log('onSetVerboseLevel(): level=' + level);
    chrome.runtime.sendMessage({action: 'set-verbose-level', args: [level]});
    chrome.storage.local.set({'verbose-level': level});
  };

  onRetrieveToken = function (token) {
    var apiUrl;
    oauthToken = token;
    chrome.runtime.sendMessage({action: 'set-oauth-token', args: [token]});
    apiUrl = baseUrl + '/spreadsheets/private/full';
    addOptions(apiUrl, spreadsheetsElement, oauthToken);
  };

  getSelectedOptionValue = function (element) {
    return element.options[element.selectedIndex].value;
  };

  addOptions = function (apiUrl, selectElement, token) {
    var xhr;
    xhr = new XMLHttpRequest();
    xhr.open('GET', apiUrl, true);
    xhr.setRequestHeader('Authorization', 'Bearer ' + token);
    xhr.setRequestHeader('Content-Type', 'application/atom+xml');
    xhr.onreadystatechange = function () {
      var entries, i, id, title, option;
      if (xhr.readyState !== 4) {
        return;
      }
      entries = xhr.responseXML.getElementsByTagName('entry');
      for (i = 0; i < entries.length; i++) {
        id = entries[i].getElementsByTagName('id')[0].textContent.split('/');
        id = id[id.length - 1];
        title = entries[i].getElementsByTagName('title')[0].textContent;
        // Create new element.
        option = document.createElement('option');
        option.value = id;
        option.text = title;
        selectElement.appendChild(option);
      }
    };
    xhr.send();
  };

  spreadsheetsElement.addEventListener('change', onSetSpreadsheet);
  worksheetsElement.addEventListener('change', onSetWorksheet);
  verboseLevelElement.addEventListener('change', onSetVerboseLevel);

  // Retrieve OAuth Token.
  chrome.identity.getAuthToken({'interactive': true}, function (token) {
    console.log('getAuthToken()');
    if (token) {
      onRetrieveToken(token);
    }
  });

  chrome.storage.local.get({'verbose-level': 3}, function (items) {
    var i, level = items['verbose-level'];
    chrome.runtime.sendMessage({action: 'set-verbose-level', args: [level]});
    for (i = 0; i < verboseLevelElement.options.length; i++) {
      if (parseInt(verboseLevelElement[i].value, 10) === level) {
        verboseLevelElement[i].selected = true;
        break;
      }
    }
  });
}());
