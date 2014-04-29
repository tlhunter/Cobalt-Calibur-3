#!/usr/bin/env node

'use strict';

var express 	= require("express");
var app 		= express();
var server		= require('http').createServer(app);
var io          = require('socket.io').listen(server, {log: false});
var _           = require('underscore');

var players     = require('./lib/players.js').setSocket(io);
var logger      = require('./lib/logger.js');
var map         = require('./lib/map.js').setHttp(app);
var corruption  = require('./lib/corruption.js').setMap(map).setSocket(io);
var daynight    = require('./lib/daynight.js').setMap(map).setSocket(io);
var earthquake  = require('./lib/earthquake.js').setMap(map).setSocket(io);
var terrain     = require('./lib/terrain.js').setMap(map);
var npcs        = require('./lib/npcs.js').setMap(map).setSocket(io).setPlayers(players);

// Web Server Configuration
var server_port = parseInt(process.argv[2], 10) || 80; // most OS's will require sudo to listen on 80
var server_host = null;

var mongo_connection_string = 'mongodb://127.0.0.1:27017/terraformia';


map.connect(mongo_connection_string, function(err) {
    if (err) {
        logger.error(err);
        throw err;
    }

    map.loadMap(function(err) {
        if (err) {
            logger.error(err);
            throw err;
        }

        npcs.spawn(80);
        corruption.execute();
        daynight.execute();
        earthquake.execute();
        npcs.execute();
    });

});

// HTTP

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

// User requests a file in the assets folder, read it and return it
app.get('/assets/*', function (req, res) {
    // is this secure? in PHP land it would be pretty bad
    res.sendfile(__dirname + '/assets/' + req.params[0]);
});

// SOCKETS

io.sockets.on('connection', function (socket) {
    logger.action("Player", "Connected");

    socket.emit('chat', {
        name: 'Server',
        message: 'Socket Established',
        priority: 'server'
    });

    players.sendData(socket);
    daynight.sendData(socket);
    corruption.sendData(socket);
    npcs.sendData(socket);

    players.handleSocketEvents(socket);
    map.handleSocketEvents(socket);
});
