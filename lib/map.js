var filesystem = require('fs');
var logger = require('./logger.js');
var MongoClient	= require('mongodb').MongoClient;
var gamedata = require('../assets/data.json');

var MapPersistence = function() {
    var self = this;
    const levelName = '1'; // In case we ever want additional maps one day
    var dirty = false;
    var database;
    var app;

    // Giant array of map data
    self.data = [];

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

    // Connect to MongoDB
    self.connect = function(mongodb_connection_string, callback) {
        MongoClient.connect(mongodb_connection_string, function(err, db) {
            if (err) {
                logger.error('err', "MongoDB", "Could not connect to database");
                throw err;
            }

            database = db;

            callback(err);
        });
    };

    // Loads a default map from a JSON file, persists to MongoDB, and returns it for the game to cache
    self.buildMap = function(callback) {
        logger.info("MongoDB", "Attempting to build the database");

        filesystem.readFile('map.json', function(err, fileContents) {
            if (err) {
                logger.error("Error", err);
                throw err;
            }

            var mapData = JSON.parse(fileContents);

            database.collection('maps', function(err, collection) {
                logger.info("MongoDB", "Connecting to the map collection");

                if (err) {
                    logger.error("Error", err);
                    throw err;
                }

                logger.info("MongoDB", "Cool, I connected to the collection");

                collection.remove({}, function(err, result) { // TODO: should delete self.levelName, not everything
                    logger.info("MongoDB", "Removing the entries from the collection");

                    collection.insert({map: mapData, levelName: levelName}, function(err) {
                        if (err) { throw err };
                        logger.info("MongoDB", "Recreating the database");

                        collection.count(function(err, count) {
                            logger.info("MongoDB", "Done counting, not sure what I found");

                            if (count == 1) {
                                self.map = mapData;
                                if (typeof callback === 'function') {
                                    callback(null);
                                }
                                logger.info("MongoDB", "Map was rebuilt from map.json file");
                            }
                        });
                    });

                });
            });
        });
    };

    // Loads the map from MongoDB
    self.loadMap = function(callback) {
        database.collection('maps', function(err, collection) {
            if (err) {
                logger.error("MongoDB", "Map collection doesn't exist", err);
                throw err;
            }

            collection.findOne({}, {}, function(err, item) {
                if (err) {
                    logger.error("MongoDB", "Map collection is empty", err);
                    throw err;
                }

                if (item != null) {
                    self.data = item.map
                    callback(null);
                    return;
                } else {
                    logger.error("MongoDB", "The map in Mongo is null");
                    self.buildMap(callback);
                    return;
                }
            });
        });
    };


    // Every minute we want to write the database from memory to mongo
    setInterval(function() {
        if (self.dirty) {
            database.collection('maps', function(err, collection) {
                if (err) {
                    logger.error("MongoDB", "Error selecting map collection to save", err);
                }

                collection.update({levelName: levelName}, {$set: {map: self.data}}, function(err, result) {
                    logger.success("MongoDB", "Yo dawg, I hear you like to save maps to the db.");

                    self.dirty = false;
                });
            });
        }
    }, 5 * 1000); // Save map to Mongo once every minute

};

module.exports = new MapPersistence();
