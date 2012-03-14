'use strict';

var app = require('express').createServer(),
    io = require('socket.io').listen(app),
    Db = require('mongodb').Db,
    fs = require('fs'),
    Connection = require('mongodb').Connection,
    Server = require('mongodb').Server;

var host = process.env['MONGO_NODE_DRIVER_HOST'] != null ? process.env['MONGO_NODE_DRIVER_HOST'] : 'localhost';
var port = process.env['MONGO_NODE_DRIVER_PORT'] != null ? process.env['MONGO_NODE_DRIVER_PORT'] : Connection.DEFAULT_PORT;

console.log("MongoDB: Connecting to " + host + ":" + port);

var db = new Db('terraformia', new Server(host, port, {}), {native_parser:true});

var map = [];

db.open(function(err, db) {
    // Delete previous location entries... Fix this when we no longer use session id's as user identifiable data
    db.collection('locations', function(err, collection) {
        collection.remove();
    });

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
            10
        );

        // Send the list of known locations, one per message
        setTimeout(
            function() {
                db.collection('locations', function(err, collection) {
                    collection.find({}, {}, function(err, cursor) {
                        cursor.each(function(err, player) {
                            if (player == null) {
                                return;
                            }
                            socket.emit('move', {
                                session: player.session,
                                x: player.x,
                                y: player.y
                            });
                        });
                    });
                });
            },
            50
        );

        setInterval(function() {
            db.collection('maps', function(err, collection) {
                if (err) {
                    console.log("Error Saving Map to MongoDB", err);
                }
                collection.remove({}, function(err, result) {
                    collection.insert({map: map});
                    collection.count(function(err, count) {
                        if (count == 1) {
                            socket.emit('chat', {
                                name: 'Server',
                                message: 'Map saved to database',
                                priority: 'server'
                            });
                        } else {
                            console.log("Error Saving Map!");
                        }
                    });
                });
            });
        }, 60000);

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
            db.collection('locations', function(err, collection) {
                collection.remove({session: session_id}, function(err, result) {
                    if (err) {
                        console.log("Error removing a disconnected user from table");
                    }
                });
            });
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
            db.collection('locations', function(err, collection) {
                collection.update(
                    {
                        session: session
                    },
                    {
                        x: data.x,
                        y: data.y,
                        direction: data.direction,
                        session: session
                    },
                    {
                        upsert: true
                    }
                );
            });
            console.log("Move", this.id, data);
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

            console.log("Terraform", this.id, data);
        });

        socket.onclose = function(event) {
            db.collection('locations', function(err, collection) {
                collection.remove({
                    session: this.id
                });
            });
        };
    });
});
