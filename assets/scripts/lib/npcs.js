'use strict';

var NPCs = function() {
  var self = this;

  var data = [];

  self.update = function(new_data) {
    data = new_data;
  };

  self.getData = function() {
    return data;
  };

  self.adjacent = function(coords) {
    var len = data.length;

    for (var l = 0; l < len; l++) {
      var npc = data[l];

      for (var i = -1; i <= 1; i++) {
        for (var j = -1; j <= 1; j++) {
          if (npc.x == coords.x + i && npc.y == coords.y + j) {
            return npc.id;
          }
        }
      }
    }

    return false;
  };
};

module.exports = new NPCs();
