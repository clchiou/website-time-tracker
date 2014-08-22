// Copyright (C) 2014 Che-Liang Chiou.


(function () {
  'use strict';

  var BASE_URL, FILE_NAME, Dom, State,
    // Helper functions.
    getUrl, download,
    // <option> helper functions.
    getSelectedOptionValue, setOptions, setSelectedOption;

  BASE_URL = 'https://spreadsheets.google.com/feeds';

  FILE_NAME = 'tracking-data.csv';

  Dom = {
    spreadsheets: document.getElementById('spreadsheets'),
    worksheets: document.getElementById('worksheets'),
    save: document.getElementById('save'),
    download: document.getElementById('download'),
    verbose: document.getElementById('verbose'),
  };

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
      var id;
      if (element === Dom.spreadsheets) {
        console.log('State.onSetOptions: spreadsheets');
        this.spreadsheetUpdated_ = true;
        if (this.spreadsheetId_) {
          this.next_({});
        } else {
          id = getSelectedOptionValue(Dom.spreadsheets);
          console.log('State.onSetOptions: id=' + id);
          if (id) {
            this.spreadsheetId_ = id;
            this.next_({spreadsheetId: true});
          }
        }
      } else if (element === Dom.worksheets) {
        console.log('State.onSetOptions: worksheets');
        this.worksheetUpdated_ = true;
        if (this.worksheetId_) {
          this.next_({});
        } else {
          id = getSelectedOptionValue(Dom.worksheets);
          console.log('State.onSetOptions: id=' + id);
          if (id) {
            this.worksheetId_ = id;
            this.next_({worksheetId: true});
          }
        }
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
        setOptions(url, Dom.spreadsheets, this.token_);
      }
      if (this.token_ && this.spreadsheetId_ &&
          (changed.token || changed.spreadsheetId)) {
        this.worksheetUpdated_ = false;
        url = BASE_URL + '/worksheets/' + this.spreadsheetId_ + '/private/full';
        setOptions(url, Dom.worksheets, this.token_);
      }
      if (this.spreadsheetId_ && this.spreadsheetUpdated_) {
        setSelectedOption(Dom.spreadsheets, this.spreadsheetId_);
      }
      if (this.worksheetId_ && this.worksheetUpdated_) {
        setSelectedOption(Dom.worksheets, this.worksheetId_);
      }
      if (this.spreadsheetId_ && this.worksheetId_ &&
          this.spreadsheetUpdated_ && this.worksheetUpdated_) {
        Dom.save.disabled = false;
        Dom.download.disabled = false;
      } else {
        Dom.save.disabled = true;
        Dom.download.disabled = true;
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

  Dom.spreadsheets.addEventListener('change', function () {
    var id = getSelectedOptionValue(Dom.spreadsheets);
    console.log('spreadsheets.change(): ' + id);
    if (id) {
      if (id !== State.spreadsheetId()) {
        // If spreadsheetId is changed, nullify worksheetId.
        State.worksheetId(null);
      }
      State.spreadsheetId(id);
    }
  });

  Dom.worksheets.addEventListener('change', function () {
    var id = getSelectedOptionValue(Dom.worksheets);
    console.log('worksheets.change(): ' + id);
    if (id) {
      State.worksheetId(id);
    }
  });

  Dom.save.addEventListener('click', function () {
    if (!State.spreadsheetId() || !State.worksheetId()) {
      return;
    }
    console.log('save.click: ' +
      State.spreadsheetId() + ' ' + State.worksheetId());
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

  Dom.download.addEventListener('click', function () {
    if (!State.token() || !State.spreadsheetId() || !State.worksheetId()) {
      return;
    }
    console.log('download.click: ' +
      State.spreadsheetId() + ' ' + State.worksheetId());
    download(State.token(), State.spreadsheetId(), State.worksheetId(),
      FILE_NAME, 'text/csv');
  });

  chrome.storage.local.get({'verbose-level': 3}, function (items) {
    setSelectedOption(Dom.verbose, items['verbose-level'].toString());
  });

  Dom.verbose.addEventListener('change', function () {
    var level = parseInt(getSelectedOptionValue(Dom.verbose), 10);
    console.log('verbose.change(): level=' + level);
    chrome.storage.local.set({'verbose-level': level});
    chrome.runtime.sendMessage({action: 'set-verbose-level', args: [level]});
  });

  getUrl = function (url, token, onReady) {
    var xhr = new XMLHttpRequest();
    xhr.open('GET', url, true);
    xhr.setRequestHeader('Authorization', 'Bearer ' + token);
    xhr.setRequestHeader('Content-Type', 'application/atom+xml');
    xhr.onreadystatechange = function () {
      if (xhr.readyState === 4) {
        onReady(xhr);
      }
    };
    xhr.send();
  };

  download = function (token, spreadsheetId, worksheetId, name, type) {
    var url = BASE_URL +
      '/list/' + spreadsheetId + '/' + worksheetId + '/private/full';
    getUrl(url, token, function (xhr) {
      var rows, blob, size;
      // Fetch rows.
      rows = xhr.responseXML.getElementsByTagName('entry');
      rows = Array.prototype.map.call(rows, function (entry) {
        var row = {};
        Array.prototype.forEach.call(entry.childNodes, function (node) {
          ['url', 'start', 'end'].forEach(function (name) {
            if (node.tagName === 'gsx:' + name) {
              row[name] = node.textContent;
            }
          });
        });
        return row;
      });
      // Construct a blob.
      rows = rows.map(function (row) {
        return (row.url   || '') + '\t' +
               (row.start || '') + '\t' +
               (row.end   || '') + '\n';
      });
      rows.splice(0, 0, 'url\tstart\tend\n');
      blob = new Blob(rows, {type: type});
      // Write to a file.
      size = 10 * 1024 * 1024;  // 10MB.
      window.webkitRequestFileSystem(window.TEMPORARY, size, function (fs) {
        fs.root.getFile(name, {create: true}, function (entry) {
          entry.createWriter(function (writer) {
            writer.onwriteend = function () {
              console.log('writer.write: open a new window for download');
              window.open(entry.toURL(type));
            };
            writer.onerror = function (error) {
              console.log('writer.write: ' + error.code);
            };
            writer.write(blob);
          }, function (error) {
            console.log('createWriter: ' + error.code);
          });
        }, function (error) {
          console.log('getFile: ' + error.code);
        });
      }, function (error) {
        console.log('webkitRequestFileSystem: ' + error.code);
      });
    });
  };

  getSelectedOptionValue = function (selectElement) {
    return selectElement.options[selectElement.selectedIndex].value;
  };

  setOptions = function (url, selectElement, token) {
    getUrl(url, token, function (xhr) {
      var entries, i, id, title, option;
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
    });
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
