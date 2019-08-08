var fs = require('fs');
var logger = require('./logger.js');
var gamedata = require('../assets/data.json');

// MongoDB was _always_ overkill...
var MAP_DATA = '/tmp/cobalt-calibur-map.json';

var MapPersistence = function() {
    var self = this;
    var dirty = false;
    var app;

    // Giant 2D array of numeric map data
    // TODO: should be [y][x], not [x][y]
    self.data = null;

    self.setHttp = function(new_http) {
        app = new_http;

        // User request map, return map JSON from RAM
        app.get('/map', function(req, res) {
            res.send(self.data);
        });

        // User requests map builder page, builds map from JSON file, returns OK
        app.get('/build-map', function(req, res) {
            self.buildMap(function(err) {
                if (err) {
                    res.send(500, "Couldn't build map.");
                    return;
                }

                res.send(200, "Rebuilt Map");
            });
        });

        return self;
    };

    self.handleSocketEvents = function(socket) {
        // a user made a change to the world
        socket.on('terraform', function(data) {
            self.dirty = true;

            socket.broadcast.emit('terraform', {
                session: this.id,
                x: data.x,
                y: data.y,
                tile: data.tile
            });

            self.data[data.x][data.y] = data.tile;
        });
    };

    // Get information about the tile at the provided coordinates
    self.getTileData = function(x, y) {
        return gamedata.terrain[self.data[x][y]];
    };

    // Can the NPC walk over the specified location?
    self.canNPCWalk = function(x, y) {
        var tile = self.getTileData(x, y);

        if (tile && tile.block_npc) {
            return false;
        }

        return true;
    };

    // Can an NPC spawn at the specified location?
    self.canNPCSpawn = function(x, y) {
        if (!self.getTileData(x, y).spawn_npc) {
            return false;
        }

        return true;
    };

    // Loads a default map from a JSON file, persists to db, and returns it for the game to cache
    self.buildMap = function(callback) {

        fs.readFile('./default-map.json', function(err, fileContents) {
            if (err) {
                logger.error("Error", err);
                throw err;
            }

            var mapData = JSON.parse(fileContents);

            self.data = mapData;

            // replace any existing data
            fs.writeFile(MAP_DATA, JSON.stringify(mapData), callback);
        });
    };

    // Loads the map from db
    self.loadMap = function(callback) {
        fs.readFile(MAP_DATA, function(err, data) {
            if (err) {
                logger.info("Database", "Creating database for first time");
                self.buildMap(callback);
                return;
            }

            self.data = JSON.parse(data.toString());
            callback(null);
        });
    };


    // Every minute we want to write the database from memory to db
    setInterval(function() {
        saveIfDirty(function(err) {
            if (err) {
                throw err;
            }
        });
    }, 5 * 1000);

    process.on('SIGINT', function() {
        saveIfDirty(function(err) {
            process.exit(err ? 1 : 0);
        });
    });

    function saveIfDirty(callback) {
        if (self.dirty) {
            fs.writeFile(MAP_DATA, JSON.stringify(self.data), function(err) {
                if (err) {
                    callback(err);
                    return;
                }

                self.dirty = false;

                callback(null);
            });
        } else {
            setImmediate(function() {
                callback(null);
            });
        }
    }
};

module.exports = new MapPersistence();
