// Use clean code
'use strict';

// requires
var app = require('express').createServer();
var io = require('socket.io').listen(app);
var Db = require('mongodb').Db;
var fs = require('fs');
var sanitizer = require('sanitizer');
var _und = require("underscore");
var Connection = require('mongodb').Connection;
var Server = require('mongodb').Server;

var mongo_host = process.env['MONGO_NODE_DRIVER_HOST'] != null ? process.env['MONGO_NODE_DRIVER_HOST'] : 'localhost';
var mongo_port = process.env['MONGO_NODE_DRIVER_PORT'] != null ? process.env['MONGO_NODE_DRIVER_PORT'] : Connection.DEFAULT_PORT;

console.log("MongoDB: Connecting to " + mongo_host + ":" + mongo_port);
var db = new Db('terraformia', new Server(mongo_host, mongo_port, {}), {native_parser:false});

// Global object containing game data
var game = {
    // Giant array of map data
    map: [],

    // Array of known player locations
    players: [],
};

db.open(function(err, db) {

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

        // Let the client know they're not alone
        setTimeout(
            function() {
                socket.emit('chat', {
                    name: 'Server',
                    message: 'Socket Established',
                    priority: 'server'
                });
            },
            20
        );

        // Send the list of known players, one per packet
        setTimeout(
            function() {
                _und.each(game.players, function(player) {
                    socket.emit('move',
                        player
                    );
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
            var session = this.id;
            var char_name = sanitizer.escape(data.name.substr(0, 12));
            var picture = parseInt(data.picture, 10);
            if (isNaN(picture)) {
                picture = 56;
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
                tile: data.tile,
                layer: data.layer
            });

            game.map[data.y][data.x][data.layer] = data.tile;
        });
    });
});
