'use strict';

var app = require('express').createServer(),
    io = require('socket.io').listen(app),
    Db = require('mongodb').Db,
    fs = require('fs'),
    _und = require("underscore"),
    Connection = require('mongodb').Connection,
    Server = require('mongodb').Server;

var host = process.env['MONGO_NODE_DRIVER_HOST'] != null ? process.env['MONGO_NODE_DRIVER_HOST'] : 'localhost';
var port = process.env['MONGO_NODE_DRIVER_PORT'] != null ? process.env['MONGO_NODE_DRIVER_PORT'] : Connection.DEFAULT_PORT;

console.log("MongoDB: Connecting to " + host + ":" + port);

var db = new Db('terraformia', new Server(host, port, {}), {native_parser:false});

var map = [];
var locations = [];

db.open(function(err, db) {

    setInterval(function() {
        db.collection('maps', function(err, collection) {
            if (err) {
                console.log("MongoDB: Error selecting map collection to save", err);
            }
            collection.remove({}, function(err, result) {
                console.log("MongoDB: Deleting previous map");
                collection.insert({map: map});
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

    app.get('/', function (req, res) {
        res.sendfile(__dirname + '/index.html');
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
                map = item.map;
                return;
            } else {
                console.log("MongoDB: The map in Mongo is null");
                return;
            }
        });
    });


    // Returns the entire map object, terraforming changes will be sent via websocket
    app.get('/map', function(req, res) {
        res.send(map);
    });

    // Builds the map from the json file, should only need to be run once
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

    // Returns all of the known player locations

    // Generic pass through for grabbing files inside of the assets folder
    app.get('/assets/*', function (req, res) {
        // is this secure? in PHP land it would be pretty bad
        res.sendfile(__dirname + '/assets/' + req.params[0]);
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

        // Send the list of known locations, one per message
        setTimeout(
            function() {
                _und.each(locations, function(player) {
                    socket.emit('move',
                        player
                    );
                });
            },
            50
        );

        // Receive chat, send chats to all users
        socket.on('chat', function (data) {
            socket.broadcast.emit('chat', {
                session: this.id,
                name: data.name,
                message: data.message
            });
            console.log("Chat", this.id, data);
        });

        // when a user disconnects, remove them from the db, and let the world know
        socket.on('disconnect', function(data) {
            var session_id = this.id;
            socket.broadcast.emit('leave', {
                session: session_id
            });
            var len = locations.length;
            for (var i=0; i<len; i++) {
                var player = locations[i];
                if (player.session == session_id) {
                    locations.splice(i, 1);
                    break;
                }
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
            // update locations table
            var foundPlayer = false;
            var len = locations.length;
            for (var i=0; i<len; i++) {
                if (locations[i].session == session) {
                    locations[i] = data;
                    locations[i].session = session;
                    foundPlayer = true;
                    break;
                }
            }
            if (!foundPlayer) {
                locations.push({
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

            // update map
            map[data.y][data.x][data.layer] = data.tile;
        });
    });
});
