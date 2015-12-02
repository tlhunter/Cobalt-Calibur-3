var logger = require('./logger.js');
var gamedata = require('../assets/data.json');

var MapPersistence = function() {
    var self      = this;

    // Giant array of map data

    self.levelName = null;
    self.dirty     = false;
    self.data      = [];

    self.terraform = function(data) {
        self.dirty = true;
        self.data[data.x][data.y] = data.tile;
        return self;
    };

    // Get information about the tile at the provided coordinates
    self.getTileData = function(x, y) {
        return gamedata.terrain[self.data[x][y]];
    };

    // Can the NPC walk over the specified location?
    self.canNPCWalk = function(x, y) {
        var tile = self.getTileData(x, y);




        if (tile && tile.block_npc) {
            console.log('NPC CANNOT walk', tile);
            return false;
        }

        console.log('NPC can walk', tile);
        return true;
    };

    // Can an NPC spawn at the specified location?
    self.canNPCSpawn = function(x, y) {
        if (!self.getTileData(x, y).spawn_npc) {
            return false;
        }

        return true;
    };

};

module.exports = MapPersistence;
