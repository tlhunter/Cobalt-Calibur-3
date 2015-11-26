#!/usr/bin/env node

'use strict';

var express     = require("express");
var app         = express();
var server      = require('http').createServer(app);
var io          = require('socket.io').listen(server, {log: false});
var _           = require('underscore');

var logger      = require('./lib/logger.js');
var world       = require('./lib/world.js').setHttp(app).setSocket(io);
var players     = require('./lib/players.js').setSocket(io);

// Web Server Configuration
var server_port = parseInt(process.argv[2], 10) || 80; // most OS's will require sudo to listen on 80
var server_host = 'localhost';

var mongo_connection_string = 'mongodb://127.0.0.1:27017/terraformia';

world.connect(mongo_connection_string, function(err) {
    if (err) {
        logger.error(err);
        throw err;
    }
    world.loadMaps(function (err) {
        if (err) {
            logger.error(err);
            throw err;
        }
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
    players.handleSocketEvents(socket);
    world.handleSocketEvents(socket);
});