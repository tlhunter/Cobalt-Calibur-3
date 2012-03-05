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

db.open(function(err, db) {
    console.log("Express: Attempting to listen on port 81");
    app.listen(81);

    app.get('/', function (req, res) {
        res.sendfile(__dirname + '/index.html');
    });

    // Returns the entire map object, terraforming changes will be sent via websocket
    app.get('/map', function(req, res) {
        db.collection('maps', function(err, collection) {
            if (err) {
                res.send(err);
                throw err;
            }
            collection.findOne({}, {}, function(err, item) {
                res.send(item.map);
            });
        });
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

        setTimeout(
            function() {
                socket.emit('chat', {
                    username: 'Server',
                    message: 'Socket Connection Established',
                    priority: 'server'
                });
            },
            10
        );
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

        socket.on('chat', function (data) {
            socket.broadcast.emit('chat', data);
            console.log("Chat", this.id, data);
        });

        socket.on('move', function(data) {
            socket.broadcast.emit('move', {user: this.id, loc: data});
            console.log("Move", this.id, data);
        });

        socket.on('terraform', function(data) {
            //broadcast, and update map
            console.log("Terraform", this.id, data);
        });

    });
});
