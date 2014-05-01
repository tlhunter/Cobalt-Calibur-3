var Persistence = function() {
  var self = this;
  var player;
  var chat;
  const LOCALSTORAGE_KEY = 'data';

  // TODO: Make these two items part of the constructor
  self.setPlayer = function(new_player) {
    player = new_player;

    return self;
  };

  self.setChat = function(new_chat) {
    chat = new_chat;

    return self;
  };

  self.save = function() {
    localStorage.setItem(LOCALSTORAGE_KEY, JSON.stringify({
      inventory: player.inventory.data,
      direction: player.direction,
      location: player.coordinates,
      name: player.name,
      picture: player.picture,
    }));
  };

  self.load = function() {
    var persistentData = JSON.parse(localStorage.getItem(LOCALSTORAGE_KEY));

    if (persistentData) {
      player.inventory.data = persistentData.inventory;
      player.direction = persistentData.direction;
      player.coordinates = persistentData.location;
      player.name = persistentData.name;
      player.picture = persistentData.picture;

      chat.message('Client', 'Loaded your saved character', 'client');

      return true;
    }

    return false;
  };

  self.createNewPlayer = function() {
    player.inventory.data = [0, 0, 0, 0, 0, 0, 0, 0];
    player.direction = 's';
    player.coordinates = {x: 100, y: 100};
    player.name = 'Anon' + Math.floor(Math.random() * 8999 + 1000);
    player.picture = Math.floor(Math.random() * 8) + 1;

    chat.message('Client', 'Creating a character for the first time', 'client');
  };

  self.destroy = function() {
    player = null;

    localStorage.setItem(LOCALSTORAGE_KEY, null);

    $(window).unload(function() {
      self.destroy();
    });

    location.reload(true);
  };

  // TODO: Make this part of the Persistence code run
  self.init = function() {
    setInterval(function() {
      self.save();
    }, 3000);

    $(window).unload(function() {
      self.save();
    });

    self.load() || self.createNewPlayer();

    return self;
  };
};

module.exports = new Persistence();
