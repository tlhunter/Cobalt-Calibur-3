'use strict';

var _ = require('underscore');

var Players = function() {
  var self = this;

  self.data = [];

  // Updates a player location, adding if it's a new entry
  self.update = function(player_data) {
    var found = false;
    var len = self.data.length;
    var player;

    for (var i = 0; i < len; i++) {
      player = self.data[i];

      if (player.session === player_data.session) {
        _.extend(player, player_data);
        found = true;
      }
    }

    if (!found) {
      self.data.push(player_data);
    }
  };

  self.remove = function(session) {
    var len = self.data.length;
    var player;
    for (var i = 0; i < len; i++) {
      player = self.data[i];
      if (player.session == session) {
        self.data.splice(i, 1);
        break;
      }
    }
  };

};

module.exports = new Players();
