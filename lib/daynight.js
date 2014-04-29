var _ = require('underscore');
var logger = require('./logger.js');
var terrain = require('./terrain.js');

var DayNight = function() {
    var self = this;
    var handle;
    const INTERVAL = 1 * 60 * 1000;
    const BEACH_RADIUS = 1;
    const CYCLE = 24;
    var current = 8;
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

    self.getTime = function() {
        return current;
    };

    /*
     * Send corruption map to socket.
     * If no socket is provided, send to all sockets.
     */
    self.sendData = function(socket) {
        if (!socket) {
            socket = io.sockets;
        }

        socket.emit('event time', {
            time: current
        });
    };

    var loop = function() {
        current++;

        var len_y = 200;
        var len_x = 200;
        if (current === 9) {
            var new_trees = 0,
                new_grass = 0,
                new_sand = 0;

            for (var y = 0; y < len_y; y++) {
                for (var x = 0; x < len_x; x++) {
                    switch(map.data[x][y][0]) {
                        case 0: // grass
                            if (Math.random() < 1/4000) {
                                map.data[x][y] = [4, 20]; // tree, 20 health
                                new_trees++;
                            }
                            break;
                        case 1: // dirt
                            if (Math.random() < 1/5) {
                                map.data[x][y][0] = 0; // grass
                                new_grass++;
                            }
                            break;
                        case 3: // water
                            for (var xx = -BEACH_RADIUS; xx <= BEACH_RADIUS; xx++) {
                                for (var yy = -BEACH_RADIUS; yy <= BEACH_RADIUS; yy++) {
                                    if (x+xx < 0 || x+xx >= len_x || y+yy < 0 || y+yy >= len_y) {
                                        break;
                                    }
                                    var tile = map.data[x+xx][y+yy][0];
                                    if (tile == 0 || tile == 1) { // if this is a grass or dirt tile
                                        map.data[x+xx][y+yy][0] = 2; // make it sand
                                        new_sand++;
                                    }
                                }
                            }
                            break;
                    }
                }
            }

            logger.info("New Trees", new_trees);
            logger.info("New Grass", new_grass);
            logger.info("New Sand", new_sand);

            io.sockets.emit('event bigterraform', {});
        }

        if (current >= CYCLE) {
            current = 0;
        }

        io.sockets.emit('event time', {
            time: current
        });

        logger.debug("Event", "Time: " + current + ":00");
    };

    self.execute = function() {
        handle = setInterval(loop, INTERVAL);
        loop();
    };
};

module.exports = new DayNight();
