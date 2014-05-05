'use strict';

var _ = require('underscore');

var Player = function() {
  var self = this;

  self.life = 5;
  self.picture = 0;
  self.name = '';
  var god = false;
  self.coordinates = {
    x: 100,
    y: 100
  };
  self.direction = 's';
  var speed = 150;

  var environment, network, graphics, audio, chat, persistence;

  self.setEnvironment = function(new_environment) {
    environment = new_environment;

    return self;
  };

  self.setNetwork = function(new_network) {
    network = new_network;

    return self;
  };

  self.setGraphics = function(new_graphics) {
    graphics = new_graphics;

    return self;
  };

  self.setAudio = function(new_audio) {
    audio = new_audio;

    return self;
  };

  self.setChat = function(new_chat) {
    chat = new_chat;

    return self;
  };

  self.setPersistence = function(new_persistence) {
    persistence = new_persistence;

    return self;
  };

  // Attempts to move the character in the direction we specify
  self.move = function(d) {
    // if nothing is passed in or anything not acceptable is passed in do nothing
    if (!d || /[^ensw]/i.test(d)) {
        console.log("Invalid direction passed to move: " + d);
        return false;
    }

    // face the player in the direction of the first valid direction passed in
    self.setDirection(d.slice(0,1));

    // convert d to an array of directions for consistent processing
    // ensure that the pair is [x, y]
    d = [(d.match(/[ew]/) || [])[0] || "", (d.match(/[ns]/) || [])[0] || ""]
      // map to grid movement change values
      .map(function (item) {
          // parse into integers
          return ~~({e: 1, n: -1, s: 1, w: -1}[item]);
      });

    var new_coords = {
      x: self.coordinates.x + d[0],
      y: self.coordinates.y + d[1]
    };

    if (!self.isAccessible(new_coords.x, new_coords.y)) {
      audio.play('walk-fail');
    } else {
      self.setLocation(new_coords.x, new_coords.y);
      audio.play('walk');

      if (environment.corruption && environment.corruption[new_coords.x][new_coords.y]) {
        if (Math.random() < 1/8) {
          self.hurt("You were killed by corruption");
          network.sendChat("*Killed by Corruption*");
        }
      }

      graphics.selfAnimationFrame = !graphics.selfAnimationFrame;
      graphics.viewport.update();
    }
  };

  self.inventory = {
    data: [0, 0, 0, 0, 0, 0, 0, 0],

    update: function(index, amount) {
      var data = self.inventory.data;

      if (amount < 0) {
        if (data[index] >= -amount) {
          data[index] += amount;
          $('#inventory-'+index+' span').stop().css({fontSize: '8px'}).animate({ fontSize : '15px' }).html(data[index]);
          return true;
        }

        return false;
      } else {
        data[index] += amount;
        $('#inventory-'+index+' span').stop().css({fontSize: '22px'}).animate({ fontSize : '15px' }).html(data[index]);

        return true;
      }
    },

    render: function() {
      var len = self.inventory.data.length;
      for (var i = 0; i < len; i++) {
        $('#inventory-'+i+' span').html(self.inventory.data[i]);
      }
    }
  };

  // Forces an XY location
  self.setLocation = function(x, y) {
    self.coordinates = {
      x: x,
      y: y
    };

    graphics.viewport.update();
    self.broadcastLocation();
  };

  // Sets the direction we are facing
  self.setDirection = function(d) {
    self.direction = d;

    self.broadcastLocation();
  };

  // Gets information about the tile we are facing
  self.getFacingTile = function() {
    var data = {};

    switch(self.direction) {
      case 'n':
        data.coordinates = {
          x: self.coordinates.x,
          y: self.coordinates.y - 1
        };
        break;

      case 'e':
        data.coordinates = {
          x: self.coordinates.x + 1,
          y: self.coordinates.y
        };
        break;

      case 's':
        data.coordinates = {
          x: self.coordinates.x,
          y: self.coordinates.y + 1
        };
        break;

      case 'w':
        data.coordinates = {
          x: self.coordinates.x - 1,
          y: self.coordinates.y
        };
        break;

      default:
        console.log("Invalid Direction", self.direction);
        break;
    }

    _.extend(
      data,
      environment.getTile(data.coordinates.x, data.coordinates.y)
    );

    return data;
  };

  // Whether or not the tile can be walked on
  // TODO: Move this to environment.js
  self.isAccessible = function(x, y) {
    if (x < 0 || y < 0 || x >= environment.WIDTH || y >= environment.HEIGHT) {
      return false;
    }

    if (environment.getTile(x, y).block_player) {
      return false;
    }

    return true;
  };

  // Sends the players location and direction to the server
  self.broadcastLocation = function() {
    network.sendMove(self.coordinates, self.direction);
    environment.render(true);
  };

  // Mines the facing tile, adjusts inventory
  self.mineFacingTile = function() {
    var tileData = self.getFacingTile();
    var coords = tileData.coordinates;

    if (!god && coords.x >= 96 && coords.x <= 104 && coords.y >= 96 && coords.y <= 104) {
      audio.play('mine-fail');
      chat.message('Client', 'You cannot change the spawn location.', 'client');
      return false;
    }

    var mineable = tileData.mineable;

    if (!mineable) {
      audio.play('mine-fail');
      return false;
    }

    var becomes = tileData.becomes;
    var provides = tileData.provides;

    environment.map[coords.x][coords.y] = becomes;
    network.sendTerraform(coords.x, coords.y, becomes);
    self.inventory.update(provides.id, provides.quantity);
    audio.play('mine');
  };

  // Attempts to create and then place the specified tile
  self.placeItem = function(terrainIndex) {
    var replaceTile = self.getFacingTile();
    var coords = replaceTile.coordinates;

    if (!god && coords.x >= 96 && coords.x <= 104 && coords.y >= 96 && coords.y <= 104) {
      document.getElementById('sound-build-fail').play();
      chat.message('Client', 'You cannot change the spawn location.', 'client');

      return false;
    }

    if (!replaceTile.replaceable) {
      document.getElementById('sound-build-fail').play();
      chat.message('Client', 'This object cannot be built over.', 'client');

      return false;
    }

    var item = graphics.tilesets.descriptors.terrain[terrainIndex];

    // provides is also the cost of manufacturing the tile
    if (self.inventory.update(item.provides.id, -item.provides.quantity)) {
      audio.play('build');
      environment.map[coords.x][coords.y] = terrainIndex;
      network.sendTerraform(coords.x, coords.y, terrainIndex);

      return true;
    } else {
      chat.message('Client', "You don't have the inventory to build this.", 'client');

      return false;
    }
  };

  // Sends the player back to spawn
  self.kill = function(message) {
    audio.play('death');

    self.direction = 's';
    self.setLocation(100, 100);
    graphics.viewport.update();

    chat.message('Client', message, 'client');

    persistence.save();

    setTimeout(function() {
        self.life = 5;
        graphics.hearts.draw();
    }, 200);
  };

  self.hurt = function(killMessage) {
    self.life--;

    if (self.life <= 0) {
      self.kill(killMessage);
      return;
    }

    graphics.hearts.draw();
  };

  self.regenerateHearts = function () {
    if (self.life < 5) {
      self.life++;
      graphics.hearts.draw();
    }

    setTimeout(self.regenerateHearts, 30 * 1000);
  };

  self.regenerateHearts();
  self.inventory.render();
};

module.exports = new Player();
