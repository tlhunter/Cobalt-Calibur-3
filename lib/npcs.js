var logger = require('./logger.js');

var NonPlayableCharacters = function() {
    var self = this;
    self.data = []; // Corruption map

    var handle;
    const interval = 2 * 1000; // about every three days
    var map;
    var io;
    var players;

    self.setMap = function(new_map) {
        map = new_map;
        return self;
    };

    self.setSocket = function(new_io) {
        io = new_io;
        return self;
    };

    self.setPlayers = function(new_players) {
        players = new_players;
        return self;
    };

    self.spawn = function(amount) {
        logger.info('NPC', "Spawning bad guys");
        var remaining = amount;
        var coords = {};
        var npc_id;
        while (remaining) {
            coords.x = Math.floor(Math.random() * 199);
            coords.y = Math.floor(Math.random() * 199);

            if (!map.canNPCSpawn(coords.x, coords.y)) {
                continue;
            }

            npc_id = Math.floor(Math.random() * 8);
            self.data.push({id: npc_id, x: coords.x, y: coords.y, d: 's'});// throwing them in at a slash for now
            remaining--;
        }
    };

    self.tryNPCChase = function(npc) {
        var radius = 10;
        var deltaX = 0;
        var deltaY = 0;
        var moved = false;

        var player_coords = players.data;

        for (var i = 0; i < player_coords.length; i++) {
            deltaX = player_coords[i].x - npc.x;
            deltaY = player_coords[i].y - npc.y;
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
    };

    /*
     * Send NPC positions to socket.
     * If no socket is provided, send to all sockets.
     */
    self.sendData = function(socket) {
        if (!socket) {
            socket = io.sockets;
        }

        socket.emit('event npcmovement', {
            npcs: self.data
        });
    };

    var loop = function() {
        var len = self.data.length;
        for (var i = 0; i < len; i++) {
            var npc = self.data[i];

            if (self.tryNPCChase(npc)) {
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

        self.sendData();
    };

    self.execute = function() {
        handle = setInterval(loop, interval);
        loop();
    };
};

module.exports = new NonPlayableCharacters();
