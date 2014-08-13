// Copyright (C) 2014 Che-Liang Chiou.


(function () {
  'use strict';

  window.addEventListener('focus', function () {
    chrome.runtime.sendMessage({action: 'event', args: ['focus']});
  });

  window.addEventListener('blur', function () {
    chrome.runtime.sendMessage({action: 'event', args: ['blur']});
  });
}());
