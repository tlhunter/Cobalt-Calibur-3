#!/usr/bin/env node

'use strict';

var fs          = require('fs');
var express 	= require("express");
var app 		= express();
var server		= require('http').createServer(app);
var io          = require('socket.io').listen(server, {log: false});
var sanitizer   = require('sanitizer');
var _           = require('underscore');

var logger      = require('./modules/logger.js');
var map         = require('./modules/map.js');
var corruption  = require('./modules/corruption.js').setMap(map).setSocket(io);
var daynight    = require('./modules/daynight.js').setMap(map).setSocket(io);
var terrain     = require('./modules/terrain.js').setMap(map);

// Web Server Configuration
var server_port = parseInt(process.argv[2], 10) || 80; // most OS's will require sudo to listen on 80
var server_host = null;

var mongo_connection_string = 'mongodb://127.0.0.1:27017/terraformia';

// Global object containing game data
var game = {
    // collection of global events containing their handles and time values
    events: {

        earthquake: {
            handle: null,
            interval: 7.1 * 24 * 60 * 1000,
            eruptions: 2,
            payload: function() {
                var eruption = function(x, y, ore) {
                    logger.info("Epicenter", "[" + x + "," + y + "], Type: " + ore);
                    map.data[x+0][y+0] = [ore, 20]; // center point

                    // Big Rocks
                    map.data[x+0][y+1] = [6, 20];
                    map.data[x+0][y+2] = [6, 20];
                    map.data[x+1][y+0] = [6, 20];

                    map.data[x+2][y+0] = [6, 20];
                    map.data[x+0][y-1] = [6, 20];
                    map.data[x+0][y-2] = [6, 20];

                    map.data[x-1][y+0] = [6, 20];
                    map.data[x-2][y+0] = [6, 20];
                    map.data[x+1][y+1] = [6, 20];

                    map.data[x+1][y-1] = [6, 20];
                    map.data[x-1][y-1] = [6, 20];
                    map.data[x-1][y+1] = [6, 20];

                    // Small Rocks
                    map.data[x+1][y+2] = [7, 10];
                    map.data[x+2][y+1] = [7, 10];

                    map.data[x+2][y-1] = [7, 10];
                    map.data[x+1][y-2] = [7, 10];

                    map.data[x-1][y-2] = [7, 10];
                    map.data[x-2][y-1] = [7, 10];

                    map.data[x-2][y+1] = [7, 10];
                    map.data[x-1][y+2] = [7, 10];

                    // Rubble
                    map.data[x-1][y+3] = [8, 1];
                    map.data[x+0][y+3] = [8, 1];
                    map.data[x+1][y+3] = [8, 1];
                    map.data[x+2][y+2] = [8, 1];

                    map.data[x+3][y+1] = [8, 1];
                    map.data[x+3][y+0] = [8, 1];
                    map.data[x+3][y-1] = [8, 1];
                    map.data[x+2][y-2] = [8, 1];

                    map.data[x-1][y-3] = [8, 1];
                    map.data[x+0][y-3] = [8, 1];
                    map.data[x+1][y-3] = [8, 1];
                    map.data[x-2][y-2] = [8, 1];

                    map.data[x-3][y+1] = [8, 1];
                    map.data[x-3][y+0] = [8, 1];
                    map.data[x-3][y-1] = [8, 1];
                    map.data[x-2][y+2] = [8, 1];
                };
                var len_y = 200;
                var len_x = 200;
                var eruption_radius = 4;
                var remaining = game.events.earthquake.eruptions;
                var coords = {};
                while (remaining) {
                    coords.x = Math.floor(Math.random() * (len_x - (eruption_radius * 2))) + eruption_radius;
                    coords.y = Math.floor(Math.random() * (len_y - (eruption_radius * 2))) + eruption_radius;
                    // This is all pretty ugly code... Makes sure the center and four corners aren't synthetic
                    if (_.indexOf(terrain.synthetics, map.data[coords.x][coords.y][0]) != -1) {
                        continue;
                    } else if (_.indexOf(terrain.synthetics, map.data[coords.x+3][coords.y+3][0]) != -1) {
                        continue;
                    } else if (_.indexOf(terrain.synthetics, map.data[coords.x+3][coords.y-3][0]) != -1) {
                        continue;
                    } else if (_.indexOf(terrain.synthetics, map.data[coords.x-3][coords.y+3][0]) != -1) {
                        continue;
                    } else if (_.indexOf(terrain.synthetics, map.data[coords.x-3][coords.y-3][0]) != -1) {
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
                logger.debug("Event", "Earthquake");
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
                    if (new_direction == 0 && npc.x < 199 && map.canNPCWalk(npc.x+1, npc.y)) {
                        npc.x++;
                        npc.d = 'e';
                    } else if (new_direction == 1 && npc.x > 0 && map.canNPCWalk(npc.x-1, npc.y)) {
                        npc.x--;
                        npc.d = 'w';
                    } else if (new_direction == 2 && npc.y < 199 && map.canNPCWalk(npc.x, npc.y+1)) {
                        npc.y++;
                        npc.d = 's';
                    } else if (new_direction == 3 && npc.y > 0 && map.canNPCWalk(npc.x, npc.y-1)) {
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

    tryNPCChase: function(npc) {
        var radius = 10;
        var deltaX = 0;
        var deltaY = 0;
        var moved = false;
        for (var i = 0; i < game.players.length; i++) {
            deltaX = game.players[i].x - npc.x;
            deltaY = game.players[i].y - npc.y;
            moved = false;

            if (deltaX >= 0 && deltaX <= radius && npc.x < 199 && map.canNPCWalk(npc.x+1, npc.y)) {
                npc.x++;
                npc.d = 'e';
                moved = true;
            } else if (deltaX <= 0 && deltaX >= -radius && npc.x > 0 && map.canNPCWalk(npc.x-1, npc.y)) {
                npc.x--;
                npc.d = 'w';
                moved = true;
            }

            if (deltaY >= 0 && deltaY <= radius && npc.y < 199 && map.canNPCWalk(npc.x, npc.y+1)) {
                npc.y++;
                npc.d = 's';
                moved = true;
            } else if (deltaY <= 0 && deltaY >= -radius && npc.y > 0 && map.canNPCWalk(npc.x, npc.y-1)) {
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
};

function initializeTimers() {
    // Initialize timers
    // TODO: Eventually move these all to separate modules
    _.each(game.events, function(event) {
        event.handle = setInterval(
            event.payload,
            event.interval
        );
    });

    corruption.execute();
    daynight.execute();
}

map.connect(mongo_connection_string, function(err) {
    if (err) throw err;

    setTimeout(function() {
        var remaining = 80;
        var coords = {};
        var npc_id;
        while (remaining) {
            coords.x = Math.floor(Math.random() * 199);
            coords.y = Math.floor(Math.random() * 199);
            if (!map.canNPCSpawn(coords.x, coords.y)) {
                continue;
            }
            npc_id = Math.floor(Math.random() * 8);
            game.npcs.push({id: npc_id, x: coords.x, y: coords.y, d: 's'});// throwing them in at a slash for now
            remaining--;
        }
    }, 1000);

    logger.notice("Express", "Attempting to listen on: " + server_host + ':' + server_port);

    server.listen(server_port, server_host);
    app.on('error', function (e) {
        if (e.code == 'EADDRINUSE') {
            logger.error("Express", "Address in use, trying again...");
            setTimeout(function () {
                app.close();
                app.listen(server_port, server_host);
            }, 1000);
        } else if (e.code == 'EACCES') {
            logger.error("Express", "You don't have permissions to bind to this address. Try running via sudo.");
        } else {
            logger.error("Express", e);
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
        initializeTimers();
    });

    io.sockets.on('connection', function (socket) {
        logger.action("Player", "Connected");
        // Send the list of known players, one per packet
        setTimeout(function() {
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
                time: daynight.getTime()
            });

            if (corruption.data.length) {
                // Don't send corruption if we haven't figured it out yet
                socket.emit('event corruption', {
                    map: corruption.data
                });
            }

            if (game.npcs.length) {
                // Don't send NPCs if we don't have any
                socket.emit('event npcmovement', {
                    npcs: game.npcs
                });
            }
        }, 100);

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

