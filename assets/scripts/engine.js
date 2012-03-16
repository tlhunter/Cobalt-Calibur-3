// Copyright 2011 Thomas Hunter :3
'use strict';

$(function() {
    window.app = {
        self: this,

        // Make socket connection ASAP
        socket: io.connect(window.document.location.protocol + "//" + window.document.location.host),

        // Grab some DOM elements
        $messages: $('#messages'),
        $newMessage: $('#message-input'),
        $playerName: $('#player-name'),
        $canvas: $('#map'),

        // Build main Engine object
        engine: {

            tileset: new Image(),
            tilesetCharacters: new Image(),

            // Stores our canvas context object
            handle: document.getElementById('map').getContext('2d'),

            // Dimensions of a single tile
            TILEWIDTH: 16,
            TILEHEIGHT: 16,
            TOTALTILES_X: 160,
            TOTALTILES_Y: 160,

            // Last direction this player was facing
            lastDirection: 's',
            characterIndex: 0,

            // Data regarding the canvas tag
            screen: {
                width: 0,       // The pixel width of the canvas
                height: 0,      // The pixel height of the canvas
                tilesX: 0,      // The number of X tiles
                tilesY: 0,      // The number of Y tiles
            },

            // Data regarding the viewport (window into the map)
            viewport: {
                x: 0,           // The viewport left tile
                y: 0,           // The viewport top tile
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
                draw: function(mapData) {
                    var i, j;
                    var mapX = 0;
                    var mapY = 0;
                    var tile;
                    app.engine.nametags.hide();

                    for (j=0; j<app.engine.screen.tilesY; j++) {
                        for (i=0; i < app.engine.screen.tilesX; i++) {
                            mapX = i + app.engine.viewport.x;
                            mapY = j + app.engine.viewport.y;
                            tile = (mapData[mapY] && mapData[mapY][mapX]) ? mapData[mapY][mapX] : null;
                            app.engine.tile.draw(i, j, tile);
                            var len = app.engine.players.locations.length;
                            for (var k = 0; k < len; k++) {
                                var player = app.engine.players.locations[k];
                                if (player.x == mapX && player.y == mapY) {
                                    var index = 0;
                                    if (player.direction == 'n') {
                                        index = 4;
                                    } else if (player.direction == 'e') {
                                        index = 2;
                                    } else if (player.direction == 's') {
                                        index = 0;
                                    } else if (player.direction == 'w') {
                                        index = 6;
                                    }
                                    var player_name = player.name || '???';
                                    var picture_id = player.picture || 56;
                                    app.engine.nametags.add(player.name, i, j);
                                    app.engine.tile.drawPlayer(i, j, index, picture_id);
                                }
                            }
                        }
                    }

                    var index = 0;
                    if (app.engine.lastDirection == 'n') {
                        index = 4;
                    } else if (app.engine.lastDirection == 'e') {
                        index = 2;
                    } else if (app.engine.lastDirection == 's') {
                        index = 0;
                    } else if (app.engine.lastDirection == 'w') {
                        index = 6;
                    }

                    app.engine.nametags.add(app.$playerName.val(), 21, 15);
                    app.engine.tile.drawPlayer(21, 15, index, app.engine.characterIndex);

                    app.engine.nametags.show();
                }
            },
            tile: {
                draw: function(x, y, tile) {
                    var x_pixel = x * app.engine.TILEWIDTH;
                    var y_pixel = y * app.engine.TILEHEIGHT;

                    if (!tile) {
                        app.engine.handle.fillRect(x_pixel, y_pixel, app.engine.TILEWIDTH, app.engine.TILEHEIGHT);  
                        return;
                    }

                    app.engine.handle.drawImage(
                        window.app.engine.tileset,
                        tile[0][0] * app.engine.TILEWIDTH,
                        tile[0][1] * app.engine.TILEHEIGHT,
                        app.engine.TILEWIDTH,
                        app.engine.TILEHEIGHT,
                        x_pixel,
                        y_pixel,
                        app.engine.TILEWIDTH,
                        app.engine.TILEHEIGHT
                    );

                    if (tile[1]) {
                       app.engine.handle.drawImage(
                            window.app.engine.tileset,
                            tile[1][0] * app.engine.TILEWIDTH,
                            tile[1][1] * app.engine.TILEHEIGHT,
                            app.engine.TILEWIDTH,
                            app.engine.TILEHEIGHT,
                            x_pixel,
                            y_pixel,
                            app.engine.TILEWIDTH,
                            app.engine.TILEHEIGHT
                           );
                    }
                },
                drawPlayer: function(x, y, tile_x, tile_y) {
                    var x_pixel = x * app.engine.TILEWIDTH;
                    var y_pixel = y * app.engine.TILEHEIGHT;
                    app.engine.handle.drawImage(
                        window.app.engine.tilesetCharacters,
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
            initialDraw: function(mapData) {
                setTimeout(function(md) {
                    return function() {
                        app.displayMessage('Client', 'Drawing Map...', 'client');
                        app.engine.map.draw(mapData);
                        app.displayMessage('Client', 'Done Drawing Map.', 'client');
                    }
                }(mapData), 50);   // wait 100 ms
            },

            start: function(mapData, x, y) {
                // load background image
                window.app.engine.tileset.src = '/assets/tilesets/Cobalt_Calibur.png';
                window.app.engine.tileset.onload = function() {
                    app.displayMessage('Client', 'Tileset Loaded', 'client');
                }
                // load characters image
                window.app.engine.tilesetCharacters.src = '/assets/tilesets/characters.png';
                window.app.engine.tilesetCharacters.onload = function() {
                    app.displayMessage('Client', 'Character Tileset Loaded', 'client');
                }

                app.engine.handle.fillStyle = "rgb(0,0,0)";  

                $('#message-box form').submit(function(event) {
                    event.preventDefault();
                    var message = app.$newMessage.val();
                    app.$newMessage.val('');
                    if (message === '/clear') {
                        window.app.$messages.empty();
                        return;
                    } else if (message === '/redraw') {
                        app.engine.map.draw(window.mapData);
                        return;
                    } else if (message === '/help') {
                        app.displayMessage('Help', '-{Keys}--------------------', 'help');
                        app.displayMessage('Help', 'Use the WASD keys to move', 'help');
                        app.displayMessage('Help', 'Press T to go to chat mode', 'help');
                        app.displayMessage('Help', 'Press Esc go to leave chat', 'help');
                        app.displayMessage('Help', '-{Commands}----------------', 'help');
                        app.displayMessage('Help', '/clear: reset message area', 'help');
                        app.displayMessage('Help', '/redraw: re draws map', 'help');
                        app.displayMessage('Help', '/help: displays this help', 'help');
                        app.displayMessage('Help', '/spawn: reset location', 'help');
                        return;
                    } else if (message === '/spawn') {
                        app.engine.moveToSpawn();
                        return;
                    }
                    app.displayMessage(app.$playerName.val(), message, 'self');
                    app.socket.emit('chat', {name: app.$playerName.val(), message: message, priority: 0});
                });

                app.socket.on('chat', function (data) {
                    app.displayMessage(data.name, data.message, data.priority);
                });

                app.socket.on('disconnect', function(data) {
                    alert("The connection to the server has closed. Anything you build now won't be preserved.");
                    app.displayMessage('Server', 'Disconnected', 'server');
                });

                app.socket.on('move', function(data) {
                    if (app.socket.socket.sessionid == data.session) return;
                    app.engine.players.update(data.session, data.x, data.y, data.direction);
                    // when move is first sent by server, entire player array sent with it
                    if (data.name || data.picture) {
                        app.engine.players.updateInfo(data.session, data.name, data.picture);
                    }
                    app.engine.map.draw(mapData);
                });

                app.socket.on('leave', function(data) {
                    app.engine.players.remove(data.session);
                    app.engine.map.draw(mapData);
                    var player_name = data.name || 'unknown';
                    app.displayMessage('Server', data.name + " has left the game", 'server');
                });

                app.socket.on('terraform', function (data) {
                    var node = window.mapData[data.y][data.x];
                    node[data.layer] = data.tile;
                    app.engine.map.draw(window.mapData);
                });

                app.socket.on('character info', function(data) {
                    if (app.socket.socket.sessionid == data.dession) return;
                    app.engine.players.updateInfo(data.session, data.name, data.picture);
                    app.engine.map.draw(window.mapData);
                });

                app.$playerName.val('Anon' + Math.floor(Math.random() * 8999 + 1000));
                app.engine.characterIndex = Math.floor(Math.random() * 56);
                $('#picture').val(app.engine.characterIndex);

                app.engine.screen.width  = window.app.$canvas.width();
                app.engine.screen.height = window.app.$canvas.height();
                app.engine.screen.tilesX = window.app.$canvas.width() / 15;
                app.engine.screen.tilesY = window.app.$canvas.height() / 16;

                app.engine.viewport.x = x;
                app.engine.viewport.y = y;

                // tell people where we are when we first login
                setTimeout(function() {
                    app.socket.emit('move', {
                        x: app.engine.viewport.x + 21,
                        y: app.engine.viewport.y + 15,
                        direction: 's'
                    });
                }, 10);
                // tell people what we look like when we first login
                setTimeout(function() {
                    app.engine.updateCharacterInfo(
                        $('#player-name').val(),
                        $('#picture').val()
                    );
                }, 50);

                app.engine.initialDraw(mapData);

                var $tilesetSelector = $('#tileset .selector');
                $('#tileset').mousemove(function(e) {
                    var tile_x = Math.floor(e.offsetX / app.engine.TILEWIDTH);
                    var tile_y = Math.floor(e.offsetY / app.engine.TILEHEIGHT);
                    $tilesetSelector.css({top: tile_y * app.engine.TILEHEIGHT, left: tile_x * app.engine.TILEWIDTH});
                });
                $('#tileset').click(function(e) {
                    var tile_x = Math.floor(e.offsetX / app.engine.TILEWIDTH);
                    var tile_y = Math.floor(e.offsetY / app.engine.TILEHEIGHT);

                    // The tileset uses a weird shape for foreground and background imagery, this if statement emulates that
                    var layer = 1;
                    if (tile_x <= 17 || (tile_x <= 23 && tile_y <= 7)) {
                        layer = 0;
                    }

                    window.mapData[app.engine.viewport.y + 15][app.engine.viewport.x + 21][layer] = [tile_x, tile_y];

                    app.engine.map.draw(window.mapData);

                    app.socket.emit('terraform', {
                        x: app.engine.viewport.x + 21,
                        y: app.engine.viewport.y + 15,
                        tile: [tile_x, tile_y],
                        layer: layer
                    });
                });

                $('#picture').bind('click keyup change', function() {
                    var index = parseInt($('#picture').val(), 10);
                    if (isNaN(index)) return;
                    app.engine.characterIndex = index;
                    app.engine.map.draw(window.mapData);
                    app.engine.updateCharacterInfo($('#player-name').val(), $(this).val());
                });

                $('#player-name').bind('keyup change', function() {
                    app.engine.map.draw(window.mapData);
                    app.engine.updateCharacterInfo($(this).val(), $('#picture').val());
                });

                $('#terraform .remove-tile').click(function() {
                    console.log('removing tile');
                    window.mapData[app.engine.viewport.y + 15][app.engine.viewport.x + 21][1] = null;
                    app.engine.map.draw(window.mapData);
                    app.socket.emit('terraform', {
                        x: app.engine.viewport.x + 21,
                        y: app.engine.viewport.y + 15,
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
                    }

                });

                $('#movement .north').click(function() { app.engine.move('n'); });
                $('#movement .west').click(function() { app.engine.move('w'); });
                $('#movement .east').click(function() { app.engine.move('e'); });
                $('#movement .south').click(function() { app.engine.move('s'); });

                app.displayMessage('Help', 'Type /help for some help', 'help');
            },

            // Moves a character in the cardinal direction provided
            move: function(direction) {
                switch(direction) {
                    case 'n':
                        if (app.engine.viewport.y <= -15) {
                            return false;
                        }
                        app.engine.viewport.y--;
                        break;
                    case 'w':
                        if (app.engine.viewport.x <= -21) {
                            return false;
                        }
                        app.engine.viewport.x--;
                        break;
                    case 's':
                        if (app.engine.viewport.y >= app.engine.TOTALTILES_X - 16) {
                            return false;
                        }
                        app.engine.viewport.y++;
                        break;
                    case 'e':
                        if (app.engine.viewport.x >= app.engine.TOTALTILES_Y - 22) {
                            return false;
                        }
                        app.engine.viewport.x++;
                        break;
                    default:
                        return false;
                        break;
                }

                app.engine.lastDirection = direction;

                app.socket.emit('move', {
                    x: app.engine.viewport.x + 21,
                    y: app.engine.viewport.y + 15,
                    direction: direction
                });

                app.engine.map.draw(window.mapData);

                return true;
            },

            // Resets the player to the spawn location
            moveToSpawn: function() {
                app.engine.viewport.y = 70;
                app.engine.viewport.x = 70;
                app.engine.lastDirection = 's';
                app.socket.emit('move', {
                    x: app.engine.viewport.x + 21,
                    y: app.engine.viewport.y + 15,
                    direction: 's'
                });

                app.engine.map.draw(window.mapData);
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
            updateCharacterInfo: function(name, picture) {
                app.socket.emit('character info', {
                    name: name,
                    picture: picture
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

    app.displayMessage('Client', 'Downloading Map Data...', 'client');

    $.get('/map', function(data) {
        app.displayMessage('Client', 'Initializing Map...', 'client');
        window.mapData = data;
        app.engine.start(window.mapData, 70, 70);
    });

});
