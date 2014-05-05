'use strict';

var Network = function() {
  var self = this;

  var socket = socket = io.connect(window.document.location.protocol + "//" + window.document.location.host);

  var player, audio, environment, npcs, players, chat;

  self.setEnvironment = function(new_environment) {
    environment = new_environment;

    return self;
  };

  self.setPlayer = function(new_player) {
    player = new_player;

    return self;
  };

  self.setPlayers = function(new_players) {
    players = new_players;

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

  self.setNPCs = function(new_npcs) {
    npcs = new_npcs;

    return self;
  };

  // Player types a message to be sent, probably don't need name value anymore
  self.sendChat = function(message) {
    socket.emit('chat', {
      name: player.name,
      message: message,
      priority: 0
    });
  };

  // Player moves to a new location
  self.sendMove = function(coords, direction) {
    socket.emit('character info', {
      x: coords.x,
      y: coords.y,
      direction: direction
    });
  };

  // Player builds a tile or mines a tile
  self.sendTerraform = function(x, y, tile) {
    socket.emit('terraform', {
      x: x,
      y: y,
      tile: tile
    });
  };

  // Player dies
  self.sendDeath = function(name, method) {
    socket.emit('chat', {
      name: name,
      message: message,
      priority: 'server'
    });
  };

  // Player changes either their name or their picture
  self.sendCharacter = function(name, picture) {
    socket.emit('character info', {
      name: name,
      picture: picture
    });
  };

  self.sendJoin = function(name) {
    socket.emit('join', {
      name: name
    });
  };

  // SOCKET EVENTS
  socket.on('chat', function (data) {
    if (typeof data.priority == "undefined") {
      audio.play('chat');
    }

    chat.message(data.name, data.message, data.priority);
  });

  socket.on('disconnect', function(data) {
    chat.message('Server', 'Disconnected', 'server');
  });

  socket.on('leave', function(data) {
    players.remove(data.session);
    chat.message(data.name || 'unknown', "Player Disconnected", 'server');
  });

  socket.on('terraform', function (data) {
    environment.map[data.x][data.y] = data.tile;
  });

  socket.on('character info', function(data) {
    if (socket.socket.sessionid == data.dession) return;
    players.update(data);
  });

  socket.on('event time', function(data) {
    environment.daylight.setTime(data.time);
  });

  socket.on('event earthquake', function(data) {
    $.get('/map', function(data) {
      environment.data = data;
    });

    chat.message('Server', "There has been an earthquake! New Rock and Ore has been added to the world.", 'server');
    audio.play('earthquake');
  });

  socket.on('event npcmovement', function(data) {
    npcs.update(data.npcs);
  });

  socket.on('event corruption', function(data) {
    environment.corruption = data.map;
  });

  socket.on('event bigterraform', function(data) {
    $.get('/map', function(data) {
      environment.map = data;
    });
  });
};

module.exports = new Network();
