// Copyright (C) 2014 Che-Liang Chiou.


var onClientLoad = (function () {
  'use strict';

  var CLIENT_ID, SCOPES, onAuthorize;

  CLIENT_ID = '7104262726-fve00km9inv26dqe02ilt5crl4pe46bc.apps.googleusercontent.com';
  SCOPES = ['https://www.googleapis.com/auth/drive',
            'https://spreadsheets.google.com/feeds'].join(' ');

  onAuthorize = function (token) {
    var button = document.getElementById('retrieve-oauth-token');
    if (!token || token.error) {
      button.style.display = 'block';
      button.onclick = function () {
        gapi.auth.authorize({
          'client_id': CLIENT_ID,
          'scope': SCOPES,
          'immediate': false
        }, onAuthorize);
      };
      return;
    }
    button.style.display = 'hidden';
    console.log('OAuth Token: ' + token.access_token);
  };

  return function () {
    gapi.auth.authorize({
      'client_id': CLIENT_ID,
      'scope': SCOPES,
      'immediate': true
    }, onAuthorize);
  };
}());
