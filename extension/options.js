// Copyright (C) 2014 Che-Liang Chiou.


(function () {
  'use strict';

  var
    // <option> helper functions.
    getSelectedOptionValue,
    setOptions,
    setSelectedOption,
    // DOM elements.
    spreadsheetsElement,
    worksheetsElement,
    saveElement,
    verboseLevelElement,
    // Global variables.
    BASE_URL,
    State;

  BASE_URL = 'https://spreadsheets.google.com/feeds';

  spreadsheetsElement = document.getElementById('spreadsheets');
  worksheetsElement = document.getElementById('worksheets');
  saveElement = document.getElementById('save');
  verboseLevelElement = document.getElementById('verbose-level');

  State = {
    token_: null,
    spreadsheetId_: null,
    spreadsheetUpdated_: false,
    worksheetId_: null,
    worksheetUpdated_: false,

    token: function (token) {
      if (token !== undefined &&
          token !== this.token_) {
        console.log('State.token');
        this.token_ = token;
        this.next_({token: true});
      }
      return this.token_;
    },

    spreadsheetId: function (spreadsheetId) {
      if (spreadsheetId !== undefined &&
          spreadsheetId !== this.spreadsheetId_) {
        console.log('State.spreadsheetId: ' +
          this.spreadsheetId_ + ' -> ' + spreadsheetId);
        this.spreadsheetId_ = spreadsheetId;
        this.next_({spreadsheetId: true});
      }
      return this.spreadsheetId_;
    },

    worksheetId: function (worksheetId) {
      if (worksheetId !== undefined &&
          worksheetId !== this.worksheetId_) {
        console.log('State.worksheetId: ' +
          this.worksheetId_ + ' -> ' + worksheetId);
        this.worksheetId_ = worksheetId;
        this.next_({worksheetId: true});
      }
      return this.worksheetId_;
    },

    onSetOptions: function (element) {
      if (element === spreadsheetsElement) {
        console.log('State.onSetOptions: spreadsheets');
        this.spreadsheetUpdated_ = true;
        this.next_({});
      } else if (element === worksheetsElement) {
        console.log('State.onSetOptions: worksheets');
        this.worksheetUpdated_ = true;
        this.next_({});
      } else {
        console.log('State.onSetOptions: Could not recognize: ' + element);
      }
    },

    next_: function (changed) {
      var url;
      if (this.token_ && changed.token) {
        chrome.runtime.sendMessage({
          action: 'set-oauth-token',
          args: [this.token_]
        });
        this.spreadsheetUpdated_ = false;
        url = BASE_URL + '/spreadsheets/private/full';
        setOptions(url, spreadsheetsElement, this.token_);
      }
      if (this.token_ && this.spreadsheetId_ &&
          (changed.token || changed.spreadsheetId)) {
        this.worksheetUpdated_ = false;
        url = BASE_URL + '/worksheets/' + this.spreadsheetId_ + '/private/full';
        setOptions(url, worksheetsElement, this.token_);
      }
      if (this.spreadsheetId_ && this.spreadsheetUpdated_) {
        setSelectedOption(spreadsheetsElement, this.spreadsheetId_);
      }
      if (this.worksheetId_ && this.worksheetUpdated_) {
        setSelectedOption(worksheetsElement, this.worksheetId_);
      }
      if (this.spreadsheetId_ && this.worksheetId_ &&
          this.spreadsheetUpdated_ && this.worksheetUpdated_) {
        saveElement.disabled = false;
      } else {
        saveElement.disabled = true;
      }
    },
  };

  chrome.identity.getAuthToken({'interactive': true}, function (token) {
    console.log('getAuthToken()');
    if (token) {
      State.token(token);
    }
  });

  chrome.storage.sync.get(['spreadsheet-id', 'worksheet-id'], function (ids) {
    if (ids['spreadsheet-id']) {
      State.spreadsheetId(ids['spreadsheet-id']);
    }
    if (ids['worksheet-id']) {
      State.worksheetId(ids['worksheet-id']);
    }
  });

  spreadsheetsElement.addEventListener('change', function () {
    var id = getSelectedOptionValue(spreadsheetsElement);
    console.log('spreadsheets.change(): ' + id);
    if (id) {
      if (id !== State.spreadsheetId()) {
        // If spreadsheetId is changed, nullify worksheetId.
        State.worksheetId(null);
      }
      State.spreadsheetId(id);
    }
  });

  worksheetsElement.addEventListener('change', function () {
    var id = getSelectedOptionValue(worksheetsElement);
    console.log('worksheets.change(): ' + id);
    if (id) {
      State.worksheetId(id);
    }
  });

  saveElement.addEventListener('click', function () {
    if (State.spreadsheetId() === undefined ||
        State.worksheetId() === undefined) {
      return;
    }
    chrome.storage.sync.set({
      'spreadsheet-id': State.spreadsheetId(),
      'worksheet-id': State.worksheetId()
    });
    chrome.runtime.sendMessage({
      action: 'set-spreadsheet-id',
      args: [State.spreadsheetId()]
    });
    chrome.runtime.sendMessage({
      action: 'set-worksheet-id',
      args: [State.worksheetId()]
    });
  });

  chrome.storage.local.get({'verbose-level': 3}, function (items) {
    setSelectedOption(verboseLevelElement, items['verbose-level'].toString());
  });

  verboseLevelElement.addEventListener('change', function () {
    var level = parseInt(getSelectedOptionValue(verboseLevelElement), 10);
    console.log('verbose-level.change(): level=' + level);
    chrome.storage.local.set({'verbose-level': level});
    chrome.runtime.sendMessage({action: 'set-verbose-level', args: [level]});
  });

  getSelectedOptionValue = function (selectElement) {
    return selectElement.options[selectElement.selectedIndex].value;
  };

  setOptions = function (url, selectElement, token) {
    var xhr;
    xhr = new XMLHttpRequest();
    xhr.open('GET', url, true);
    xhr.setRequestHeader('Authorization', 'Bearer ' + token);
    xhr.setRequestHeader('Content-Type', 'application/atom+xml');
    xhr.onreadystatechange = function () {
      var entries, i, id, title, option;
      if (xhr.readyState !== 4) {
        return;
      }
      // Remove old children.
      while (selectElement.firstChild) {
        selectElement.removeChild(selectElement.firstChild);
      }
      // Append new children.
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
      State.onSetOptions(selectElement);
    };
    xhr.send();
  };

  setSelectedOption = function (selectElement, value) {
    var i;
    for (i = 0; i < selectElement.options.length; i++) {
      if (selectElement.options[i].value === value) {
        selectElement.options[i].selected = true;
        break;
      }
    }
  };
}());
