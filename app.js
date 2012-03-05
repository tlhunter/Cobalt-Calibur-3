var app = require('express').createServer(),
    io = require('socket.io').listen(app),
    Db = require('mongodb').Db,
    Connection = require('mongodb').Connection,
    Server = require('mongodb').Server;

var host = process.env['MONGO_NODE_DRIVER_HOST'] != null ? process.env['MONGO_NODE_DRIVER_HOST'] : 'localhost';
var port = process.env['MONGO_NODE_DRIVER_PORT'] != null ? process.env['MONGO_NODE_DRIVER_PORT'] : Connection.DEFAULT_PORT;

console.log("MongoDB: Connecting to " + host + ":" + port);

var db = new Db('terraformia', new Server(host, port, {}), {native_parser:true});

db.open(function(err, db) {
    console.log("Express: Attempting to listen on port 81");
    app.listen(81);

    app.get('/', function (req, res) {
        res.sendfile(__dirname + '/index.html');
    });

    // Returns the entire map object, terraforming changes will be sent via websocket
    app.get('/map', function(req, res) {

    });

    // Builds the map from the json file, should only need to be run once
    app.get('/build-map', function(req, res) {

    });

    app.get('/assets/*', function (req, res) {
        // is this secure? in PHP land it would be pretty bad
        res.sendfile(__dirname + '/assets/' + req.params[0]);
    });

    io.sockets.on('connection', function (socket) {

        socket.emit('chat', { username: 'Server', message: 'Socket Connection Established', priority: 'server' });

        socket.on('chat', function (data) {
            socket.broadcast.emit('chat', data);
        });

        socket.on('move', function(data) {
            socket.broadcast.emit('move', {user: this.id, loc: data});
        });

        socket.on('terraform', function(data) {
            //broadcast, and update map
        });

    });
});
