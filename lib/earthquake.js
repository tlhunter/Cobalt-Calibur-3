var _ = require('underscore');
var logger = require('./logger.js');
var terrain = require('./terrain.js');

var Earthquake = function() {
    var self = this;
    self.data = []; // Corruption map
    const RADIUS = 4;
    const ERUPTIONS = 2;
    var handle;
    const interval = 3.1 * 60 * 60 * 1000; // about every three days
    var map;
    var io;

    self.setMap = function(new_map) {
        map = new_map;
        return self;
    };

    self.setSocket = function(new_io) {
        io = new_io;
        return self;
    };

    var eruption = function(x, y, ore) {
        logger.info("Epicenter", "[" + x + "," + y + "], Type: " + ore);
        map.data[x+0][y+0] = ore; // center point

        // Big Rocks
        map.data[x+0][y+1] = 6;
        map.data[x+0][y+2] = 6;
        map.data[x+1][y+0] = 6;

        map.data[x+2][y+0] = 6;
        map.data[x+0][y-1] = 6;
        map.data[x+0][y-2] = 6;

        map.data[x-1][y+0] = 6;
        map.data[x-2][y+0] = 6;
        map.data[x+1][y+1] = 6;

        map.data[x+1][y-1] = 6;
        map.data[x-1][y-1] = 6;
        map.data[x-1][y+1] = 6;

        // Small Rocks
        map.data[x+1][y+2] = 7;
        map.data[x+2][y+1] = 7;

        map.data[x+2][y-1] = 7;
        map.data[x+1][y-2] = 7;

        map.data[x-1][y-2] = 7;
        map.data[x-2][y-1] = 7;

        map.data[x-2][y+1] = 7;
        map.data[x-1][y+2] = 7;

        // Rubble
        map.data[x-1][y+3] = 8;
        map.data[x+0][y+3] = 8;
        map.data[x+1][y+3] = 8;
        map.data[x+2][y+2] = 8;

        map.data[x+3][y+1] = 8;
        map.data[x+3][y+0] = 8;
        map.data[x+3][y-1] = 8;
        map.data[x+2][y-2] = 8;

        map.data[x-1][y-3] = 8;
        map.data[x+0][y-3] = 8;
        map.data[x+1][y-3] = 8;
        map.data[x-2][y-2] = 8;

        map.data[x-3][y+1] = 8;
        map.data[x-3][y+0] = 8;
        map.data[x-3][y-1] = 8;
        map.data[x-2][y+2] = 8;
    };

    var loop = function() {
        var len_y = 200;
        var len_x = 200;
        var eruption_radius = 4;
        var remaining = ERUPTIONS;
        var coords = {};

        while (remaining) {
            coords.x = Math.floor(Math.random() * (len_x - (eruption_radius * 2))) + eruption_radius;
            coords.y = Math.floor(Math.random() * (len_y - (eruption_radius * 2))) + eruption_radius;
            // This is all pretty ugly code... Makes sure the center and four corners aren't synthetic
            if (_.indexOf(terrain.synthetics, map.data[coords.x][coords.y]) != -1) {
                continue;
            } else if (_.indexOf(terrain.synthetics, map.data[coords.x+3][coords.y+3]) != -1) {
                continue;
            } else if (_.indexOf(terrain.synthetics, map.data[coords.x+3][coords.y-3]) != -1) {
                continue;
            } else if (_.indexOf(terrain.synthetics, map.data[coords.x-3][coords.y+3]) != -1) {
                continue;
            } else if (_.indexOf(terrain.synthetics, map.data[coords.x-3][coords.y-3]) != -1) {
                continue;
            }

            var ore_id = null;
            var oreOdds = Math.random();
            if (oreOdds < 0.4) { // 40%
                ore_id = 15;
            } else if (oreOdds < 0.7) { // 30%
                ore_id = 17;
            } else if (oreOdds < 0.85) { // 15%
                ore_id = 19;
            } else if (oreOdds < 0.95) { // 10%
                ore_id = 21;
            } else { // 5%
                ore_id = 23;
            }

            eruption(coords.x, coords.y, ore_id);

            remaining--;
        }
        io.sockets.emit('event earthquake', { });
        logger.debug("Event", "Earthquake");
    };

    self.execute = function() {
        handle = setInterval(loop, interval);
    };
};

module.exports = new Earthquake();
