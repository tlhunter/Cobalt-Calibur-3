#!/usr/bin/env node

'use strict';

var fs          = require('fs');
var express 	= require("express");
var app 		= express();
var server		= require('http').createServer(app);
var io          = require('socket.io').listen(server, {log: false});
var sanitizer   = require('sanitizer');
var _           = require('underscore');

var players     = require('./lib/players.js').setSocket(io);
var logger      = require('./lib/logger.js');
var map         = require('./lib/map.js');
var corruption  = require('./lib/corruption.js').setMap(map).setSocket(io);
var daynight    = require('./lib/daynight.js').setMap(map).setSocket(io);
var earthquake  = require('./lib/earthquake.js').setMap(map).setSocket(io);
var terrain     = require('./lib/terrain.js').setMap(map);
var npcs        = require('./lib/npcs.js').setMap(map).setSocket(io).setPlayers(players);

// Web Server Configuration
var server_port = parseInt(process.argv[2], 10) || 80; // most OS's will require sudo to listen on 80
var server_host = null;

var mongo_connection_string = 'mongodb://127.0.0.1:27017/terraformia';


function initializeTimers() {
    // Initialize timers
    // TODO: Eventually move these all to separate modules
    corruption.execute();
    daynight.execute();
    earthquake.execute();
    npcs.execute();
}

map.connect(mongo_connection_string, function(err) {
    if (err) throw err;

    logger.notice("Express", "Attempting to listen on: " + server_host + ':' + server_port);

    server.listen(server_port, server_host);
    app.on('error', function (e) {
        if (e.code == 'EADDRINUSE') {
            logger.error("Express", "Address in use. Quitting...");
            process.exit();
        } else if (e.code == 'EACCES') {
            logger.error("Express", "You don't have permissions to bind to this address. Try running via sudo.");
        } else {
            logger.error("Express", e);
            process.exit();
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
        res.send(map.data);
    });

    // User requests map builder page, builds map from JSON file, returns OK
    app.get('/build-map', function(req, res) {
        map.buildMap(function(err) {
            if (err) {
                res.send(500, "Couldn't build map.");
                return;
            }

            res.send(200, "Rebuilt Map");
        });
    });

    // User requests a file in the assets folder, read it and return it
    app.get('/assets/*', function (req, res) {
        // is this secure? in PHP land it would be pretty bad
        res.sendfile(__dirname + '/assets/' + req.params[0]);
    });

    map.loadMap(function(err) {
        if (err) throw err;

        npcs.spawn(80);

        initializeTimers();
    });

    io.sockets.on('connection', function (socket) {
        logger.action("Player", "Connected");
        // Send the list of known players, one per packet
        setImmediate(function() {
            socket.emit('chat', {
                name: 'Server',
                message: 'Socket Established',
                priority: 'server'
            });

            players.sendData(socket);

            daynight.sendData(socket);

            corruption.sendData(socket);

            npcs.sendData(socket);
        });

        // Receive chat, send chats to all users
        socket.on('chat', function (data) {
            var message = sanitizer.escape(data.message.substr(0, 100));
            var name = sanitizer.escape(data.name);
            socket.broadcast.emit('chat', {
                session: this.id,
                name: name,
                message: message
            });
            logger.info("Chat", data.name + ": " + data.message);
        });

        socket.on('join', function(data) {
            var session_id = this.id;
            logger.action("Player", "Connected, Name: " + data.name);
            socket.broadcast.emit('chat', {
                session: session_id,
                name: data.name,
                message: 'Player Connected',
                priority: 'server'
            });
        });

        // when a user disconnects, remove them from the players array, and let the world know
        socket.on('disconnect', function(data) {
            logger.action("Player", "Disconnected");
            var session_id = this.id;
            var len = players.data.length;
            var player_name;
            for (var i=0; i<len; i++) {
                if (players.data[i].session == session_id) {
                    player_name = players.data[i].name;
                    players.data.splice(i, 1);
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
            var len = players.data.length;
            var foundPlayer = false;
            for (var i=0; i<len; i++) {
                if (players.data[i].session == data.session) {
                    _.extend(
                        players.data[i],
                        data
                    );
                    foundPlayer = true;
                    break;
                }
            }
            if (!foundPlayer) {
                players.data.push(data);
            }
        });

        // a user made a change to the world
        socket.on('terraform', function(data) {
            map.dirty();

            socket.broadcast.emit('terraform', {
                session: this.id,
                x: data.x,
                y: data.y,
                tile: data.tile
            });

            map.data[data.x][data.y] = data.tile;
        });
    });
});

