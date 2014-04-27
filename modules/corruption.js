var _ = require('underscore');
var logger = require('./logger.js');
var terrain = require('./terrain.js');

var Corruption = function() {
    var self = this;
    self.data = []; // Corruption map
    const RADIUS = 4;
    var handle;
    const interval = 43 * 1000;
    var map;
    var io;

    self.setMap = function(map) {
        self.map = map;
        return self;
    };

    self.setSocket = function(io) {
        self.io = io;
        return self;
    };

    var loop = function() {
        self.data = [];
        var len_y = 200;
        var len_x = 200;
        // Now, we want to generate, you know, 40,000 tiles of 0's in a 2d array
        for (var y = 0; y < len_y; y++) {
            self.data[y] = [];
            for (var x = 0; x < len_x; x++) {
                self.data[y][x] = 1;
            }
        }
        // Now, we want to go through all of our tiles, find synthetic ones, and draw a square around it
        for (var y = 0; y < len_y; y++) {
            for (var x = 0; x < len_x; x++) {
                if (_.indexOf(terrain.synthetics, self.map.data[x][y][0]) != -1) {
                    for (var xx = -RADIUS; xx <= RADIUS; xx++) {
                        for (var yy = -RADIUS; yy <= RADIUS; yy++) {
                            if (x+xx >= 0 && x+xx < len_x && y+yy >= 0 && y+yy < len_y) {
                                self.data[x+xx][y+yy] = 0;
                            }
                        }
                    }
                }
            }
        }

        self.io.sockets.emit('event corruption', {
            map: self.data
        });

        logger.debug("Event", "Corruption Spread");
    };

    self.execute = function() {
        handle = setInterval(loop, interval);
        loop();
    };
};

module.exports = new Corruption();
