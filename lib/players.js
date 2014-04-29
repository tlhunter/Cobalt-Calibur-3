var _ = require('underscore');
var logger = require('./logger.js');

var Players = function() {
    var self = this;
    self.data = []; // Player Coordinates

    var io;

    self.setSocket = function(new_io) {
        io = new_io;
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
