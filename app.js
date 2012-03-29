// Use clean code
'use strict';

// requires
var app         = require('express').createServer();
var io          = require('socket.io').listen(app);
var Db          = require('mongodb').Db;
var fs          = require('fs');
var sanitizer   = require('sanitizer');
var _           = require('underscore');
var connection  = require('mongodb').Connection;
var server      = require('mongodb').Server;

// Database connection
var mongo_host  = process.env['MONGO_NODE_DRIVER_HOST'] != null ? process.env['MONGO_NODE_DRIVER_HOST'] : 'localhost';
var mongo_port  = process.env['MONGO_NODE_DRIVER_PORT'] != null ? process.env['MONGO_NODE_DRIVER_PORT'] : connection.DEFAULT_PORT;
var db          = new Db('terraformia', new server(mongo_host, mongo_port, {}), {native_parser:false});

// Global object containing game data
var game = {
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
                                    if (Math.random() < 1/1000) {
                                        game.map[x][y] = [4, 20]; // tree, 20 health
                                        new_trees++;
                                    }
                                    break;
                                case 1: // dirt
                                    if (Math.random() < 1/100) {
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
                    console.log("New Trees: " + new_trees + ", New Grass: " + new_grass + ", New Sand: " + new_sand);
                    io.sockets.emit('event bigterraform', {});
                }

                if (game.events.daynight.current >= game.events.daynight.cycle) {
                    game.events.daynight.current = 0;
                }

                io.sockets.emit('event time', {
                    time: game.events.daynight.current
                });
                console.log("Event: Time (" + game.events.daynight.current + ")");
            }
        },

        earthquake: {
            handle: null,
            interval: 72 * 60 * 1000,
            payload: function() {
                io.sockets.emit('event earthquake', {
                });
                console.log("Event: Earthquake");
            }
        },

        // This code sucks ass!
        corruption: {
            RADIUS: 4,
            handle: null,
            interval: 61 * 1000, // Every minute and a second
            payload: function() {
                // First, we want to populate an array of which tiles are synthetic and which are not
                var len_t = game.descriptors.terrain.length;
                var synthetic_ids = [];
                var corruption_map = [];
                for (var k = 0; k < len_t; k++) {
                    if (game.descriptors.terrain[k].synthetic) {
                        synthetic_ids.push(k);
                    }
                }
                var len_y = 200;
                var len_x = 200;
                // Now, we want to generate, you know, 40,000 tiles of 0's in a 2d array
                for (var y = 0; y < len_y; y++) {
                    corruption_map[y] = [];
                    for (var x = 0; x < len_x; x++) {
                        corruption_map[y][x] = 1;
                    }
                }
                // Now, we want to go through all of our tiles, find synthetic ones, and draw a square around it
                for (var y = 0; y < len_y; y++) {
                    for (var x = 0; x < len_x; x++) {
                        if (_.indexOf(synthetic_ids, game.map[x][y][0]) != -1) {
                            for (var xx = -game.events.corruption.RADIUS; xx <= game.events.corruption.RADIUS; xx++) {
                                for (var yy = -game.events.corruption.RADIUS; yy <= game.events.corruption.RADIUS; yy++) {
                                    corruption_map[x+xx][y+yy] = 0;
                                }
                            }
                        }
                    }
                }

                io.sockets.emit('event corruption', {
                    map: corruption_map
                });
                console.log("Event: Corruption");
            }
        },

        npcmovement: {
            handle: null,
            interval: 5 * 1000,
            payload: function() {
                var len = game.npcs.length;
                for(var i = 0; i < len; i++) {
                    var npc = game.npcs[i];
                    var direction = Math.floor(Math.random() * 6);
                    if (direction == 1 && npc.x < 200) {
                        npc.x++;
                    } else if (direction == 2 && npc.x > 0) {
                        npc.x--;
                    } else if (direction == 3 && npc.y < 200) {
                        npc.y++;
                    } else if (direction == 4 && npc.y > 0) {
                        npc.y--;
                    }
                }
                io.sockets.emit('event npcmovement', {
                    npcs: game.npcs
                });
                console.log("Event: NPC Movement");
            }
        }
    },

    // Giant array of map data
    map: [],

    // Array of known player locations
    players: [],

    // Array of NPC locations
    npcs: [],

    // Data from tilesets JSON
    descriptors: {},
};

// Initialize timers
_.each(game.events, function(event) {
    event.handle = setInterval(
        event.payload,
        event.interval
    );
});

db.open(function(err, db) {
    fs.readFile('assets/tilesets/data.json', function(err, data) {
        if (err) throw err;
        game.descriptors = JSON.parse(data);
        for (var i = 0; i < 100; i++) {
            game.npcs.push({id: 23, x: i*2, y:i*2});// throwing them in at a slash for now
        }
    });

    // Every minute we want to write the database from memory to mongo
    setInterval(function() {
        db.collection('maps', function(err, collection) {
            if (err) {
                console.log("MongoDB: Error selecting map collection to save", err);
            }
            collection.remove({}, function(err, result) {
                console.log("MongoDB: Deleting previous map");
                collection.insert({map: game.map});
                collection.count(function(err, count) {
                    if (count == 1) {
                        console.log("MongoDB: Map saved to database");
                    } else {
                        console.log("MongoDB: Error Saving Map");
                    }
                });
            });
        });
    }, 60000); // Save map to Mongo once every minute

    console.log("Express: Attempting to listen on port 81");
    app.listen(81);

    // User requests root, return HTML
    app.get('/', function (req, res) {
        res.sendfile(__dirname + '/index.html');
    });

    // User request map, return map JSON from RAM
    app.get('/map', function(req, res) {
        res.send(game.map);
    });

    // User requests map builder page, builds map from JSON file, returns OK
    app.get('/build-map', function(req, res) {
        var fileContents = fs.readFileSync('map.json','utf8');
        var mapData = JSON.parse(fileContents);
        db.collection('maps', function(err, collection) {
            if (err) {
                res.send(err);
                throw err;
            }
            collection.remove({}, function(err, result) {
                collection.insert({map: mapData});
                collection.count(function(err, count) {
                    if (count == 1) {
                        game.map = mapData;
                        console.log("Map was rebuilt from map.json file");
                        res.send('ok');
                    }
                });
            });
        });
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
            console.log("MongoDB: Map collection doesn't exist", err);
            throw err;
        }
        collection.findOne({}, {}, function(err, item) {
            if (err) {
                console.log("MongoDB: Map collection is empty", err);
                throw err;
            }
            if (item != null) {
                game.map = item.map;
                return;
            } else {
                console.log("MongoDB: The map in Mongo is null");
                return;
            }
        });
    });

    io.sockets.on('connection', function (socket) {
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
                    socket.emit('move',
                        player
                    );
                });
                socket.emit('event time', {
                    time: game.events.daynight.current
                });
            },
            50
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
            console.log("Chat", this.id, data);
        });

        // when a user disconnects, remove them from the players array, and let the world know
        socket.on('disconnect', function(data) {
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
            console.log(data);
            var session = this.id;
            var char_name = sanitizer.escape(data.name.substr(0, 12));
            var picture = parseInt(data.picture, 10);
            if (isNaN(picture) || picture > 15) {
                picture = 0;
            }
            socket.broadcast.emit('character info', {
                session: session,
                name: char_name,
                picture: picture
            });
            var len = game.players.length;
            var foundPlayer = false;
            for (var i=0; i<len; i++) {
                if (game.players[i].session == session) {
                    game.players[i].name = char_name;
                    game.players[i].picture = data.picture;
                    foundPlayer = true;
                    break;
                }
            }
            if (!foundPlayer) {
                game.players.push({
                    session: session,
                    name: char_name,
                    picture: data.picture,
                    direction: 's',
                    x: 0,
                    y: 0
                });
            }
        });

        // Receive movement, send to all users
        socket.on('move', function(data) {
            var session = this.id;
            socket.broadcast.emit('move', {
                session: session,
                x: data.x,
                y: data.y,
                direction: data.direction
            });
            // update players table
            var foundPlayer = false;
            var len = game.players.length;
            for (var i=0; i<len; i++) {
                if (game.players[i].session == session) {
                    game.players[i].x = data.x;
                    game.players[i].y = data.y;
                    foundPlayer = true;
                    break;
                }
            }
            if (!foundPlayer) {
                game.players.push({
                    session: session,
                    x: data.x,
                    y: data.y,
                    direction: data.direction
                });
            }
        });

        // Receive terraform, sent to ALL USERZ!!1
        socket.on('terraform', function(data) {
            socket.broadcast.emit('terraform', {
                session: this.id,
                x: data.x,
                y: data.y,
                tile: data.tile
            });

            game.map[data.x][data.y] = data.tile;
        });
    });
});
