var _ = require('underscore');
var logger = require('./logger.js');
var sanitizer   = require('sanitizer');

var Players = function() {
    var self = this;
    self.data = []; // Player Coordinates

    var io;

    self.setSocket = function(new_io) {
        io = new_io;
        return self;
    };

    self.handleSocketEvents = function(socket) {
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
            var len = self.data.length;
            var player_name;

            for (var i=0; i<len; i++) {
                if (self.data[i].session == session_id) {
                    player_name = self.data[i].name;
                    self.data.splice(i, 1);
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

            var len = self.data.length;
            var foundPlayer = false;

            for (var i=0; i<len; i++) {
                if (self.data[i].session == data.session) {
                    _.extend(
                        self.data[i],
                        data
                    );
                    foundPlayer = true;
                    break;
                }
            }

            if (!foundPlayer) {
                self.data.push(data);
            }
        });

        return self;
    };

    /*
     * Send player positions to socket.
     * If no socket is provided, send to all sockets.
     */
    self.sendData = function(socket) {
        if (!socket) {
            socket = io.sockets;
        }

        _.each(self.data, function(player) {
            socket.emit('character info',
                player
            );
        });
    };
};

module.exports = new Players();
