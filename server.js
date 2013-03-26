#!/usr/bin/env node

'use strict';

var fs          = require('fs');
var express 	= require("express");
var app 		= express();
var server		= require('http').createServer(app);
var io          = require('socket.io').listen(server, {log: false});
var mongodb 	= require('mongodb');
var sanitizer   = require('sanitizer');
var _           = require('underscore');
var colors      = require('colors');

// Web Server Configuration
var server_port = parseInt(process.argv[2], 10) || 80; // most OS's will require sudo to listen on 80
var server_address = '127.0.0.1';

// MongoDB Configuration
var mongo_host = '127.0.0.1';
var mongo_port = 27017;
var mongo_req_auth = false; // Does your MongoDB require authentication?
var mongo_user = 'admin';
var mongo_pass = 'password';
var mongo_collection = 'terraformia';

var mongoServer = new mongodb.Server(mongo_host, mongo_port, {});

var collections = {
    map: undefined
};




// Global object containing game data
var game = {
    dirtyBit: false,
    levelName: '1',
    // collection of global events containing their handles and time values
    events: {

        daynight: {
            BEACH_RADIUS: 1,
            handle: null,
            interval: 1 * 60 * 1000,
            cycle: 24,
            current: 8,
            payload: function() {
                game.events.daynight.current++;

                var len_y = 200;
                var len_x = 200;
                if (game.events.daynight.current === 9) {
                    var new_trees = 0,
                        new_grass = 0,
                        new_sand = 0;

                    for (var y = 0; y < len_y; y++) {
                        for (var x = 0; x < len_x; x++) {
                            switch(game.map[x][y][0]) {
                                case 0: // grass
                                    if (Math.random() < 1/4000) {
                                        game.map[x][y] = [4, 20]; // tree, 20 health
                                        new_trees++;
                                    }
                                    break;
                                case 1: // dirt
                                    if (Math.random() < 1/5) {
                                        game.map[x][y][0] = 0; // grass
                                        new_grass++;
                                    }
                                    break;
                                case 3: // water
                                    for (var xx = -game.events.daynight.BEACH_RADIUS; xx <= game.events.daynight.BEACH_RADIUS; xx++) {
                                        for (var yy = -game.events.daynight.BEACH_RADIUS; yy <= game.events.daynight.BEACH_RADIUS; yy++) {
                                            if (x+xx < 0 || x+xx >= len_x || y+yy < 0 || y+yy >= len_y) {
                                                break;
                                            }
                                            var tile = game.map[x+xx][y+yy][0];
                                            if (tile == 0 || tile == 1) { // if this is a grass or dirt tile
                                                game.map[x+xx][y+yy][0] = 2; // make it sand
                                                new_sand++;
                                            }
                                        }
                                    }
                                    break;
                            }
                        }
                    }
                    logger("New Trees".blue, new_trees);
                    logger("New Grass".blue, new_grass);
                    logger("New Sand".blue, new_sand);
                    io.sockets.emit('event bigterraform', {});
                }

                if (game.events.daynight.current >= game.events.daynight.cycle) {
                    game.events.daynight.current = 0;
                }

                io.sockets.emit('event time', {
                    time: game.events.daynight.current
                });
                logger("Event".grey, "Time: " + game.events.daynight.current + ":00");
            }
        },

        earthquake: {
            handle: null,
            interval: 7.1 * 24 * 60 * 1000,
            eruptions: 2,
            payload: function() {
                var eruption = function(x, y, ore) {
                    logger("Epicenter".blue, "[" + x + "," + y + "], Type: " + ore);
                    game.map[x+0][y+0] = [ore, 20]; // center point

                    // Big Rocks
                    game.map[x+0][y+1] = [6, 20];
                    game.map[x+0][y+2] = [6, 20];
                    game.map[x+1][y+0] = [6, 20];

                    game.map[x+2][y+0] = [6, 20];
                    game.map[x+0][y-1] = [6, 20];
                    game.map[x+0][y-2] = [6, 20];

                    game.map[x-1][y+0] = [6, 20];
                    game.map[x-2][y+0] = [6, 20];
                    game.map[x+1][y+1] = [6, 20];

                    game.map[x+1][y-1] = [6, 20];
                    game.map[x-1][y-1] = [6, 20];
                    game.map[x-1][y+1] = [6, 20];

                    // Small Rocks
                    game.map[x+1][y+2] = [7, 10];
                    game.map[x+2][y+1] = [7, 10];

                    game.map[x+2][y-1] = [7, 10];
                    game.map[x+1][y-2] = [7, 10];

                    game.map[x-1][y-2] = [7, 10];
                    game.map[x-2][y-1] = [7, 10];

                    game.map[x-2][y+1] = [7, 10];
                    game.map[x-1][y+2] = [7, 10];

                    // Rubble
                    game.map[x-1][y+3] = [8, 1];
                    game.map[x+0][y+3] = [8, 1];
                    game.map[x+1][y+3] = [8, 1];
                    game.map[x+2][y+2] = [8, 1];

                    game.map[x+3][y+1] = [8, 1];
                    game.map[x+3][y+0] = [8, 1];
                    game.map[x+3][y-1] = [8, 1];
                    game.map[x+2][y-2] = [8, 1];

                    game.map[x-1][y-3] = [8, 1];
                    game.map[x+0][y-3] = [8, 1];
                    game.map[x+1][y-3] = [8, 1];
                    game.map[x-2][y-2] = [8, 1];

                    game.map[x-3][y+1] = [8, 1];
                    game.map[x-3][y+0] = [8, 1];
                    game.map[x-3][y-1] = [8, 1];
                    game.map[x-2][y+2] = [8, 1];
                };
                var len_y = 200;
                var len_x = 200;
                var eruption_radius = 4;
                var synthetic_ids = game.getSyntheticTiles();
                var remaining = game.events.earthquake.eruptions;
                var coords = {};
                while (remaining) {
                    coords.x = Math.floor(Math.random() * (len_x - (eruption_radius * 2))) + eruption_radius;
                    coords.y = Math.floor(Math.random() * (len_y - (eruption_radius * 2))) + eruption_radius;
                    // This is all pretty ugly code... Makes sure the center and four corners aren't synthetic
                    if (_.indexOf(synthetic_ids, game.map[coords.x][coords.y][0]) != -1) {
                        continue;
                    } else if (_.indexOf(synthetic_ids, game.map[coords.x+3][coords.y+3][0]) != -1) {
                        continue;
                    } else if (_.indexOf(synthetic_ids, game.map[coords.x+3][coords.y-3][0]) != -1) {
                        continue;
                    } else if (_.indexOf(synthetic_ids, game.map[coords.x-3][coords.y+3][0]) != -1) {
                        continue;
                    } else if (_.indexOf(synthetic_ids, game.map[coords.x-3][coords.y-3][0]) != -1) {
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
                logger("Event".grey, "Earthquake");
            }
        },

        // This code sucks ass!
        corruption: {
            RADIUS: 4,
            handle: null,
            interval: 43 * 1000,
            payload: function() {
                // First, we want to populate an array of which tiles are synthetic and which are not
                var synthetic_ids = game.getSyntheticTiles();
                game.corruption_map = [];
                var len_y = 200;
                var len_x = 200;
                // Now, we want to generate, you know, 40,000 tiles of 0's in a 2d array
                for (var y = 0; y < len_y; y++) {
                    game.corruption_map[y] = [];
                    for (var x = 0; x < len_x; x++) {
                        game.corruption_map[y][x] = 1;
                    }
                }
                // Now, we want to go through all of our tiles, find synthetic ones, and draw a square around it
                for (var y = 0; y < len_y; y++) {
                    for (var x = 0; x < len_x; x++) {
                        if (_.indexOf(synthetic_ids, game.map[x][y][0]) != -1) {
                            for (var xx = -game.events.corruption.RADIUS; xx <= game.events.corruption.RADIUS; xx++) {
                                for (var yy = -game.events.corruption.RADIUS; yy <= game.events.corruption.RADIUS; yy++) {
                                    if (x+xx >= 0 && x+xx < len_x && y+yy >= 0 && y+yy < len_y) {
                                        game.corruption_map[x+xx][y+yy] = 0;
                                    }
                                }
                            }
                        }
                    }
                }

                io.sockets.emit('event corruption', {
                    map: game.corruption_map
                });
                logger("Event".grey, "Corruption Spread");
            }
        },

        npcmovement: {
            handle: null,
            interval: 2 * 1000,
            payload: function() {

                var len = game.npcs.length;
                for(var i = 0; i < len; i++) {
                    var npc = game.npcs[i];

                    if (game.tryNPCChase(npc)) {
                        // success -> heading towards a player
                        continue;
                    }

                    var new_direction = Math.floor(Math.random() * 10);
                    if (new_direction == 0 && npc.x < 199 && game.canNPCWalk(npc.x+1, npc.y)) {
                        npc.x++;
                        npc.d = 'e';
                    } else if (new_direction == 1 && npc.x > 0 && game.canNPCWalk(npc.x-1, npc.y)) {
                        npc.x--;
                        npc.d = 'w';
                    } else if (new_direction == 2 && npc.y < 199 && game.canNPCWalk(npc.x, npc.y+1)) {
                        npc.y++;
                        npc.d = 's';
                    } else if (new_direction == 3 && npc.y > 0 && game.canNPCWalk(npc.x, npc.y-1)) {
                        npc.y--;
                        npc.d = 'n';
                    }
                }
                io.sockets.emit('event npcmovement', {
                    npcs: game.npcs
                });
            }
        }
    },

    // Giant array of map data
    map: [],
    corruption_map: [],
    getTileData: function(x, y) {
        var tile = game.map[x][y];
        var data = {};
        if (tile && typeof tile[0] != 'undefined') {
            data.tile = game.descriptors.terrain[tile[0]];
        }
        if (tile && typeof tile[1] != 'undefined') {
            data.health = tile[1];
        }
        return data;
    },

    canNPCWalk: function(x, y) {
        var tile = game.getTileData(x, y).tile;
        if (tile && tile.block_npc) {
            return false;
        }
        return true;
    },

    canNPCSpawn: function(x, y) {
        if (!game.getTileData(x, y).tile.spawn_npc) {
            return false;
        }
        return true;
    },

    tryNPCChase: function(npc) {
        var radius = 10;
        var deltaX = 0;
        var deltaY = 0;
        var moved = false;
        for (var i = 0; i < game.players.length; i++) {
            deltaX = game.players[i].x - npc.x;
            deltaY = game.players[i].y - npc.y;
            moved = false;

            if (deltaX >= 0 && deltaX <= radius && npc.x < 199 && game.canNPCWalk(npc.x+1, npc.y)) {
                npc.x++;
                npc.d = 'e';
                moved = true;
            } else if (deltaX <= 0 && deltaX >= -radius && npc.x > 0 && game.canNPCWalk(npc.x-1, npc.y)) {
                npc.x--;
                npc.d = 'w';
                moved = true;
            }

            if (deltaY >= 0 && deltaY <= radius && npc.y < 199 && game.canNPCWalk(npc.x, npc.y+1)) {
                npc.y++;
                npc.d = 's';
                moved = true;
            } else if (deltaY <= 0 && deltaY >= -radius && npc.y > 0 && game.canNPCWalk(npc.x, npc.y-1)) {
                npc.y--;
                npc.d = 'n';
                moved = true;
            }

            if (moved) {
                return true;
            }
        }
        return false;
    },

    // Array of known player locations
    players: [],

    // Array of NPC locations
    npcs: [],

    // Data from tilesets JSON
    descriptors: {},

    getSyntheticTiles: function() {
        var len_t = game.descriptors.terrain.length;
        var synthetic_ids = [];
        for (var k = 0; k < len_t; k++) {
            if (game.descriptors.terrain[k].synthetic) {
                synthetic_ids.push(k);
            }
        }
        return synthetic_ids;
    }
};

function initializeTimers() {
    // Initialize timers
    _.each(game.events, function(event) {
        event.handle = setInterval(
            event.payload,
            event.interval
        );
    });
}

function logger(title, message) {
    while (title.length < 26) {
        title = title + ' ';
    }
    console.log(title + message);
}

function buildMap(db) {
    logger("MongoDB".blue, "Attempting to build the database");
    var fileContents = fs.readFileSync('map.json','utf8');
    var mapData = JSON.parse(fileContents);
    db.collection('maps', function(err, collection) {
        logger("MongoDB".blue, "Connecting to the map collection");
        if (err) {
            logger("Error".red, err);
            throw err;
        }
        logger("MongoDB".blue, "Cool, I connected to the collection");
        collection.remove({}, function(err, result) {
            logger("MongoDB".blue, "Removing the entries from the collection");
            collection.insert({map: mapData, levelName: game.levelName});
            collection.count(function(err, count) {
                logger("MongoDB".blue, "Done counting, not sure what I found");
                if (count == 1) {
                    game.map = mapData;
                    logger("MongoDB".blue, "Map was rebuilt from map.json file");
                }
            });
        });
    });
}

new mongodb.Db(mongo_collection, mongoServer, {safe:false}).open(function(err, db) {
	if (err) throw err;

    // indexing query


    var runGame = function() {
        fs.readFile('assets/tilesets/data.json', function(err, data) {
            if (err) throw err;
            game.descriptors = JSON.parse(data);
            setTimeout(function() {
                var remaining = 80;
                var coords = {};
                var npc_id;
                while (remaining) {
                    coords.x = Math.floor(Math.random() * 199);
                    coords.y = Math.floor(Math.random() * 199);
                    if (!game.canNPCSpawn(coords.x, coords.y)) {
                        continue;
                    }
                    npc_id = Math.floor(Math.random() * 8);
                    game.npcs.push({id: npc_id, x: coords.x, y: coords.y, d: 's'});// throwing them in at a slash for now
                    remaining--;
                }
            }, 1000);
        });

        // Every minute we want to write the database from memory to mongo
        setInterval(function() {
            if ( game.dirtyBit ) {
                db.collection('maps', function(err, collection) {
                    if (err) {
                        logger("MongoDB".red, "Error selecting map collection to save", err);
                    }

                    collection.update({levelName: game.levelName}, {$set: {map: game.map}}, function(err, result) {
                        logger("MongoDB".green, "Yo dawg, I hear you like to save maps to the db.");
                        game.dirtyBit = false;
                    });
                });
            }
        }, 5000); // Save map to Mongo once every minute

        logger("Express".magenta, "Attempting to listen on: " + server_address + ':' + server_port);

        server.listen(server_port, server_address);
        app.on('error', function (e) {
            if (e.code == 'EADDRINUSE') {
                logger("Express".red, "Address in use, trying again...");
                setTimeout(function () {
                    app.close();
                    app.listen(server_port, server_address);
                }, 1000);
            } else if (e.code == 'EACCES') {
                logger("Express".red, "You don't have permissions to bind to this address. Try running via sudo.");
            } else {
                logger("Express".red, e);
            }
        });

        // User requests root, return HTML
        app.get('/', function (req, res) {
            res.sendfile(__dirname + '/index.html');
        });

        app.get('/favicon.ico', function (req, res) {
            res.sendfile(__dirname + '/favicon.ico');
        });

        // User request map, return map JSON from RAM
        app.get('/map', function(req, res) {
            res.send(game.map);
        });

        // User requests map builder page, builds map from JSON file, returns OK
        app.get('/build-map', function(req, res) {
            buildMap(mongoServer);
            res.send("Rebuilt Map");
        });

        // Exports the map from the database to JSON
        app.get('/export-map', function(req, res) {
            db.collection('maps', function(err, collection) {
                if (err) {
                    res.send(err);
                    throw err;
                }
                collection.findOne({}, {}, function(err, item) {
                    if (err) {
                        res.send(err);
                        throw err;
                    }
                    if (item != null) {
                        var data = JSON.stringify(item.map);
                        fs.writeFileSync('map-export.json', data, 'utf8');
                        res.send("Backed up map");
                        return;
                    } else {
                        res.send("Couldn't back up map");
                        return;
                    }
                });

            });
        });

        // User requests a file in the assets folder, read it and return it
        app.get('/assets/*', function (req, res) {
            // is this secure? in PHP land it would be pretty bad
            res.sendfile(__dirname + '/assets/' + req.params[0]);
        });

        // Builds the map object with data from the mongo db
        db.collection('maps', function(err, collection) {
            if (err) {
                logger("MongoDB".red, "Map collection doesn't exist", err);
                throw err;
            }
            collection.findOne({}, {}, function(err, item) {
                if (err) {
                    logger("MongoDB".red, "Map collection is empty", err);
                    throw err;
                }
                if (item != null) {
                    game.map = item.map;
                    initializeTimers();
                    return;
                } else {
                    logger("MongoDB".red, "The map in Mongo is null");
                    buildMap(mongoServer);
                    return;
                }
            });
        });

        io.sockets.on('connection', function (socket) {
            logger("Player".cyan, "Connected");
            //npc locations
            //corruption zones

            // Send the list of known players, one per packet
            setTimeout(
                function() {
                    socket.emit('chat', {
                        name: 'Server',
                        message: 'Socket Established',
                        priority: 'server'
                    });
                    _.each(game.players, function(player) {
                        socket.emit('character info',
                            player
                        );
                    });
                    socket.emit('event time', {
                        time: game.events.daynight.current
                    });
                    if (game.corruption_map.length) {
                        // Don't send corruption if we haven't figured it out yet
                        socket.emit('event corruption', {
                            map: game.corruption_map
                        });
                    }
                    if (game.npcs.length) {
                        // Don't send NPCs if we don't have any
                        socket.emit('event npcmovement', {
                            npcs: game.npcs
                        });
                    }
                },
                100
            );

            // Receive chat, send chats to all users
            socket.on('chat', function (data) {
                var message = sanitizer.escape(data.message.substr(0, 100));
                var name = sanitizer.escape(data.name);
                socket.broadcast.emit('chat', {
                    session: this.id,
                    name: name,
                    message: message
                });
                logger("Chat".blue, "Name: " + data.name + ", Message: " + data.message);
            });

            socket.on('join', function(data) {
                var session_id = this.id;
                logger("Player".cyan, "Connected, Name: " + data.name);
                socket.broadcast.emit('chat', {
                    session: session_id,
                    name: data.name,
                    message: 'Player Connected',
                    priority: 'server'
                });
            });

            // when a user disconnects, remove them from the players array, and let the world know
            socket.on('disconnect', function(data) {
                logger("Player".cyan, "Disconnected");
                var session_id = this.id;
                var len = game.players.length;
                var player_name;
                for (var i=0; i<len; i++) {
                    if (game.players[i].session == session_id) {
                        player_name = game.players[i].name;
                        game.players.splice(i, 1);
                        break;
                    }
                }
                socket.broadcast.emit('leave', {
                    session: session_id,
                    name: player_name || null
                });
            });

            // Get an update from the client for their char's name and picture
            socket.on('character info', function(data) {
                data.session = this.id;
                if (data.name) {
                    data.name = sanitizer.escape(data.name.substr(0, 12));
                }
                if (data.picture) {
                    data.picture = parseInt(data.picture, 10);
                    if (isNaN(data.picture) || data.picture > 15) {
                        data.picture = 0;
                    }
                }
                socket.broadcast.emit('character info', data);
                var len = game.players.length;
                var foundPlayer = false;
                for (var i=0; i<len; i++) {
                    if (game.players[i].session == data.session) {
                        _.extend(
                            game.players[i],
                            data
                        );
                        foundPlayer = true;
                        break;
                    }
                }
                if (!foundPlayer) {
                    game.players.push(data);
                }
            });

            // a user made a change to the world
            socket.on('terraform', function(data) {
                game.dirtyBit = true;

                socket.broadcast.emit('terraform', {
                    session: this.id,
                    x: data.x,
                    y: data.y,
                    tile: data.tile
                });

                game.map[data.x][data.y] = data.tile;
            });
        });
    };

    if (mongo_req_auth) {
        mongoServer.uthenticate(mongo_user, mongo_pass, function(err, data) {
            runGame();
        });
    } else {
        runGame();
    }
});

