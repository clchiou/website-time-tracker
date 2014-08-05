// Copyright (C) 2014 Che-Liang Chiou.


(function () {
  'use strict';

  var Tracker, Uploader, Log;

  Tracker = {
    STOPPED: 'stopped',
    STARTED: 'started',
    PAUSED: 'paused',

    state: 'stopped',
    currentUrl: null,
    startTime: null,
    beginTime: null,
    active: null,

    start: function () {
      Log.d('start(): ' + this.toString());
      if (this.state !== this.STOPPED) {
        Log.w('start(): state !== STOPPED : state === ' + this.state);
        return;
      }
      this.state = this.STARTED;
      this.startTime = this.beginTime = new Date();
      this.active = 0.0;
      Log.d('start(): startTime=' + this.startTime);
    },

    pause: function () {
      Log.d('pause(): ' + this.toString());
      if (this.state !== this.STARTED) {
        Log.w('pause(): state !== STARTED: state === ' + this.state);
        return;
      }
      this.state = this.PAUSED;
      this.computeTime();
      this.beginTime = null;
    },

    resume: function () {
      Log.d('resume(): ' + this.toString());
      if (this.state !== this.PAUSED) {
        Log.w('resume(): state !== PAUSED: state === ' + this.state);
        return;
      }
      this.state = this.STARTED;
      this.beginTime = new Date();
      Log.d('resume(): beginTime=' + this.beginTime);
    },

    stop: function () {
      Log.d('stop(): ' + this.toString());
      var endTime = new Date();
      if (this.state !== this.STARTED && this.state !== this.PAUSED) {
        Log.w('stop(): state !== STARTED && state !== PAUSED: ' +
            'state === ' + this.state);
        return;
      }
      this.computeTime();
      if (this.currentUrl !== null) {
        Uploader.upload(this.currentUrl, this.startTime, endTime, this.active);
      }
      this.state = this.STOPPED;
      this.currentUrl = null;
      this.startTime = null;
      this.beginTime = null;
      this.active = null;
    },

    computeTime: function () {
      var endTime, seconds;
      if (this.beginTime === null) {
        return;
      }
      endTime = new Date();
      seconds = (endTime - this.beginTime) / 1000.0;
      Log.d('computeTime(): endTime=' + endTime + ', seconds=' + seconds);
      this.active += seconds;
    },

    toString: function () {
      return 'Tracker(' +
        'state=' + this.state + ', ' +
        'currentUrl=' + this.currentUrl + ', ' +
        'startTime=' + this.startTime + ', ' +
        'beginTime=' + this.beginTime + ', ' +
        'active=' + this.active + ')';
    },
  };

  Uploader = {
    baseUrl: 'https://spreadsheets.google.com/feeds',
    token: '',
    spreadsheetId: '',
    worksheetId: '',

    setToken: function (token) {
      Log.i('setToken()');
      this.token = token;
    },

    setSpreadsheetId: function (spreadsheetId) {
      Log.i('setSpreadsheetId()');
      this.spreadsheetId = spreadsheetId;
    },

    setWorksheetId: function (worksheetId) {
      Log.i('setWorksheetId()');
      this.worksheetId = worksheetId;
    },

    upload: function (url, start, end, active) {
      Log.i('upload(): url=' + url + ', ' +
          'start=' + start + ', end=' + end + ', active=' + active);
      var xhr, apiUrl, xml;
      if (this.token === '' || url === null || url === '' ||
          this.spreadsheetId === '' || this.worksheetId === '') {
        return;
      }
      // Create worksheet row.
      xml = document.implementation.createDocument(
        'http://www.w3.org/2005/Atom',
        'entry',
        null
      );
      xml.documentElement.setAttribute('xmlns', 'http://www.w3.org/2005/Atom');
      xml.documentElement.setAttribute(
        'xmlns:gsx',
        'http://schemas.google.com/spreadsheets/2006/extended'
      );
      xml.documentElement.appendChild(this.makeElement('url', url));
      xml.documentElement.appendChild(this.makeElement('start', start));
      xml.documentElement.appendChild(this.makeElement('end', end));
      xml.documentElement.appendChild(this.makeElement('active', active));
      // Send it to the spreadsheet.
      xhr = new XMLHttpRequest();
      apiUrl = this.baseUrl + '/list/' + this.spreadsheetId + '/' +
        this.worksheetId + '/private/full';
      xhr.open('POST', apiUrl, true);
      xhr.setRequestHeader('Authorization', 'Bearer ' + this.token);
      xhr.setRequestHeader('Content-Type', 'application/atom+xml');
      xhr.send(xml);
    },

    makeElement: function (name, value) {
      var element;
      element = document.createElement('gsx:' + name);
      element.textContent = value;
      return element;
    },
  };

  Log = {
    SILENCE: 0,
    ERROR: 1,
    WARNING: 2,
    INFO: 3,
    DEBUG: 4,

    // Default to INFO.
    level: 3,

    setVerboseLevel: function (level) {
      this.level = level;
    },

    e: function (message) {
      if (this.level >= this.ERROR) {
        this.print('ERR  ', message);
      }
    },

    w: function (message) {
      if (this.level >= this.WARNING) {
        this.print('WARN ', message);
      }
    },

    i: function (message) {
      if (this.level >= this.INFO) {
        this.print('INFO ', message);
      }
    },

    d: function (message) {
      if (this.level >= this.DEBUG) {
        this.print('DEBUG', message);
      }
    },

    print: function (label, message) {
      console.log(label + ': ' + message);
    },
  };

  // Manage tab life cycle.
  chrome.tabs.onRemoved.addListener(function () {
    Log.d('onRemoved()');
    Tracker.stop();
  });

  chrome.tabs.onActivated.addListener(function () {
    // Stop the old, and start the new.
    Log.d('onActivated()');
    Tracker.stop();
    Tracker.start();
  });

  // Retrieve tab's URL.
  chrome.tabs.onUpdated.addListener(function (tabId, changeInfo) {
    Log.d('onUpdated(): ' +
      'tabId=' + tabId + ', changeInfo.url=' + changeInfo.url);
    if (typeof changeInfo.url === 'string') {
      if (Tracker.currentUrl !== changeInfo.url) {
        Tracker.stop();
        Tracker.currentUrl = changeInfo.url;
      }
    }
    if (changeInfo.status === 'complete') {
      Tracker.start();
    }
  });

  // Manage prerendering or instant of tabs.
  chrome.tabs.onReplaced.addListener(function (addedTabId) {
    chrome.tabs.get(addedTabId, function (tab) {
      Log.d('onReplaced(): ' +
        'tab.url=' + tab.url + ', Tracker.currentUrl=' + Tracker.currentUrl);
      if (typeof tab.url === 'string') {
        Tracker.currentUrl = tab.url;
      }
    });
  });

  // Monitor idle states.
  chrome.idle.onStateChanged.addListener(function (newState) {
    Log.d('onStateChanged(): newState=' + newState);
    if (newState === 'active') {
      Tracker.resume();
    } else {
      Tracker.pause();
    }
  });

  // Receive configurations from options.html
  chrome.runtime.onMessage.addListener(function (request) {
    Log.d('onMessage(): request.action=' + request.action);
    if (request.action === 'set-spreadsheet-id') {
      Uploader.setSpreadsheetId(request.args[0]);
    } else if (request.action === 'set-worksheet-id') {
      Uploader.setWorksheetId(request.args[0]);
    } else if (request.action === 'set-verbose-level') {
      Log.setVerboseLevel(request.args[0]);
    } else if (request.action === 'set-oauth-token') {
      Uploader.setToken(request.args[0]);
    }
  });

  // Retrieve OAuth Token.
  chrome.identity.getAuthToken({'interactive': true}, function (token) {
    Log.d('getAuthToken()');
    if (token) {
      Uploader.setToken(token);
    }
  });

  // Retrieve spreadsheet-id and worksheet-id.
  chrome.storage.sync.get(['spreadsheet-id', 'worksheet-id'], function (ids) {
    if (ids['spreadsheet-id']) {
      Uploader.setSpreadsheetId(ids['spreadsheet-id']);
    }
    if (ids['worksheet-id']) {
      Uploader.setWorksheetId(ids['worksheet-id']);
    }
  });
}());
