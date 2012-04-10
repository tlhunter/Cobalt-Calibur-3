// Copyright 2011 Thomas Hunter :3
'use strict';

$(function() {
window.app = {
    initialize: function() {
        app.network.connectSocket();

        app.audio.initialize();

        app.viewport.x = Math.floor(app.TOTALTILES_X / 2) - app.PLAYER_OFFSET_X;
        app.viewport.y = Math.floor(app.TOTALTILES_Y / 2) - app.PLAYER_OFFSET_Y;

        app.screen.width  = app.$canvas.width();
        app.screen.height = app.$canvas.height();
        app.screen.tilesX = app.$canvas.width() / app.TILEWIDTH;
        app.screen.tilesY = app.$canvas.height() / app.TILEHEIGHT;

        app.persistence.load() || app.persistence.createNewPlayer();
        app.player.updateViewport();
        app.player.inventory.resetCounters();

        app.chat.initialize();
        app.network.bindEvents();
        app.network.send.join(app.player.name);

        // Character keypress
        $(document).keypress(function(e) {
            if ($(e.target).is(":input")) {
                return;
            }

            if (e.which == 119) { // w
                app.player.move('n');
            } else if (e.which == 97) { // a
                app.player.move('w');
            } else if (e.which == 115) { // s
                app.player.move('s');
            } else if (e.which == 100) { // d
                app.player.move('e');
            } else if (e.which == 87) { // W
                app.player.setDirection('n');
            } else if (e.which == 65) { // A
                app.player.setDirection('w');
            } else if (e.which == 83) { // S
                app.player.setDirection('s');
            } else if (e.which == 68) { // D
                app.player.setDirection('e');
            } else if (e.which == 116) { // T
                e.preventDefault(); // keeps us from getting a t in the box
                $('#message-input').focus();
            } else if (e.which == 47) { // /
                $('#message-input').focus();
            } else if (e.which >= 49 && e.which <= 54) { // 1 - 6
                var numberPressed = e.which - 48;
                var terrainIndex = numberPressed + 8;
                app.player.placeItem(terrainIndex);
            } else if (e.which == 102) { // f
                app.player.mineFacingTile();
            }
        });

        // global animation and map redraw function
        // Tried using requestAnimationFrame, but that is slow and choppy
        var currentFrame = 0;
        setInterval(function() {
            currentFrame++;
            if (currentFrame % 3 == 0) {
                currentFrame = 0;
                // redraw every 150 ms, but change animation every 450 ms
                app.animFrameGlobal = !app.animFrameGlobal;
                app.player.killIfNpcNearby();
            }
            app.map.render(currentFrame === 0);
        }, 150);

        setTimeout(function() {
            // Display helpful command
            app.chat.message('Help', 'Type /help for some help', 'help');
            app.chat.message('Help', 'Type /nick NEWNAME to change your name', 'help');
            // Broadcast location
            app.network.send.move(app.player.location.x, app.player.location.x, app.player.direction);
            app.updateCharacterInfo();
        }, 500);

        setInterval(function() {
            app.persistence.save();
        }, 3000); // save every 3 seconds

        $(window).unload(function() {
            app.persistence.save();
        });
    },

    god: false,

    // Grab some DOM elements
    $canvas: $('#map'),

    // Build main object

    // Images containing our tilesets
    tilesets: {
        terrain: new Image(),
        characters: new Image(),
        inventory: new Image(),
        descriptors: {}
    },

    // Animation frame data
    animFrameGlobal: false,
    animFrameMe: false,

    // Stores our canvas context object
    handle: document.getElementById('map').getContext('2d'),

    // Dimensions of a single tile
    TILEWIDTH: 16,
    TILEHEIGHT: 16,
    TOTALTILES_X: 200,
    TOTALTILES_Y: 200,

    // Character distance from upper left corner of viewport
    PLAYER_OFFSET_X: 8,
    PLAYER_OFFSET_Y: 8,

    player: {
        direction: 's',
        picture: 0,
        name: '',

        // Coordinates of player
        location: {
            x: 100,
            y: 100
        },

        // Attempts to move the character in the nesw direction we specify
        move: function(d) {
            switch (d) {
                case 'n':
                    if (app.player.location.y <= 0) {
                        app.player.setDirection(d);
                        app.audio.play('walk-fail');
                        return false;
                    }
                    if (!app.player.canMoveTo(app.player.location.x, app.player.location.y - 1)) {
                        app.player.setDirection(d);
                        app.audio.play('walk-fail');
                        return false;
                    }
                    app.player.location.y--;
                    break;
                case 'e':
                    if (app.player.location.x >= app.TOTALTILES_X - 1) {
                        app.player.setDirection(d);
                        app.audio.play('walk-fail');
                        return false;
                    }
                    if (!app.player.canMoveTo(app.player.location.x + 1, app.player.location.y)) {
                        app.player.setDirection(d);
                        app.audio.play('walk-fail');
                        return false;
                    }
                    app.player.location.x++;
                    break;
                case 's':
                    if (app.player.location.y >= app.TOTALTILES_Y - 1) {
                        app.player.setDirection(d);
                        app.audio.play('walk-fail');
                        return false;
                    }
                    if (!app.player.canMoveTo(app.player.location.x, app.player.location.y + 1)) {
                        app.player.setDirection(d);
                        app.audio.play('walk-fail');
                        return false;
                    }
                    app.player.location.y++;
                    break;
                case 'w':
                    if (app.player.location.x <= 0) {
                        app.player.setDirection(d);
                        app.audio.play('walk-fail');
                        return false;
                    }
                    if (!app.player.canMoveTo(app.player.location.x - 1, app.player.location.y)) {
                        app.player.setDirection(d);
                        app.audio.play('walk-fail');
                        return false;
                    }
                    app.player.location.x--;
                    break;
                default:
                    console.log("Invalid Direction", d);
                    return;
                    break;
            }
            app.audio.play('walk');

            // check if we're in corruption, if so, 1/5 chance to kill()
            var loc = app.player.location;
            if (app.map.corruptionDataLoaded && app.map.corruption[loc.x][loc.y]) {
                if (Math.random() < 1/10) {
                    app.player.kill("You were killed by corruption");
                    app.network.send.chat(app.player.name, "*Killed by Corruption*");
                }
            }

            app.animFrameMe = !app.animFrameMe;
            app.player.updateViewport();

            app.player.setDirection(d); // broadcasts location
        },

        inventory: {
            data: [0, 0, 0, 0, 0, 0, 0, 0, 0],

            update: function(index, amount) {
                var data = app.player.inventory.data;
                if (amount < 0) {
                    if (data[index] >= -amount) {
                        data[index] += amount;
                        $('#inventory-'+index).stop().css({fontSize: '8px'}).animate({ fontSize : '15px' }).html(data[index]);
                        return true;
                    }
                    return false;
                } else {
                    data[index] += amount;
                    $('#inventory-'+index).stop().css({fontSize: '22px'}).animate({ fontSize : '15px' }).html(data[index]);
                    return true;
                }
            },

            resetCounters: function() {
                var len = app.player.inventory.data.length;
                for (var i = 0; i < len; i++) {
                    $('#inventory-'+i).html(app.player.inventory.data[i]);
                }
            },
        },

        // Forces an XY location
        setLocation: function(x, y) {
            app.player.location.x = x;
            app.player.location.y = y;

            app.player.updateViewport();

            app.player.broadcastLocation();
        },

        // Sets the direction we are facing
        setDirection: function(d) {
            app.player.direction = d;
            app.player.broadcastLocation();
        },

        // Gets information about the tile we are facing
        getFacingTile: function() {
            var coords = app.player.location;
            var data = {};
            switch(app.player.direction) {
                case 'n':
                    data.location = {x: coords.x, y: coords.y - 1};
                    break;
                case 'e':
                    data.location = {x: coords.x + 1, y: coords.y};
                    break;
                case 's':
                    data.location = {x: coords.x, y: coords.y + 1};
                    break;
                case 'w':
                    data.location = {x: coords.x - 1, y: coords.y};
                    break;
                default:
                    console.log("Invalid Direction", app.player.direction);
                    break;
            }

            _.extend(
                data,
                app.map.getTileData(data.location.x, data.location.y)
            );

            return data;
        },

        // Updates the viewport based on the players current location
        updateViewport: function() {
            app.viewport.x = app.player.location.x - app.PLAYER_OFFSET_X;
            app.viewport.y = app.player.location.y - app.PLAYER_OFFSET_Y;
        },

        canMoveTo: function(x, y) {
            if (app.map.getTileData(x, y).tile.block_player) {
                return false;
            }
            return true;
        },

        broadcastLocation: function() {
            app.network.send.move(app.player.location.x, app.player.location.y, app.player.direction);
            app.map.render(true);
        },

        // Mines the facing tile, adjusts inventory
        mineFacingTile: function() {
            var tileData = app.player.getFacingTile();
            var coords = tileData.location;
            if (!app.god && coords.x >= 96 && coords.x <= 104 && coords.y >= 96 && coords.y <= 104) {
                app.chat.message('Client', 'You cannot change the spawn location.', 'client');
                return false;
            }
            var mineable = tileData.tile.mineable;
            if (!mineable) {
                app.audio.play('mine-fail');
                return false;
            }
            //var health = tileData.health;
            var becomes = tileData.tile.becomes;
            var provides = tileData.tile.provides;
            //console.log(tileData, becomes, provides);
            app.map.data[coords.x][coords.y][0] = becomes;
            app.network.send.terraform(coords.x, coords.y, becomes);
            app.player.inventory.update(provides.id, provides.quantity);
            app.audio.play('mine');
        },

        // Attempts to create and then place the specified tile
        placeItem: function(terrainIndex) {
            var replaceTile = app.player.getFacingTile();
            var coords = replaceTile.location;
            if (!app.god && coords.x >= 96 && coords.x <= 104 && coords.y >= 96 && coords.y <= 104) {
                app.chat.message('Client', 'You cannot change the spawn location.', 'client');
                return false;
            }
            if (!replaceTile.tile.replaceable) {
                app.chat.message('Client', 'This object cannot be built over.', 'client');
                return false;
            }
            var item = app.tilesets.descriptors.terrain[terrainIndex];
            // provides is also the cost of manufacturing the tile
            if (app.player.inventory.update(item.provides.id, -item.provides.quantity)) {
                app.audio.play('build');
                app.map.data[coords.x][coords.y][0] = terrainIndex;
                app.network.send.terraform(coords.x, coords.y, terrainIndex);
                return true;
            } else {
                app.chat.message('Client', "You don't have the inventory to build this.", 'client');
                return false;
            }
        },

        kill: function(message) {
            app.audio.play('death');
            app.player.direction = 's';
            app.player.setLocation(100, 100);
            app.player.updateViewport();
            app.chat.message('Client', message, 'client');
            app.persistence.save();
        },

        killIfNpcNearby: function() {
            var loc = app.player.location;
            var len = app.npc.data.length;
            for (var l = 0; l < len; l++) {
                var npc = app.npc.data[l];
                for (var i = -1; i <= 1; i++) {
                    for (var j = -1; j <= 1; j++) {
                        if (npc.x == loc.x+i && npc.y == loc.y+j) {
                            app.player.kill("Killed by " + app.tilesets.descriptors.characters[npc.id].name);
                            break;
                        }
                    }
                }
            }
        },
    },

    // Data regarding the canvas tag
    screen: {
        width: 0,       // The pixel width of the canvas
        height: 0,      // The pixel height of the canvas
        tilesX: 0,      // The number of X tiles
        tilesY: 0,      // The number of Y tiles
    },

    // Data regarding the viewport (window into the map)
    viewport: {
        x: null,          // The viewport left tile
        y: null,          // The viewport top tile
    },

    // NPC stuff
    npc: {
        data: [],

        updateData: function(data) {
            app.npc.data = data;
        }
    },

    // handles saving and loading data to local storage. One day this won't be needed at all.
    persistence: {
        save: function() {
            localStorage.setObject('data', {
                inventory: app.player.inventory.data,
                direction: app.player.direction,
                location: app.player.location,
                name: app.player.name,
                picture: app.player.picture,
            });
        },

        load: function() {
            var persistentData = localStorage.getObject('data');
            if (persistentData) {
                app.player.inventory.data = persistentData.inventory;
                app.player.direction = persistentData.direction;
                app.player.location = persistentData.location;
                app.player.name = persistentData.name;
                app.player.picture = persistentData.picture;
                app.chat.message('Client', 'Loaded your saved character', 'client');
                return true;
            }
            return false;
        },

        createNewPlayer: function() {
            app.player.inventory.data = [0, 0, 0, 0, 0, 0, 0];
            app.player.direction = 's';
            app.player.location = {x: 100, y: 100};
            app.player.name = 'Anon' + Math.floor(Math.random() * 8999 + 1000);
            app.player.picture = Math.floor(Math.random() * 15) + 1;
            app.chat.message('Client', 'Creating a character for the first time', 'client');
        }
    },

    // Functions and data regarding the other players
    players: {

        // Locations of all the different players (except for this player)
        locations: [],

        // Updates a player location, adding if it's a new entry
        update: function(data) {
            var found = false;
            var len = app.players.locations.length;
            for (var i=0; i<len; i++) {
                var player = app.players.locations[i];
                if (player.session == data.session) {
                    _.extend(
                        player,
                        data
                    );
                    found = true;
                }
            }
            if (!found) {
                app.players.locations.push(data);
            }
        },

        remove: function(session) {
            var len = app.players.locations.length;
            for (var i=0; i<len; i++) {
                var player = app.players.locations[i];
                if (player.session == session) {
                    app.players.locations.splice(i, 1);
                }
            }
        }
    },

    network: {
        socket: null,
        connectSocket: function() {
            app.network.socket = io.connect(window.document.location.protocol + "//" + window.document.location.host);
        },
        send: {
            // Player types a message to be sent, probably don't need name value anymore
            chat: function(message) {
                app.network.socket.emit('chat', {
                    name: app.player.name,
                    message: message,
                    priority: 0
                });
            },
            // Player moves to a new location
            move: function(newX, newY, newDirection) {
                app.network.socket.emit('character info', {
                    x: newX,
                    y: newY,
                    direction: newDirection
                });
            },
            // Player builds a tile or mines a tile
            terraform: function(x, y, tile) {
                app.network.socket.emit('terraform', {
                    x: x,
                    y: y,
                    tile: [tile, null]
                });
            },
            // Player dies
            death: function(name, method) {
                app.network.socket.emit('chat', {
                    name: name,
                    message: message,
                    priority: 'server'
                });
            },
            // Player changes either their name or their picture
            character: function(name, picture) {
                app.network.socket.emit('character info', {
                    name: name,
                    picture: picture
                });
            },

            join: function(name) {
                app.network.socket.emit('join', {
                    name: name
                });
            }
        },

        bindEvents: function() {
            var socket = app.network.socket;

            socket.on('chat', function (data) {
                if (typeof data.priority == "undefined") {
                    app.audio.play('chat');
                }
                app.chat.message(data.name, data.message, data.priority);
            });

            socket.on('disconnect', function(data) {
                app.chat.message('Server', 'Disconnected', 'server');
            });

            socket.on('leave', function(data) {
                app.players.remove(data.session);
                var player_name = data.name || 'unknown';
                app.chat.message(data.name, "Player Disconnected", 'server');
            });

            socket.on('terraform', function (data) {
                app.map.data[data.x][data.y] = data.tile;
            });

            socket.on('character info', function(data) {
                if (socket.socket.sessionid == data.dession) return;
                app.players.update(data);
            });

            socket.on('event time', function(data) {
                app.daytime.setCurrentTime(data.time);
            });

            socket.on('event earthquake', function(data) {
                $.get('/map', function(data) {
                    app.map.data = data;
                });
                app.chat.message('Server', "There has been an earthquake! New Rock and Ore has been added to the world.", 'server');
                app.audio.play('earthquake');
            });

            socket.on('event npcmovement', function(data) {
                app.npc.updateData(data.npcs);
            });

            socket.on('event corruption', function(data) {
                app.map.corruptionDataLoaded = true;
                app.map.corruption = data.map;
            });

            socket.on('event bigterraform', function(data) {
                $.get('/map', function(data) {
                    app.map.data = data;
                });
            });
        }
    },

    // Functions and data regarding the map
    map: {
        data: [],
        corruption: [],
        corruptionDataLoaded: false,
        getTileData: function(x, y) {
            var tile = app.map.data[x][y];
            var data = {};
            if (tile && typeof tile[0] != 'undefined') {
                data.tile = app.tilesets.descriptors.terrain[tile[0]];
            }
            if (tile && typeof tile[1] != 'undefined') {
                data.health = tile[1];
            }
            return data;
        },
        render: function(redrawNametags) {
            // immediately draw canvas as black
            app.handle.fillStyle = "rgb(0,0,0)";
            app.handle.fillRect(0, 0, app.screen.width, app.screen.height);

            var i, j;
            var mapX = 0;
            var mapY = 0;
            var tile;
            if (redrawNametags) app.nametags.hide();

            for (j=0; j<app.screen.tilesY; j++) {
                for (i=0; i < app.screen.tilesX; i++) {
                    mapX = i + app.viewport.x;
                    mapY = j + app.viewport.y;
                    tile = (app.map.data[mapX] && app.map.data[mapX][mapY]) ? app.map.data[mapX][mapY] : null;
                    app.tile.draw(i, j, tile);

                    var len = app.players.locations.length;
                    for (var k = 0; k < len; k++) {
                        var player = app.players.locations[k];
                        if (player.x == mapX && player.y == mapY) {
                            var index = app.map.getCharacterFrame(player.direction, app.animFrameGlobal);

                            var player_name = player.name || '???';
                            var picture_id = player.picture;
                            if (isNaN(picture_id)) {
                                picture_id = 56;
                            }
                            if (redrawNametags) app.nametags.add(player.name, i, j);
                            app.tile.drawPlayer(i, j, index, picture_id);
                        }
                    }

                    var len = app.npc.data.length;
                    for (var l = 0; l < len; l++) {
                        var npc = app.npc.data[l];
                        if (npc.x == mapX && npc.y == mapY) {
                            var index = app.map.getCharacterFrame(npc.d, app.animFrameGlobal);

                            var npc_name = app.tilesets.descriptors.characters[npc.id].name;
                            if (redrawNametags) app.nametags.add(npc_name, i, j);
                            app.tile.drawPlayer(i, j, index, npc.id);
                        }
                    }

                    if (app.map.corruptionDataLoaded && mapX >= 0 && mapX < app.TOTALTILES_X && mapY >= 0 && mapY < app.TOTALTILES_Y && app.map.corruption[mapX][mapY] === 1) {
                        var rnd = Math.floor(Math.random() * 3);
                        if (rnd == 0) {
                            app.handle.fillStyle = "rgba(15,0,61,0.5)";
                        } else if (rnd == 1) {
                            app.handle.fillStyle = "rgba(36,14,88,0.7)";
                        } else if (rnd == 2) {
                            app.handle.fillStyle = "rgba(47,24,99,0.6)";
                        }
                        app.map.drawCorruptionTile(i, j);
                    }
                }
            }

            // Draw this player
            var index = app.map.getCharacterFrame(app.player.direction, app.animFrameMe);
            if (redrawNametags) app.nametags.add(app.player.name, app.PLAYER_OFFSET_X, app.PLAYER_OFFSET_Y);
            app.tile.drawPlayer(app.PLAYER_OFFSET_X, app.PLAYER_OFFSET_Y, index, app.player.picture);

            if (redrawNametags) app.nametags.show();

            app.daytime.drawDayLight();
        },

        drawCorruptionTile: function(x, y) {
            // Set the fill color before running function for efficiency
            app.handle.fillRect(
                x * app.TILEWIDTH,
                y * app.TILEHEIGHT,
                app.TILEWIDTH,
                app.TILEHEIGHT
            );
        },

        getCharacterFrame: function(direction, altFrame) {
            var index = 0;
            if (direction == 'n') {
                index = 4;
            } else if (direction == 'e') {
                index = 2;
            } else if (direction == 's') {
                index = 0;
            } else if (direction == 'w') {
                index = 6;
            }

            if (altFrame) {
                index++;
            }

            return index;
        }
    },
    tile: {
        draw: function(x, y, tile) {
            var x_pixel = x * app.TILEWIDTH;
            var y_pixel = y * app.TILEHEIGHT;

            if (tile == null || isNaN(tile[0])) {
                return;
            }

            app.handle.drawImage(
                app.tilesets.terrain,
                0,
                tile[0] * app.TILEHEIGHT,
                app.TILEWIDTH,
                app.TILEHEIGHT,
                x_pixel,
                y_pixel,
                app.TILEWIDTH,
                app.TILEHEIGHT
            );
        },
        drawPlayer: function(x, y, tile_x, tile_y) {
            var x_pixel = x * app.TILEWIDTH;
            var y_pixel = y * app.TILEHEIGHT;
            app.handle.drawImage(
                app.tilesets.characters,
                tile_x * app.TILEWIDTH,
                tile_y * app.TILEHEIGHT,
                app.TILEWIDTH,
                app.TILEHEIGHT,
                x_pixel,
                y_pixel,
                app.TILEWIDTH,
                app.TILEHEIGHT
            );
        }
    },

    daytime: {
        // integer representing hour of day
        currentTime: 8,

        setCurrentTime: function(time) {
            app.daytime.currentTime = time;
            $('#clock').html(time + ':00');
        },

        drawDayLight: function() {
            var color = null;
            var time = app.daytime.currentTime;
            if (time < 5) { // night
                color = "rgba(0, 0, 0, 0.65)";
            } else if (time < 7) { // dusk
                color = "rgba(0, 13, 54, 0.5)";
            } else if (time < 8) { // dusk
                color = "rgba(0, 13, 54, 0.25)";
            } else if (time < 17) { // day
                color = null;
            } else if (time < 18) { //dawn
                color = "rgba(54,22,0, 0.25)";
            } else if (time < 20) { //dawn
                color = "rgba(54,22,0, 0.5)";
            } else {
                color = "rgba(0, 0, 0, 0.65)";
            }
            if (color) {
                app.handle.fillStyle = color;
                app.handle.fillRect(0, 0, app.screen.width, app.screen.height);
            }
        },
    },

    // Nametags are displayed in HTML in a layer above canvas (for now at least, not sure which is faster)
    nametags: {
        $tags: $('#nametags'),

        // adds a player name, provided the X and Y coords of the player
        add: function(name, x, y) {
            var x_pixel = (x - 4) * app.TILEWIDTH + 7; // 7 is left margin or something
            var y_pixel = (y - 1) * app.TILEHEIGHT + 2;
            var $tags = app.nametags.$tags;
            var $name = $('<div class="name"><span>' + name + '</span></div>');
            $name.css({
                left: x_pixel,
                top: y_pixel
            });
            $tags.append($name);
        },

        // hide (for efficient DOM redraws) and clear entries
        hide: function() {
            app.nametags.$tags.hide().empty();
        },

        // show list again
        show: function() {
            app.nametags.$tags.show();
        }
    },

    // run this when we make a local change to alert other players and server
    updateCharacterInfo: function() {
        app.network.send.character(app.player.name, app.player.picture);
    },

    chat: {
        $output: $('#messages'),
        $input: $('#message-input'),
        message: function(who, message, priority) {
            app.chat.$output
                .append("<div class='message " + priority + "'><span class='username'>" + who + ": </span><span class='content'>" + message + "</span></div>")
                .animate({scrollTop: this.$output[0].scrollHeight});
        },
        clear: function() {
            app.chat.$output.empty();
        },
        clearInput: function() {
            app.chat.$input.val('');
        },
        initialize: function() {
            $('#message-box form').submit(function(event) {
                event.preventDefault();
                var message = app.chat.$input.val();
                app.chat.clearInput();
                if (message === '/clear') {
                    app.chat.clear();
                    return;
                } else if (message === '/help') {
                    app.chat.message('Help', '-{Keys}----------------------------', 'help');
                    app.chat.message('Help', 'Use the WASD keys to move', 'help');
                    app.chat.message('Help', 'Use the WASD keys + SHIFT to turn', 'help');
                    app.chat.message('Help', 'Press F to mine the facing object', 'help');
                    app.chat.message('Help', 'Press T or / to enter the chat box', 'help');
                    app.chat.message('Help', 'Press Esc to leave the chat box', 'help');
                    app.chat.message('Help', '-{Commands}------------------------', 'help');
                    app.chat.message('Help', '/nick <em>name</em>: change your name', 'help');
                    app.chat.message('Help', '/pic <em>1-16</em>: change your avatar', 'help');
                    app.chat.message('Help', '/who: get a list of players', 'help');
                    app.chat.message('Help', '/gps: get coordinates', 'help');
                    app.chat.message('Help', '/clear: reset message area', 'help');
                    app.chat.message('Help', '/kill: commit suicide', 'help');
                    return;
                } else if (message.indexOf('/nick ') === 0) {
                    var playerName = message.substr(6);
                    app.player.name = playerName;
                    app.updateCharacterInfo();
                    return;
                } else if (message.indexOf('/pic ') === 0) {
                    var picIndex = parseInt(message.substr(5), 10);
                    if (isNaN(picIndex)) {
                        picIndex = 1;
                    }
                    if (picIndex > 16) {
                        picIndex = 1;
                    }
                    app.player.picture = picIndex;
                    app.updateCharacterInfo();
                    // change picture
                    return;
                } else if (message === '/who') {
                    app.chat.message("Client", "Found " + app.players.locations.length + " players", 'client');
                    _.each(app.players.locations, function(player) {
                        app.chat.message("Client", player.name, 'client');
                    });
                    return;
                } else if (message === '/kill') {
                    app.player.kill('Committed Suicide');
                        app.network.send.chat(app.player.name, "*Committed Suicide*");
                    return;
                } else if (message === '/gps') {
                    app.chat.message("Client", "Coordinates: [" + (app.player.location.x) + "," + (app.player.location.y) + "]", 'client');
                    return;
                } else if (message.indexOf('/tile ') === 0) {
                    var tile = parseInt(message.substr(6), 10);
                    if (isNaN(tile)) {
                        return;
                    }
                    var coords = app.player.getFacingTile().location;
                    app.map.data[coords.x][coords.y][0] = tile;
                    app.network.send.terraform(coords.x, coords.y, tile);
                    return;
                }
                app.chat.message(app.player.name, message, 'self');
                app.network.send.chat(app.player.name, message);
            });

            // Pres Esc inside of text box, leave the text box
            $(document).keyup(function(e) {
                if ($(e.target).is(":input") && e.which == 27) {
                    e.preventDefault();
                    $('#message-input').blur();
                };
            });
        }
    },

    audio: {
        data: {
            'mine': null,
            'mine-fail': null,
            'build': null,
            'build-fail': null,
            'walk': null,
            'walk-fail': null,
            'death': null,
            'earthquake': null,
            'chat': null,
        },

        // Stores
        volume: {
            sound: 1.0,
            music: 1.0
        },

        // Creates the audio elements
        initialize: function() {
            var self = app.audio;
            _.each(self.data, function(data, key) {
                app.audio.data[key] = document.getElementById('sound-' + key);
            });
        },

        // Sets the volume for the type of audio
        setVolume: function(type, vol) {
            var self = app.audio;
            if (_.has(self.volume, type)) {
                vol = parseFloat(vol);
                if (vol < 0) {
                    vol = 0.0;
                } else if (vol > 1) {
                    vol = 1.0;
                }
                self.volume[type] = vol;
                return true;
            }
            return false;
        },

        // Plays the specified sound
        play: function(name) {
            var self = app.audio;
            var sound = null;
            if (_.has(self.data, name)) {
                sound = self.data[name];
                sound.volume = self.volume.sound;
                sound.play();
                return true;
            }
            return false;
        }
    }

};

app.chat.message('Client', 'Downloading assets...', 'client');

// load Character, Inventory, Terrain descriptors
$.get('/assets/tilesets/data.json', function(data) {
    app.chat.message('Client', 'Tileset Descriptors done.', 'client');
    app.tilesets.descriptors = data;
});

// load background sprites
app.tilesets.terrain.src = '/assets/tilesets/terrain.png';
app.tilesets.terrain.onload = function() {
    app.chat.message('Client', 'Tileset Terrain done.', 'client');
}
// load characters sprites
app.tilesets.characters.src = '/assets/tilesets/characters.png';
app.tilesets.characters.onload = function() {
    app.chat.message('Client', 'Tileset Characters done.', 'client');
}

// load inventory sprites
app.tilesets.inventory.src = '/assets/tilesets/inventory.png';
app.tilesets.inventory.onload = function() {
    app.chat.message('Client', 'Tileset Inventory done.', 'client');
}

$.get('/map', function(data) {
    app.chat.message('Client', 'Map data done.', 'client');
    app.map.data = data;
    app.initialize();
});
});

Storage.prototype.setObject = function(key, value) {
    this.setItem(key, JSON.stringify(value));
}

Storage.prototype.getObject = function(key) {
    return JSON.parse(this.getItem(key));
}
