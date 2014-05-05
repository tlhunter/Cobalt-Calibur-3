'use strict';

var Environment = function() {
  var self = this;

  // TODO: Make these dynamic based on response data
  self.WIDTH = 200;
  self.HEIGHT = 200;

  // TODO: This should be in graphics
  var COLORS = {
    black: "rgb(0,0,0)",
    corruption: [
      "rgba(15,0,61,0.5)",
      "rgba(36,14,88,0.7)",
      "rgba(47,24,99,0.6)"
    ]
  };

  self.map = [];
  self.corruption = [];

  var graphics, chat, npcs, players, player;

  self.setGraphics = function(new_graphics) {
    graphics = new_graphics;

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

  self.setPlayers = function(new_players) {
    players = new_players;

    return self;
  };

  self.setPlayer = function(new_player) {
    player = new_player;

    return self;
  };

  self.getTile = function(x, y) {
    var tile = self.map[x][y];

    tile = graphics.tilesets.descriptors.terrain[tile];

    return tile;
  };

  // used to filter all npc + other players to only those in view
  // TODO: This should be in graphics
  self.isInViewport = function isInViewport (avatar) {
    var viewport = graphics.viewport;
    // this math could be cleaned up!
    return avatar.x >= viewport.x && avatar.x <= viewport.x + viewport.WIDTH_TILE
        && avatar.y >= viewport.y && avatar.y <= viewport.y + viewport.HEIGHT_TILE;
  };

  self.drawAvatar = function drawAvatar (avatar) {
    var x = avatar.x - graphics.viewport.x;
    var y = avatar.y - graphics.viewport.y;
    var index = graphics.getAvatarFrame(avatar.d || avatar.direction, graphics.globalAnimationFrame);
    var isPlayer = "name" in avatar;
    var avatar_name = avatar.name || graphics.tilesets.descriptors.monsters[avatar.id].name || "???";
    var avatar_id = ~~avatar.picture || avatar.id || 0;

    graphics.nametags.add(avatar_name, x, y, !isPlayer);
    graphics.drawAvatar(x, y, index, avatar_id, isPlayer ? 'characters' : 'monsters');
  };

  // return properly sorted list of all other avatars
  self.getAvatars = function getAvatars () {
    return npcs.getData().concat(players.data)
      .sort(function (a, b) {
        return a.x !== b.x ? 0 : a.y < b.y ? -1 : 1;
      });
  };

  // TODO: This should be in graphics
  self.render = function() {
    // immediately draw canvas as black
    graphics.handle.fillStyle = COLORS.black;
    graphics.handle.fillRect(0, 0, graphics.viewport.WIDTH_PIXEL, graphics.viewport.HEIGHT_PIXEL);

    var i, j;
    var mapX = 0;
    var mapY = 0;
    var tile;
    graphics.nametags.hide();

    for (j = 0; j < graphics.viewport.HEIGHT_TILE; j++) {
      for (i = 0; i < graphics.viewport.WIDTH_TILE; i++) {
        mapX = i + graphics.viewport.x;
        mapY = j + graphics.viewport.y;
        tile = (mapX >= 0 && mapX < 200 && mapY >= 0 && mapY <= 200) ? self.map[mapX][mapY] : null;
        graphics.drawTile(i, j, tile);

        // Draw Corruption
        if (self.corruption && mapX >= 0 && mapX < self.WIDTH && mapY >= 0 && mapY < self.HEIGHT && self.corruption[mapX][mapY] === 1) {
          graphics.handle.fillStyle = COLORS.corruption[Math.floor(Math.random() * COLORS.corruption.length)];
          graphics.drawCorruption(i, j);
        }
      }
    }

    // Draw NPCs + other players
    self.getAvatars().filter(self.isInViewport).forEach(self.drawAvatar.bind(null));

    // Draw this player
    var index = graphics.getAvatarFrame(player.direction, graphics.selfAnimationFrame);
    graphics.nametags.add(player.name, graphics.viewport.PLAYER_OFFSET_LEFT_TILE, graphics.viewport.PLAYER_OFFSET_TOP_TILE, false);
    graphics.drawAvatar(graphics.viewport.PLAYER_OFFSET_LEFT_TILE, graphics.viewport.PLAYER_OFFSET_TOP_TILE, index, player.picture, 'characters');

    graphics.nametags.show();

    self.daylight.draw();
  };

  self.daylight = {
    time: 8, // integer representing hour of day

    setTime: function(time) {
        self.daylight.time = time;
        $('#clock').html(time + ':00');
    },

    draw: function() {
        var color = null;
        var time = self.daylight.time;
        if (time < 5) { // night
            color = "rgba(0, 0, 0, 0.65)";
        } else if (time < 7) { // dusk
            color = "rgba(0, 13, 54, 0.5)";
        } else if (time < 8) { // dusk
            color = "rgba(0, 13, 54, 0.25)";
        } else if (time < 17) { // day
            color = null;
        } else if (time < 18) { //dawn
            color = "rgba(54,22,0, 0.25)";
        } else if (time < 20) { //dawn
            color = "rgba(54,22,0, 0.5)";
        } else {
            color = "rgba(0, 0, 0, 0.65)";
        }

        if (color) {
            graphics.handle.fillStyle = color;
            graphics.handle.fillRect(0, 0, graphics.viewport.WIDTH_PIXEL, graphics.viewport.HEIGHT_PIXEL);
        }
    }
  };

  // TODO: Move to graphics
  self.downloadTiles = function() {
    return $.get('/assets/data.json').pipe(function(assets) {
      chat.message('Client', 'Tileset Descriptors done.', 'client');
      graphics.tilesets.descriptors = assets;
      return true;
    });
  };

  self.downloadMap = function() {
    return $.get('/map').pipe(function(map_data) {
      chat.message('Client', 'Map data done.', 'client');
      self.map = map_data;
      return true;
    });
  };

};

module.exports = new Environment();
