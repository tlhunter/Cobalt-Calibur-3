var Chat = function() {
  var $output = $('#messages');
  var $input = $('#message-input');
  var $form = $('#message-box form');

  var network, player, players, environment;

  self.setNetwork = function(new_network) {
    network = new_network;

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

  self.setEnvironment = function(new_environment) {
    environment = new_environment;

    return self;
  };

  self.message = function(who, message, priority) {
    // Hacky code... But it fixes some XSS issues. Encoded data is getting undencoded at some point
    message = message.replace(/&/g, "&amp;").replace(/>/g, "&gt;").replace(/</g, "&lt;").replace(/"/g, "&quot;");
    who = who.replace(/&/g, "&amp;").replace(/>/g, "&gt;").replace(/</g, "&lt;").replace(/"/g, "&quot;");
    $output.append("<div class='message " + priority + "'><span class='username'>" + who + ": </span><span class='content'>" + message + "</span></div>")
      .animate({scrollTop: $output[0].scrollHeight});
  };

  self.clear = function() {
    $output.empty();
  };

  self.clearInput = function() {
    $input.val('');
  };

  self.getInput = function() {
    return $input.val();
  };

  $form.submit(function(event) {
    event.preventDefault();
    var message = self.getInput();
    self.clearInput();

    if (message === '/clear') {
      self.clear();
      return;
    } else if (message === '/help') {
      self.message('Help', '-{Keys}----------------------------', 'help');
      self.message('Help', 'Use the WASD keys to move', 'help');
      self.message('Help', 'Press F to mine the facing object', 'help');
      self.message('Help', 'Press T or / to enter the chat box', 'help');
      self.message('Help', 'Press Esc to leave the chat box', 'help');
      self.message('Help', '-{Commands}------------------------', 'help');
      self.message('Help', '/nick NAME: change your name', 'help');
      self.message('Help', '/pic 1-8: change your avatar', 'help');
      self.message('Help', '/who: get a list of players', 'help');
      self.message('Help', '/gps: get coordinates', 'help');
      self.message('Help', '/clear: reset message area', 'help');
      self.message('Help', '/kill: commit suicide', 'help');
      self.message('Help', '/reset: create new character', 'help');
      return;
    } else if (message.indexOf('/nick ') === 0) {
      var playerName = message.substr(6);
      player.name = playerName;
      network.send.character(player.name, player.picture);
      return;
    } else if (message.indexOf('/pic ') === 0) {
      var picIndex = parseInt(message.substr(5), 10);
      if (isNaN(picIndex)) {
        picIndex = 1;
      }
      if (picIndex > 8) {
        picIndex = 1;
      }
      player.picture = picIndex;
      network.send.character(player.name, player.picture);
      // change picture
      return;
    } else if (message === '/who') {
      self.message("Client", "Found " + players.data.length + " players", 'client');
      _.each(players.data, function(player) {
        self.message("Client", player.name, 'client');
      });
      return;
    } else if (message === '/kill') {
      player.kill('Committed Suicide');
      network.send.chat("*Committed Suicide*");
      return;
    } else if (message === '/reset') {
      persistence.createNewPlayer();
      player.kill('Destroyed Himself');
      network.send.chat("*Committed Suicide*");
    } else if (message === '/gps') {
      self.message("Client", "Coordinates: [" + (player.coordinates.x) + "," + (player.coordinates.y) + "]", 'client');
      return;
    } else if (message.indexOf('/tile ') === 0) {
      var tile = parseInt(message.substr(6), 10);
      if (isNaN(tile)) {
        return;
      }
      var coords = player.getFacingTile().coordinates;
      environment.map.data[coords.x][coords.y] = tile;
      network.send.terraform(coords.x, coords.y, tile);
      return;
    }
    self.message(player.name, message, 'self');
    network.send.chat(message);
  });

  // Pres Esc inside of text box, leave the text box
  $(document).keyup(function(e) {
    if ($(e.target).is(":input") && e.which == 27) {
      e.preventDefault();
      self.$input.blur();
    };
  });
};

module.exports = new Chat();
