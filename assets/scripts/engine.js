// Copyright 2011 Thomas Hunter :3
'use strict';

$(function() {
    var app = {
        self: this,

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

            // Last direction this player was facing
            lastDirection: 's',
            characterIndex: 0,
            playerName: '',

            // Data regarding the canvas tag
            screen: {
                width: 0,       // The pixel width of the canvas
                height: 0,      // The pixel height of the canvas
                tilesX: 0,      // The number of X tiles
                tilesY: 0,      // The number of Y tiles
            },

            // Data regarding the viewport (window into the map)
            viewport: {
                x: 70,          // The viewport left tile
                y: 70,          // The viewport top tile
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
                draw: function() {
                    // immediately draw canvas as black
                    app.engine.handle.fillStyle = "rgb(0,0,0)";
                    app.engine.handle.fillRect(0, 0, app.engine.screen.width, app.engine.screen.height);

                    var i, j;
                    var mapX = 0;
                    var mapY = 0;
                    var tile;
                    app.engine.nametags.hide();

                    for (j=0; j<app.engine.screen.tilesY; j++) {
                        for (i=0; i < app.engine.screen.tilesX; i++) {
                            mapX = i + app.engine.viewport.x;
                            mapY = j + app.engine.viewport.y;
                            tile = (app.engine.map.data[mapY] && app.engine.map.data[mapY][mapX]) ? app.engine.map.data[mapY][mapX] : null;
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
                                    app.engine.nametags.add(player.name, i, j);
                                    app.engine.tile.drawPlayer(i, j, index, picture_id);
                                }
                            }
                        }
                    }

                    var index = app.engine.map.getCharacterFrame(app.engine.lastDirection, app.engine.animFrameMe);
                    app.engine.nametags.add(app.engine.playerName, app.engine.PLAYER_OFFSET_X, app.engine.PLAYER_OFFSET_Y);
                    app.engine.tile.drawPlayer(app.engine.PLAYER_OFFSET_X, app.engine.PLAYER_OFFSET_Y, index, app.engine.characterIndex);
                    app.engine.nametags.show();

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


                $('#message-box form').submit(function(event) {
                    event.preventDefault();
                    var message = app.$newMessage.val();
                    app.$newMessage.val('');
                    if (message === '/clear') {
                        app.$messages.empty();
                        return;
                    } else if (message === '/redraw') {
                        app.engine.map.draw();
                        return;
                    } else if (message === '/help') {
                        app.displayMessage('Help', '-{Keys}--------------------', 'help');
                        app.displayMessage('Help', 'Use the WASD keys to move', 'help');
                        app.displayMessage('Help', 'Press T to go to chat mode', 'help');
                        app.displayMessage('Help', 'Press / to go to chat mode', 'help');
                        app.displayMessage('Help', 'Press Esc go to leave chat', 'help');
                        app.displayMessage('Help', '-{Commands}----------------', 'help');
                        app.displayMessage('Help', '/nick name: change name', 'help');
                        app.displayMessage('Help', '/pic 1-16: change picture', 'help');
                        app.displayMessage('Help', '/who: list of players', 'help');
                        app.displayMessage('Help', '/time: get current time', 'help');
                        app.displayMessage('Help', '/help: displays this help', 'help');
                        app.displayMessage('Help', '/clear: reset message area', 'help');
                        app.displayMessage('Help', '/redraw: re draws map', 'help');
                        return;
                    } else if (message.indexOf('/nick ') === 0) {
                        var playerName = message.substr(6);
                        app.engine.playerName = playerName;
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
                        app.engine.characterIndex = picIndex;
                        app.engine.updateCharacterInfo();
                        // change picture
                        return;
                    } else if (message === '/who') {
                        app.displayMessage("Client", "Found " + app.engine.players.locations.length + " players", 'client');
                        _.each(app.engine.players.locations, function(player) {
                            app.displayMessage("Client", player.name, 'client');
                        });
                        return;
                    } else if (message === '/time') {
                        app.displayMessage("Client", "Current Time: " + app.engine.daytime.currentTime + ":00", 'client');
                        return;
                    }
                    app.displayMessage(app.engine.playerName, message, 'self');
                    app.socket.emit('chat', {name: app.engine.playerName, message: message, priority: 0});
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
                    //app.engine.map.draw();
                });

                app.socket.on('leave', function(data) {
                    app.engine.players.remove(data.session);
                    //app.engine.map.draw();
                    var player_name = data.name || 'unknown';
                    app.displayMessage('Server', data.name + " has left the game", 'server');
                });

                app.socket.on('terraform', function (data) {
                    var node = app.engine.map.data[data.y][data.x];
                    node[data.layer] = data.tile;
                    //app.engine.map.draw();
                });

                app.socket.on('character info', function(data) {
                    if (app.socket.socket.sessionid == data.dession) return;
                    app.engine.players.updateInfo(data.session, data.name, data.picture);
                    //app.engine.map.draw();
                });

                app.socket.on('event time', function(data) {
                    app.engine.daytime.setCurrentTime(data.time);
                });

                app.engine.playerName = 'Anon' + Math.floor(Math.random() * 8999 + 1000);
                app.engine.characterIndex = Math.floor(Math.random() * 15) + 1;

                app.engine.screen.width  = app.$canvas.width();
                app.engine.screen.height = app.$canvas.height();
                app.engine.screen.tilesX = app.$canvas.width() / app.engine.TILEWIDTH;
                app.engine.screen.tilesY = app.$canvas.height() / app.engine.TILEHEIGHT;

                // Tell people who and where we are every 15 seconds (temporary solution for a race condition)
                setInterval(function() {
                    app.socket.emit('move', {
                        x: app.engine.viewport.x + app.engine.PLAYER_OFFSET_X,
                        y: app.engine.viewport.y + app.engine.PLAYER_OFFSET_Y,
                        direction: app.engine.lastDirection
                    });
                    app.engine.updateCharacterInfo(
                        app.engine.playerName,
                        app.engine.characterIndex
                    );
                }, 15000);

                app.engine.map.draw();

                $('#terraform .remove-tile').click(function() {
                    app.engine.map.data[app.engine.viewport.y + app.engine.PLAYER_OFFSET_Y][app.engine.viewport.x + app.engine.PLAYER_OFFSET_X][1] = null;
                    app.engine.map.draw();
                    app.socket.emit('terraform', {
                        x: app.engine.viewport.x + app.engine.PLAYER_OFFSET_X,
                        y: app.engine.viewport.y + app.engine.PLAYER_OFFSET_Y,
                        tile: null,
                        layer: 1
                    });
                });

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

                    if (e.which == 119) { // W
                        app.engine.move('n');
                    } else if (e.which == 97) { // A
                        app.engine.move('w');
                    } else if (e.which == 115) { // S
                        app.engine.move('s');
                    } else if (e.which == 100) { // D
                        app.engine.move('e');
                    } else if (e.which == 116) { // T
                        e.preventDefault(); // keeps us from getting a t in the box
                        $('#message-input').focus();
                    } else if (e.which == 47) { // /
                        $('#message-input').focus();
                    } else if (e.which == 120) { // x
                        //app.engine.map.data[app.engine.viewport.y + app.engine.PLAYER_OFFSET_Y][app.engine.viewport.x + app.engine.PLAYER_OFFSET_X][1] = null;
                        //app.engine.map.draw();
                        //app.socket.emit('terraform', {
                            //x: app.engine.viewport.x + app.engine.PLAYER_OFFSET_X,
                            //y: app.engine.viewport.y + app.engine.PLAYER_OFFSET_Y,
                            //tile: null,
                            //layer: 1
                        //});
                    } else if (e.which >= 49 && e.which <= 54) { // 1 - 6
                        var num = e.which - 48;
                        console.log("Place " + num);
                    }
                });

                // global animation and map redraw function
                var currentFrame = 0;
                setInterval(function() {
                    currentFrame++;
                    if (currentFrame % 3 == 0) {
                        currentFrame = 0;
                        // redraw every 150 ms, but change animation every 450 ms
                        app.engine.animFrameGlobal = !app.engine.animFrameGlobal;
                    }
                    app.engine.map.draw();
                }, 150);

                // Display helpful command
                setTimeout(function() {
                    app.displayMessage('Help', 'Type /help for some help', 'help');
                }, 500);
            },

            daytime: {
                // integer representing hour of day
                currentTime: 8,

                setCurrentTime: function(time) {
                    app.engine.daytime.currentTime = time;
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

            // Moves this character in the cardinal direction provided
            move: function(direction) {
                switch(direction) {
                    case 'n':
                        if (app.engine.viewport.y > -app.engine.PLAYER_OFFSET_Y && app.engine.lastDirection == 'n') {
                            app.engine.viewport.y--;
                        }
                        break;
                    case 'w':
                        if (app.engine.viewport.x > -app.engine.PLAYER_OFFSET_X && app.engine.lastDirection == 'w') {
                            app.engine.viewport.x--;
                        }
                        break;
                    case 's':
                        if (app.engine.viewport.y < app.engine.TOTALTILES_X - app.engine.PLAYER_OFFSET_Y - 1 && app.engine.lastDirection == 's') {
                            app.engine.viewport.y++;
                        }
                        break;
                    case 'e':
                        if (app.engine.viewport.x < app.engine.TOTALTILES_Y - app.engine.PLAYER_OFFSET_X - 1 && app.engine.lastDirection == 'e') {
                            app.engine.viewport.x++;
                        }
                        break;
                    default:
                        return false;
                        break;
                }

                app.engine.lastDirection = direction;
                app.engine.animFrameMe = !app.engine.animFrameMe;

                app.socket.emit('move', {
                    x: app.engine.viewport.x + app.engine.PLAYER_OFFSET_X,
                    y: app.engine.viewport.y + app.engine.PLAYER_OFFSET_Y,
                    direction: direction
                });

                app.engine.map.draw();

                return true;
            },

            // Resets the player to the spawn location
            moveToSpawn: function() {
                app.engine.viewport.y = 70;
                app.engine.viewport.x = 70;
                app.engine.lastDirection = 's';
                app.socket.emit('move', {
                    x: app.engine.viewport.x + app.engine.PLAYER_OFFSET_X,
                    y: app.engine.viewport.y + app.engine.PLAYER_OFFSET_Y,
                    direction: 's'
                });

                app.engine.map.draw();
            },

            // Nametags are displayed in HTML in a layer above canvas (for now at least, not sure which is faster)
            nametags: {
                $tags: $('#nametags'),

                // adds a player name, provided the X and Y coords of the player
                add: function(name, x, y) {
                    var x_pixel = (x - 4) * app.engine.TILEWIDTH + 7; // 7 is left margin or something
                    var y_pixel = (y - 1) * app.engine.TILEHEIGHT;
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
                    name: app.engine.playerName,
                    picture: app.engine.characterIndex
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
