// Copyright (C) 2014 Che-Liang Chiou.


(function () {
  'use strict';

  var DefaultDict, Tracker, Uploader, Log, isUndefined, onFocus, onBlur,
    trackers, activatedTabId;

  DefaultDict = function (build, dummy) {
    if (!(this instanceof DefaultDict)) {
      return new DefaultDict(build, dummy);
    }
    this.build_ = build;
    this.dummy_ = dummy;
    this.dict_ = {};
  };

  DefaultDict.prototype.get = function (key) {
    if (isUndefined(key)) {
      return this.dummy_;
    }
    if (!this.dict_.hasOwnProperty(key)) {
      this.dict_[key] = this.build_(key);
    }
    return this.dict_[key];
  };

  DefaultDict.prototype.remove = function (key) {
    if (isUndefined(key) || !this.dict_.hasOwnProperty(key)) {
      return this.dummy_;
    }
    var value = this.dict_[key];
    delete this.dict_[key];
    return value;
  };

  Tracker = function (tabId) {
    if (!(this instanceof Tracker)) {
      return new Tracker(tabId);
    }
    this.tabId_ = tabId;
    this.url_ = undefined;
    this.start_ = undefined;
  };

  Tracker.prototype.url = function (url) {
    if (!isUndefined(url) && this.url_ !== url) {
      Log.d(this.m_('url', this.url_ + ' -> ' + url));
      this.url_ = url;
    }
    return this.url_;
  };

  Tracker.prototype.start = function () {
    if (!isUndefined(this.start_)) {
      // Tracker was started already.
      return;
    }
    this.start_ = new Date();
    Log.d(this.m_('start', this.start_));
    return this;
  };

  Tracker.prototype.stop = function () {
    var end, duration;
    if (isUndefined(this.start_)) {
      // Tracker was not started.
      return this;
    }
    if (isUndefined(this.url_)) {
      Log.w(this.m_('stop', 'Tracker has no url'));
    }
    end = new Date();
    duration = (end - this.start_) / 1000.0;
    Log.d(this.m_('stop', 'duration=' + duration, 'end=' + end));
    if (!isUndefined(this.url_)) {
      Uploader.upload(this.url_, this.start_, end);
    }
    this.start_ = undefined;
    return this;
  };

  Tracker.prototype.cancel = function () {
    if (isUndefined(this.start_)) {
      // Tracker was not started.
      return this;
    }
    Log.d(this.m_('cancel', 'url=' + this.url_));
    this.start_ = undefined;
    return this;
  };

  Tracker.prototype.m_ = function (methodName) {
    var args = Array.prototype.slice.call(arguments, 1);
    return methodName + '(' + this.tabId_ + '): ' + args.join(', ');
  };

  Uploader = {
    url_: 'https://spreadsheets.google.com/feeds',
    token_: undefined,
    spreadsheet_: undefined,
    worksheet_: undefined,

    token: function (token) {
      if (!isUndefined(token)) {
        Log.i('Uploader.token()');
        this.token_ = token;
      }
      return this.token_;
    },

    spreadsheet: function (spreadsheet) {
      if (!isUndefined(spreadsheet)) {
        Log.i('Uploader.spreadsheet(): ' +
            this.spreadsheet_ + ' -> ' + spreadsheet);
        this.spreadsheet_ = spreadsheet;
      }
      return this.spreadsheet_;
    },

    worksheet: function (worksheet) {
      if (!isUndefined(worksheet)) {
        Log.i('Uploader.worksheet(): ' + this.worksheet_ + ' -> ' + worksheet);
        this.worksheet_ = worksheet;
      }
      return this.worksheet_;
    },

    upload: function (url, start, end) {
      Log.i('Uploader.upload(): ' +
          'url=' + url + ', start=' + start + ', end=' + end);
      if (isUndefined(this.token_) ||
          isUndefined(this.spreadsheet_) ||
          isUndefined(this.worksheet_)) {
        Log.d('Uploader.upload(): state incomplete');
        return this;
      }

      var xhr, api, xml;
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
      xml.documentElement.appendChild(this.element_('url', url));
      xml.documentElement.appendChild(this.element_('start', start));
      xml.documentElement.appendChild(this.element_('end', end));
      // Send it to the spreadsheet.
      xhr = new XMLHttpRequest();
      api = this.url_ + '/list/' + this.spreadsheet_ + '/' +
        this.worksheet_ + '/private/full';
      xhr.open('POST', api, true);
      xhr.setRequestHeader('Authorization', 'Bearer ' + this.token_);
      xhr.setRequestHeader('Content-Type', 'application/atom+xml');
      xhr.send(xml);
      return this;
    },

    element_: function (name, value) {
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
    level_: 3,

    level: function (level) {
      if (!isUndefined(level)) {
        this.level_ = level;
      }
      return this.level_;
    },

    e: function (message) {
      if (this.level_ >= this.ERROR) {
        this.print_('ERR  ', message);
      }
    },

    w: function (message) {
      if (this.level_ >= this.WARNING) {
        this.print_('WARN ', message);
      }
    },

    i: function (message) {
      if (this.level_ >= this.INFO) {
        this.print_('INFO ', message);
      }
    },

    d: function (message) {
      if (this.level_ >= this.DEBUG) {
        this.print_('DEBUG', message);
      }
    },

    print_: function (label, message) {
      console.log(label + ': ' + message);
    },
  };

  isUndefined = function (x) {
    return x === undefined;
  };

  trackers = new DefaultDict(function (tabId) {
    return new Tracker(tabId);
  }, {
    url: function () { return undefined; },
    start: function () { return this; },
    stop: function () { return this; },
    cancel: function () { return this; },
  });

  activatedTabId = undefined;

  //// Life cycle management.

  chrome.tabs.onCreated.addListener(function (tab) {
    Log.d('tabs.onCreated(): ' + tab.id);
    trackers.get(tab.id).url(tab.url);
  });

  chrome.tabs.onRemoved.addListener(function (tabId) {
    Log.d('tabs.onRemoved(): ' + tabId);
    if (activatedTabId === tabId) {
      trackers.remove(tabId).stop();
      activatedTabId = undefined;
    } else {
      trackers.remove(tabId).cancel();
    }
  });

  //// On focus/blur callbacks.

  onFocus = function (tab) {
    Log.d('onFocus(): tab.id=' + tab.id);
    trackers.get(tab.id).start();
    activatedTabId = tab.id;
  };

  onBlur = function (tab) {
    Log.d('onBlur(): tab.id=' + tab.id);
    trackers.get(tab.id).stop();
    activatedTabId = undefined;
  };

  chrome.tabs.onActivated.addListener(function (activeInfo) {
    if (activatedTabId === activeInfo.tabId) {
      return;
    }
    Log.d('tabs.onActivated(): ' + activatedTabId + ' -> ' + activeInfo.tabId);
    trackers.get(activatedTabId).stop();
    activatedTabId = activeInfo.tabId;
    trackers.get(activatedTabId).start();
    chrome.tabs.get(activatedTabId, function (tab) {
      trackers.get(tab.id).url(tab.url);
    });
  });

  // Receive URL.
  chrome.tabs.onUpdated.addListener(function (tabId, changeInfo) {
    var url = trackers.get(tabId).url();
    if (isUndefined(changeInfo.url) || changeInfo.url === url) {
      return;
    }
    Log.d('tabs.onUpdated(): tabId=' + tabId);
    trackers.get(tabId).stop().start().url(changeInfo.url);
  });

  // Manage prerendering or instant of tabs.
  chrome.tabs.onReplaced.addListener(function (addedTabId, removedTabId) {
    Log.d('tabs.onReplaced(): ' +
      'addedTabId=' + addedTabId + ', removedTabId=' + removedTabId);
    if (removedTabId === activatedTabId) {
      trackers.remove(removedTabId).stop();
      activatedTabId = undefined;
    } else {
      trackers.remove(removedTabId).cancel();
    }
    chrome.tabs.get(addedTabId, function (tab) {
      trackers.get(addedTabId).url(tab.url);
    });
  });

  // Monitor idle states.
  chrome.idle.onStateChanged.addListener(function (newState) {
    Log.d('idle.onStateChanged(): newState=' + newState);
    if (newState === 'active') {
      trackers.get(activatedTabId).start();
      chrome.tabs.get(activatedTabId, function (tab) {
        trackers.get(tab.id).url(tab.url);
      });
    } else {
      trackers.get(activatedTabId).stop();
    }
  });

  // Receive configurations from options.html or content-script.js.
  chrome.runtime.onMessage.addListener(function (request, sender) {
    Log.d('onMessage(): request.action=' + request.action);
    if (request.action === 'log') {
      console.log('tab(' + sender.tab.id + '): ' + request.args[0]);
    } else if (request.action === 'set-spreadsheet-id') {
      Uploader.spreadsheet(request.args[0]);
    } else if (request.action === 'set-worksheet-id') {
      Uploader.worksheet(request.args[0]);
    } else if (request.action === 'set-verbose-level') {
      Log.level(request.args[0]);
    } else if (request.action === 'set-oauth-token') {
      Uploader.token(request.args[0]);
    } else if (request.action === 'event') {
      if (request.args[0] === 'focus') {
        onFocus(sender.tab);
      } else if (request.args[0] === 'blur') {
        onBlur(sender.tab);
      }
    }
  });

  // Retrieve OAuth Token.
  chrome.identity.getAuthToken({'interactive': false}, function (token) {
    Log.d('getAuthToken()');
    if (token) {
      Uploader.token(token);
    }
  });

  // Retrieve spreadsheet-id and worksheet-id.
  chrome.storage.sync.get(['spreadsheet-id', 'worksheet-id'], function (ids) {
    if (ids['spreadsheet-id']) {
      Uploader.spreadsheet(ids['spreadsheet-id']);
    }
    if (ids['worksheet-id']) {
      Uploader.worksheet(ids['worksheet-id']);
    }
  });

  chrome.storage.local.get({'verbose-level': Log.INFO}, function (items) {
    Log.level(items['verbose-level']);
  });
}());
