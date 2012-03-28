// Copyright 2011 Thomas Hunter :3
'use strict';

$(function() {
    window.app = {
        // Make socket connection ASAP
        socket: io.connect(window.document.location.protocol + "//" + window.document.location.host),

        // Grab some DOM elements
        $messages: $('#messages'),
        $newMessage: $('#message-input'),
        $canvas: $('#map'),

        // Build main Engine object
        engine: {

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
                            if (app.engine.player.location.y <= 0) {
                                app.engine.player.setDirection(d);
                                app.engine.player.thud();
                                return false;
                            }
                            if (!app.engine.player.canMoveTo(app.engine.player.location.x, app.engine.player.location.y - 1)) {
                                app.engine.player.setDirection(d);
                                app.engine.player.thud();
                                return false;
                            }
                            app.engine.player.location.y--;
                            break;
                        case 'e':
                            if (app.engine.player.location.x >= app.engine.TOTALTILES_X - 1) {
                                app.engine.player.setDirection(d);
                                app.engine.player.thud();
                                return false;
                            }
                            if (!app.engine.player.canMoveTo(app.engine.player.location.x + 1, app.engine.player.location.y)) {
                                app.engine.player.setDirection(d);
                                app.engine.player.thud();
                                return false;
                            }
                            app.engine.player.location.x++;
                            break;
                        case 's':
                            if (app.engine.player.location.y >= app.engine.TOTALTILES_Y - 1) {
                                app.engine.player.setDirection(d);
                                app.engine.player.thud();
                                return false;
                            }
                            if (!app.engine.player.canMoveTo(app.engine.player.location.x, app.engine.player.location.y + 1)) {
                                app.engine.player.setDirection(d);
                                app.engine.player.thud();
                                return false;
                            }
                            app.engine.player.location.y++;
                            break;
                        case 'w':
                            if (app.engine.player.location.x <= 0) {
                                app.engine.player.setDirection(d);
                                app.engine.player.thud();
                                return false;
                            }
                            if (!app.engine.player.canMoveTo(app.engine.player.location.x - 1, app.engine.player.location.y)) {
                                app.engine.player.setDirection(d);
                                app.engine.player.thud();
                                return false;
                            }
                            app.engine.player.location.x--;
                            break;
                        default:
                            console.log("Invalid Direction", d);
                            return;
                            break;
                    }

                    app.engine.animFrameMe = !app.engine.animFrameMe;
                    app.engine.player.updateViewport();

                    app.engine.player.setDirection(d); // broadcasts location
                },

                inventory: {
                    data: [0, 0, 0, 0, 0, 0, 0, 0, 0],

                    update: function(index, amount) {
                        var data = app.engine.player.inventory.data;
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
                        var len = app.engine.player.inventory.data.length;
                        for (var i = 0; i < len; i++) {
                            $('#inventory-'+i).html(app.engine.player.inventory.data[i]);
                        }
                    },
                },

                thud: function() {
                    document.getElementById('sound-thud').play();
                },

                // Forces an XY location
                setLocation: function(x, y) {
                    app.engine.player.location.x = x;
                    app.engine.player.location.y = y;

                    app.engine.player.updateViewport();

                    app.engine.player.broadcastLocation();
                },

                // Sets the direction we are facing
                setDirection: function(d) {
                    app.engine.player.direction = d;
                    app.engine.player.broadcastLocation();
                },

                // Gets information about the tile we are facing
                getFacingTile: function() {
                    var coords = app.engine.player.location;
                    var data = {};
                    switch(app.engine.player.direction) {
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
                            console.log("Invalid Direction", app.engine.player.direction);
                            break;
                    }

                    _.extend(
                        data,
                        app.engine.map.getTileData(data.location.x, data.location.y)
                    );

                    return data;
                },

                // Updates the viewport based on the players current location
                updateViewport: function() {
                    app.engine.viewport.x = app.engine.player.location.x - app.engine.PLAYER_OFFSET_X;
                    app.engine.viewport.y = app.engine.player.location.y - app.engine.PLAYER_OFFSET_Y;
                },

                canMoveTo: function(x, y) {
                    if (app.engine.map.getTileData(x, y).tile.block_player) {
                        return false;
                    }
                    return true;
                },

                // Transmits a socket message with our current location and direction
                broadcastLocation: function() {
                    app.socket.emit('move', {
                        x: app.engine.player.location.x,
                        y: app.engine.player.location.y,
                        direction: app.engine.player.direction
                    });

                    app.engine.map.render(true);
                },

                // Mines the facing tile, adjusts inventory
                mineFacingTile: function() {
                    var tileData = app.engine.player.getFacingTile();
                    var mineable = tileData.tile.mineable;
                    if (!mineable) {
                        document.getElementById('sound-mine-fail').play();
                        return false;
                    }
                    var coords = tileData.location;
                    //var health = tileData.health;
                    var becomes = tileData.tile.becomes;
                    var provides = tileData.tile.provides;
                    //console.log(tileData, becomes, provides);
                    app.engine.map.data[coords.x][coords.y][0] = becomes;
                    app.socket.emit('terraform', {
                        x: coords.x,
                        y: coords.y,
                        tile: [becomes, null]
                    });
                    app.engine.player.inventory.update(provides.id, provides.quantity);
                    document.getElementById('sound-mine').play();
                },

                // Attempts to create and then place the specified tile
                placeItem: function(terrainIndex) {
                    var replaceTile = app.engine.player.getFacingTile();
                    if (!replaceTile.tile.replaceable) {
                        app.displayMessage('Client', 'This object cannot be built over.', 'client');
                        return false;
                    }
                    var coords = replaceTile.location;
                    var item = app.engine.tilesets.descriptors.terrain[terrainIndex];
                    // provides is also the cost of manufacturing the tile
                    if (app.engine.player.inventory.update(item.provides.id, -item.provides.quantity)) {
                        app.engine.map.data[coords.x][coords.y][0] = terrainIndex;
                        app.socket.emit('terraform', {
                            x: coords.x,
                            y: coords.y,
                            tile: [terrainIndex, null]
                        });
                            return true;
                    } else {
                        app.displayMessage('Client', "You don't have the inventory to build this.", 'client');
                        return false;
                    }
                },

                saveData: function() {
                    localStorage.setObject('data', {
                        inventory: app.engine.player.inventory.data,
                        direction: app.engine.player.direction,
                        location: app.engine.player.location,
                        name: app.engine.player.name,
                        picture: app.engine.player.picture,
                    });
                },

                loadData: function() {
                    var persistentData = localStorage.getObject('data');
                    if (persistentData) {
                        app.engine.player.inventory.data = persistentData.inventory;
                        app.engine.player.direction = persistentData.direction;
                        app.engine.player.location = persistentData.location;
                        app.engine.player.name = persistentData.name;
                        app.engine.player.picture = persistentData.picture;
                        return true;
                    }
                    return false;
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
                    app.engine.npc.data = data;
                }
            },

            // Functions and data regarding the other players
            players: {

                // Locations of all the different players (except for this player)
                locations: [],

                // Updates a player location, adding if it's a new entry
                update: function(session, x, y, direction) {
                    var found = false;
                    var len = app.engine.players.locations.length;
                    for (var i=0; i<len; i++) {
                        var player = app.engine.players.locations[i];
                        if (player.session == session) {
                            player.x = x;
                            player.y = y;
                            player.direction = direction;
                            found = true;
                        }
                    }
                    if (!found) {
                        app.engine.players.locations.push({
                            session: session,
                            x: x,
                            y: y,
                            direction: direction
                        });
                    }
                },

                updateInfo: function(session, name, picture) {
                    var len = app.engine.players.locations.length;
                    for (var i=0; i<len; i++) {
                        var player = app.engine.players.locations[i];
                        if (player.session == session) {
                            player.name = name;
                            player.picture = picture;
                        }
                    }
                },

                remove: function(session) {
                    var len = app.engine.players.locations.length;
                    for (var i=0; i<len; i++) {
                        var player = app.engine.players.locations[i];
                        if (player.session == session) {
                            app.engine.players.locations.splice(i, 1);
                        }
                    }
                }
            },

            // Functions and data regarding the map
            map: {
                data: [],
                getTileData: function(x, y) {
                    var tile = app.engine.map.data[x][y];
                    var data = {};
                    if (tile && typeof tile[0] != 'undefined') {
                        data.tile = app.engine.tilesets.descriptors.terrain[tile[0]];
                    }
                    if (tile && typeof tile[1] != 'undefined') {
                        data.health = tile[1];
                    }
                    return data;
                },
                render: function(redrawNametags) {
                    // immediately draw canvas as black
                    app.engine.handle.fillStyle = "rgb(0,0,0)";
                    app.engine.handle.fillRect(0, 0, app.engine.screen.width, app.engine.screen.height);

                    var i, j;
                    var mapX = 0;
                    var mapY = 0;
                    var tile;
                    if (redrawNametags) app.engine.nametags.hide();

                    for (j=0; j<app.engine.screen.tilesY; j++) {
                        for (i=0; i < app.engine.screen.tilesX; i++) {
                            mapX = i + app.engine.viewport.x;
                            mapY = j + app.engine.viewport.y;
                            tile = (app.engine.map.data[mapX] && app.engine.map.data[mapX][mapY]) ? app.engine.map.data[mapX][mapY] : null;
                            app.engine.tile.draw(i, j, tile);

                            var len = app.engine.players.locations.length;
                            for (var k = 0; k < len; k++) {
                                var player = app.engine.players.locations[k];
                                if (player.x == mapX && player.y == mapY) {
                                    var index = app.engine.map.getCharacterFrame(player.direction, app.engine.animFrameGlobal);

                                    var player_name = player.name || '???';
                                    var picture_id = player.picture;
                                    if (isNaN(picture_id)) {
                                        picture_id = 56;
                                    }
                                    if (redrawNametags) app.engine.nametags.add(player.name, i, j);
                                    app.engine.tile.drawPlayer(i, j, index, picture_id);
                                }
                            }

                            var len = app.engine.npc.data.length;
                            for (var l = 0; l < len; l++) {
                                var npc = app.engine.npc.data[l];
                                if (npc.x == mapX && npc.y == mapY) {
                                    var index = app.engine.map.getCharacterFrame('s', app.engine.animFrameGlobal);

                                    var npc_name = 'Cthulu Spawn';
                                    if (redrawNametags) app.engine.nametags.add(npc_name, i, j);
                                    app.engine.tile.drawPlayer(i, j, index, npc.id);
                                }
                            }
                        }
                    }

                    // Draw this player
                    var index = app.engine.map.getCharacterFrame(app.engine.player.direction, app.engine.animFrameMe);
                    if (redrawNametags) app.engine.nametags.add(app.engine.player.name, app.engine.PLAYER_OFFSET_X, app.engine.PLAYER_OFFSET_Y);
                    app.engine.tile.drawPlayer(app.engine.PLAYER_OFFSET_X, app.engine.PLAYER_OFFSET_Y, index, app.engine.player.picture);

                    if (redrawNametags) app.engine.nametags.show();

                    app.engine.daytime.drawDayLight();
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
                    var x_pixel = x * app.engine.TILEWIDTH;
                    var y_pixel = y * app.engine.TILEHEIGHT;

                    if (tile == null || isNaN(tile[0])) {
                        return;
                    }

                    app.engine.handle.drawImage(
                        app.engine.tilesets.terrain,
                        0,
                        tile[0] * app.engine.TILEHEIGHT,
                        app.engine.TILEWIDTH,
                        app.engine.TILEHEIGHT,
                        x_pixel,
                        y_pixel,
                        app.engine.TILEWIDTH,
                        app.engine.TILEHEIGHT
                    );
                },
                drawPlayer: function(x, y, tile_x, tile_y) {
                    var x_pixel = x * app.engine.TILEWIDTH;
                    var y_pixel = y * app.engine.TILEHEIGHT;
                    app.engine.handle.drawImage(
                        app.engine.tilesets.characters,
                        tile_x * app.engine.TILEWIDTH,
                        tile_y * app.engine.TILEHEIGHT,
                        app.engine.TILEWIDTH,
                        app.engine.TILEHEIGHT,
                        x_pixel,
                        y_pixel,
                        app.engine.TILEWIDTH,
                        app.engine.TILEHEIGHT
                    );
                }
            },

            start: function() {
                app.engine.viewport.x = Math.floor(app.engine.TOTALTILES_X / 2) - app.engine.PLAYER_OFFSET_X;
                app.engine.viewport.y = Math.floor(app.engine.TOTALTILES_Y / 2) - app.engine.PLAYER_OFFSET_Y;

                app.engine.screen.width  = app.$canvas.width();
                app.engine.screen.height = app.$canvas.height();
                app.engine.screen.tilesX = app.$canvas.width() / app.engine.TILEWIDTH;
                app.engine.screen.tilesY = app.$canvas.height() / app.engine.TILEHEIGHT;

                app.engine.player.name = 'Anon' + Math.floor(Math.random() * 8999 + 1000);
                app.engine.player.picture = Math.floor(Math.random() * 15) + 1;

                $('#message-box form').submit(function(event) {
                    event.preventDefault();
                    var message = app.$newMessage.val();
                    app.$newMessage.val('');
                    if (message === '/clear') {
                        app.$messages.empty();
                        return;
                    } else if (message === '/help') {
                        app.displayMessage('Help', '-{Keys}----------------------------', 'help');
                        app.displayMessage('Help', 'Use the WASD keys to move', 'help');
                        app.displayMessage('Help', 'Use the WASD keys + SHIFT to turn', 'help');
                        app.displayMessage('Help', 'Press T or / to enter the chat box', 'help');
                        app.displayMessage('Help', 'Press Esc to leave the chat box', 'help');
                        app.displayMessage('Help', '-{Commands}------------------------', 'help');
                        app.displayMessage('Help', '/nick <em>name</em>: change your name', 'help');
                        app.displayMessage('Help', '/pic <em>1-16</em>: change your avatar', 'help');
                        app.displayMessage('Help', '/who: get a list of players', 'help');
                        app.displayMessage('Help', '/gps: get coordinates', 'help');
                        app.displayMessage('Help', '/clear: reset message area', 'help');
                        return;
                    } else if (message.indexOf('/nick ') === 0) {
                        var playerName = message.substr(6);
                        app.engine.player.name = playerName;
                        app.engine.updateCharacterInfo();
                        return;
                    } else if (message.indexOf('/pic ') === 0) {
                        var picIndex = parseInt(message.substr(5), 10);
                        if (isNaN(picIndex)) {
                            picIndex = 1;
                        }
                        if (picIndex > 16) {
                            picIndex = 1;
                        }
                        app.engine.player.picture = picIndex;
                        app.engine.updateCharacterInfo();
                        // change picture
                        return;
                    } else if (message === '/who') {
                        app.displayMessage("Client", "Found " + app.engine.players.locations.length + " players", 'client');
                        _.each(app.engine.players.locations, function(player) {
                            app.displayMessage("Client", player.name, 'client');
                        });
                        return;
                    } else if (message === '/gps') {
                        app.displayMessage("Client", "Coordinates: [" + (app.engine.player.location.x) + "," + (app.engine.player.location.y) + "]", 'client');
                        return;
                    } else if (message.indexOf('/tile ') === 0) {
                        var tile = parseInt(message.substr(6), 10);
                        if (isNaN(tile)) {
                            return;
                        }
                        var coords = app.engine.player.getFacingTile().location;
                        app.engine.map.data[coords.x][coords.y][0] = tile;
                        app.socket.emit('terraform', {
                            x: coords.x,
                            y: coords.y,
                            tile: [tile, null]
                        });
                        return;
                    }
                    app.displayMessage(app.engine.player.name, message, 'self');
                    app.socket.emit('chat', {name: app.engine.player.name, message: message, priority: 0});
                });

                app.socket.on('chat', function (data) {
                    app.displayMessage(data.name, data.message, data.priority);
                });

                app.socket.on('disconnect', function(data) {
                    app.displayMessage('Server', 'Disconnected', 'server');
                });

                app.socket.on('move', function(data) {
                    if (app.socket.socket.sessionid == data.session) return;
                    app.engine.players.update(data.session, data.x, data.y, data.direction);
                    // when move is first sent by server, entire player array sent with it
                    if (data.name || data.picture) {
                        app.engine.players.updateInfo(data.session, data.name, data.picture);
                    }
                });

                app.socket.on('leave', function(data) {
                    app.engine.players.remove(data.session);
                    var player_name = data.name || 'unknown';
                    app.displayMessage('Server', data.name + " has left the game", 'server');
                });

                app.socket.on('terraform', function (data) {
                    app.engine.map.data[data.x][data.y] = data.tile;
                });

                app.socket.on('character info', function(data) {
                    if (app.socket.socket.sessionid == data.dession) return;
                    app.engine.players.updateInfo(data.session, data.name, data.picture);
                });

                app.socket.on('event time', function(data) {
                    app.engine.daytime.setCurrentTime(data.time);
                });

                app.socket.on('event earthquake', function(data) {
                    app.displayMessage('Server', "There has been an earthquake! Check your buildings for damage. New Ore has been added to the world.", 'server');
                    document.getElementById('sound-earthquake').play();
                });

                app.socket.on('event npcmovement', function(data) {
                    app.engine.npc.updateData(data.npcs);
                });

                // Tell people who and where we are every 15 seconds (temporary solution for a race condition)
                setInterval(function() {
                    app.socket.emit('move', {
                        x: app.engine.player.location.x,
                        y: app.engine.player.location.y,
                        direction: app.engine.player.direction
                    });
                    app.engine.updateCharacterInfo(
                        app.engine.player.name,
                        app.engine.player.picture
                    );
                }, 15000);

                // Pres Esc inside of text box, leave the text box
                $(document).keyup(function(e) {
                    if ($(e.target).is(":input") && e.which == 27) {
                        e.preventDefault();
                        $('#message-input').blur();
                    };
                });

                // Character keypress
                $(document).keypress(function(e) {
                    if ($(e.target).is(":input")) {
                        return;
                    }

                    if (e.which == 119) { // w
                        app.engine.player.move('n');
                    } else if (e.which == 97) { // a
                        app.engine.player.move('w');
                    } else if (e.which == 115) { // s
                        app.engine.player.move('s');
                    } else if (e.which == 100) { // d
                        app.engine.player.move('e');
                    } else if (e.which == 87) { // W
                        app.engine.player.setDirection('n');
                    } else if (e.which == 65) { // A
                        app.engine.player.setDirection('w');
                    } else if (e.which == 83) { // S
                        app.engine.player.setDirection('s');
                    } else if (e.which == 68) { // D
                        app.engine.player.setDirection('e');
                    } else if (e.which == 116) { // T
                        e.preventDefault(); // keeps us from getting a t in the box
                        $('#message-input').focus();
                    } else if (e.which == 47) { // /
                        $('#message-input').focus();
                    } else if (e.which >= 49 && e.which <= 54) { // 1 - 6
                        var numberPressed = e.which - 48;
                        var terrainIndex = numberPressed + 8;
                        app.engine.player.placeItem(terrainIndex);
                    } else if (e.which == 102) { // f
                        app.engine.player.mineFacingTile();
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
                        app.engine.animFrameGlobal = !app.engine.animFrameGlobal;
                    }
                    app.engine.map.render(currentFrame === 0);
                }, 150);

                // Display helpful command
                setTimeout(function() {
                    app.displayMessage('Help', 'Type /help for some help', 'help');
                    app.displayMessage('Help', 'Type /nick NEWNAME to change your name', 'help');
                }, 500);

                if (app.engine.player.loadData()) {
                    app.engine.player.updateViewport();
                    app.engine.player.inventory.resetCounters();
                    app.displayMessage('Client', 'Loaded your saved character', 'client');
                }

                setInterval(function() {
                    app.engine.player.saveData();
                }, 5000); // save every 5 seconds
            },

            daytime: {
                // integer representing hour of day
                currentTime: 8,

                setCurrentTime: function(time) {
                    app.engine.daytime.currentTime = time;
                    $('#clock').html(time + ':00');
                },

                drawDayLight: function() {
                    var color = null;
                    var time = app.engine.daytime.currentTime;
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
                        app.engine.handle.fillStyle = color;
                        app.engine.handle.fillRect(0, 0, app.engine.screen.width, app.engine.screen.height);
                    }
                },
            },

            // Nametags are displayed in HTML in a layer above canvas (for now at least, not sure which is faster)
            nametags: {
                $tags: $('#nametags'),

                // adds a player name, provided the X and Y coords of the player
                add: function(name, x, y) {
                    var x_pixel = (x - 4) * app.engine.TILEWIDTH + 7; // 7 is left margin or something
                    var y_pixel = (y - 1) * app.engine.TILEHEIGHT + 2;
                    var $tags = app.engine.nametags.$tags;
                    var $name = $('<div class="name"><span>' + name + '</span></div>');
                    $name.css({
                        left: x_pixel,
                        top: y_pixel
                    });
                    $tags.append($name);
                },

                // hide (for efficient DOM redraws) and clear entries
                hide: function() {
                    app.engine.nametags.$tags.hide().empty();
                },

                // show list again
                show: function() {
                    app.engine.nametags.$tags.show();
                }
            },

            // run this when we make a local change to alert other players and server
            updateCharacterInfo: function() {
                app.socket.emit('character info', {
                    name: app.engine.player.name,
                    picture: app.engine.player.picture
                });
            }
        },

        // Displays a message in the message box, and scrolls to the bottom
        displayMessage: function(label, message, priority) {
            this.$messages
                .append("<div class='message " + priority + "'><span class='username'>" + label + ": </span><span class='content'>" + message + "</span></div>")
                .animate({scrollTop: this.$messages[0].scrollHeight});
        },

    };

    app.displayMessage('Client', 'Downloading assets...', 'client');

    // load Character, Inventory, Terrain descriptors
    $.get('/assets/tilesets/data.json', function(data) {
        app.displayMessage('Client', 'Tileset Descriptors done.', 'client');
        app.engine.tilesets.descriptors = data;
    });

    // load background sprites
    app.engine.tilesets.terrain.src = '/assets/tilesets/terrain.png';
    app.engine.tilesets.terrain.onload = function() {
        app.displayMessage('Client', 'Tileset Terrain done.', 'client');
    }
    // load characters sprites
    app.engine.tilesets.characters.src = '/assets/tilesets/characters.png';
    app.engine.tilesets.characters.onload = function() {
        app.displayMessage('Client', 'Tileset Characters done.', 'client');
    }

    // load inventory sprites
    app.engine.tilesets.inventory.src = '/assets/tilesets/inventory.png';
    app.engine.tilesets.inventory.onload = function() {
        app.displayMessage('Client', 'Tileset Inventory done.', 'client');
    }

    $.get('/map', function(data) {
        app.displayMessage('Client', 'Map data done.', 'client');
        app.engine.map.data = data;
        app.engine.start();
    });
});

Storage.prototype.setObject = function(key, value) {
    this.setItem(key, JSON.stringify(value));
}

Storage.prototype.getObject = function(key) {
    return JSON.parse(this.getItem(key));
}
