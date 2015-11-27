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
        // Receive chat, send chat event to all users in room
        socket.on('chat', function (data) {
            var message = sanitizer.escape(data.message.substr(0, 100));
            var name = sanitizer.escape(data.name);
            io.sockets.to(data.levelName).emit('chat', {
                session: this.id,
                name: name,
                message: message
            });
            logger.info("Chat", data.name + ": " + data.message);
        });

        socket.on('join', function(data) {
            // Receive room join, send join event to all users in room
            var session_id = this.id;
            logger.action("Player", "Connected, Name: " + data.name);
            io.sockets.to(data.levelName).emit('chat', {
                session: session_id,
                name: data.name,
                message: 'Player Entered Level',
                priority: 'server'
            });
            socket.join(data.levelName);
            self.sendData(socket, data.levelName);
        });

        socket.on('unjoin', function(data) {
            // Receive room unjoin, send unjoin event to all users in room
            var session_id = this.id;
            logger.action("Player", "Connected, Name: " + data.name);
            socket.leave(data.levelName);
            io.sockets.to(data.levelName).emit('chat', {
                session: session_id,
                name: data.name,
                message: 'Player Left Level',
                priority: 'server'
            });
        });

        // when a user disconnects, remove them from the players array, and let the room know
        socket.on('disconnect', function(data) {
            // Receive disconnect, send leave event to all users in room
            logger.action("Player", "Disconnected");
            var session_id = this.id;
            var len = self.data.length;
            var player_name;
            var player_level;

            for (var i=0; i<len; i++) {
                if (self.data[i].session == session_id) {
                    player_name  = self.data[i].name;
                    player_level = self.data[i].levelName;
                    self.data.splice(i, 1);
                    break;
                }
            }

            io.sockets.to(player_level).emit('disconnect', {
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

            io.sockets.to(data.levelName).emit('character info', data);

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
    self.sendData = function(socket, levelName) {
        if (!socket) {
            socket = io.sockets;
        }

        _.each(self.data, function(player) {
            if (player.levelName == levelName) {
                console.log(player.levelName + '==' + levelName);
                socket.to(levelName).emit('character info',
                    player
                );
            }
        });
    };
};

module.exports = new Players();
