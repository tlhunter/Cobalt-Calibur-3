var logger      = require('./logger.js');
var MongoClient = require('mongodb').MongoClient;
var map         = require('./map.js');
var corruption  = require('./corruption.js');
var daynight    = require('./daynight.js');
var earthquake  = require('./earthquake.js');
var npcs        = require('./npcs.js');
var players     = require('./players.js')

var WorldPersistence = function() {
    var self = this;
    var database;
    var io;

    self.maps   = [];

    self.setSocket = function(new_io) {
        io = new_io;
        corruption.setSocket(io);
        daynight.setSocket(io);
        earthquake.setSocket(io);
        npcs.setSocket(io);
        players.setSocket(io);
        return self;
    };

    self.setHttp = function(new_http) {
        app = new_http;

        // User request map, return map JSON from RAM
        app.get('/map/:levelName', function(req, res) {
            res.send(self.maps[req.params.levelName]);
        });

        return self;
    };

    self.handlePlayerSocketEvents = function(socket) {
        players.handleSocketEvents(socket);
    }

    self.handleSocketEvents = function(socket) {
        // a user made a change to the world
        socket.on('terraform', function(data) {
            io.sockets.to(self.levelName).emit('terraform', {
                session: this.id,
                x: data.x,
                y: data.y,
                tile: data.tile
            });
            self.maps[data.levelName].terraform(data);
        });
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

    // Loads all the maps from MongoDB
    self.loadMaps = function(callback) {
        database.collection('maps', function(err, collection) {
            if (err) {
                logger.error("MongoDB", "Map collection doesn't exist", err);
                throw err;
            }

            collection.find({}, {}).toArray(function(err, items) {
                if (err || !items) {
                    logger.error("MongoDB", "Map collection is empty", err);
                    throw err;
                }

                items.forEach(function(item) {
                    var newMap                = new map();
                    newMap.data               = item.map;
                    newMap.levelName          = item.levelName;
                    self.maps[item.levelName] = newMap;
                });
            });

            callback(null);
            return;
        });
    };

    self.processCorruptionEvent = function() {
        self.maps.forEach(function(item) {
            corruption.setMap(item);
            corruption.execute();
        });
    };

    self.processDayNightEvent = function() {
        self.maps.forEach(function(item) {
            daynight.setMap(item);
            daynight.execute();
        });
    };

    self.processNPCSpawnEvent = function() {
        self.maps.forEach(function(item) {
            npcs.setMap(item);
            npcs.spawn(100);
        });
    };

    self.processNPCMoveEvent = function() {
        self.maps.forEach(function(item) {
            npcs.setMap(item);
            npcs.setPlayers(players);
            npcs.execute(item);
        });
    };

    self.processInitialEvents = function() {
        self.processNPCSpawnEvent();
        self.processNPCMoveEvent();
    };

    // Corruption Events
    setInterval(function() {
        self.processCorruptionEvent();
    }, (10 * 1000)); // Corruption event every 10 seconds

    // DayNight Events
    setInterval(function() {
        self.processDayNightEvent();
    }, (10 * 60 * 1000)); // DayNight event every 10 minute

    // NPC Events
    //setInterval(function() {
    //    self.processNPCSpawnEvent();
    //}, (60 * 60 * 1000)); // NPC spawn event every hour
    setInterval(function() {
        self.processNPCMoveEvent();
    }, (20 * 1000)); // NPC move event every 20 seconds

    // Earthquake Events
    setInterval(function() {
        self.maps.forEach(function(item) {
            earthquake.setMap(item);
            earthquake.execute();
        });
    }, (3.1 * 60 * 60 * 1000)); // Earthquake event every 3 days

    // Save Maps here
    setInterval(function() {
        self.maps.forEach(function(item) {
            if (item.dirty) {
                database.collection('maps', function(err, collection) {
                    collection.update({levelName: item.levelName}, {$set: {item: item.data}}, function(err, result) {
                        logger.success("MongoDB", "Saving dirty map " + item.levelName);
                        item.dirty = false;
                    });
                });
            }
        });
    }, (2500)); // Save map to Mongo once every 5 minutes (5 * 60 * 1000)

};

module.exports = new WorldPersistence();
