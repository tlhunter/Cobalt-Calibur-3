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
            handle: document.getElementById('map').getContext('2d'),
            TILEWIDTH: 16,
            TILEHEIGHT: 16,
            lastDirection: 's',
            screen: {
                width: 0,
                height: 0,
                tilesX: 0,
                tilesY: 0,
            },
            viewport: {
                x: 0,
                y: 0,
            },
            players: {
                locations: [],
                update: function(session, x, y, direction) {
                    var found = false;
                    var len=app.engine.players.locations.length;
                    for(var i=0; i<len; i++) {
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
                }
            },
            map: {
                draw: function(mapData, direction) {
                    var i, j;
                    var mapX = 0;
                    var mapY = 0;
                    var tile;

                    for (j=0; j<app.engine.screen.tilesY; j++) {
                        for (i=0; i < app.engine.screen.tilesX; i++) {
                            mapX = i + app.engine.viewport.x;
                            mapY = j + app.engine.viewport.y;
                            tile = (mapData[mapY] && mapData[mapY][mapX]) ? mapData[mapY][mapX] : {g: 0};
                            app.engine.tile.draw(i, j, tile);
                            var len = app.engine.players.locations.length;
                            for (var k = 0; k < len; k++) {
                                var player = app.engine.players.locations[k];
                                if (player.x == mapX && player.y == mapY) {
                                    var id = 32;
                                    if (player.direction == 'n') {
                                        id = 30;
                                    } else if (player.direction == 'e') {
                                        id = 31;
                                    } else if (player.direction == 's') {
                                        id = 32;
                                    } else if (player.direction == 'w') {
                                        id = 33;
                                    }
                                    app.engine.tile.draw(i, j, {b:0,g:id});
                                }
                            }
                        }
                    }

                    var id = 32;
                    if (!direction) direction = app.engine.lastDirection;

                    if (direction == 'n') {
                        id = 30;
                    } else if (direction == 'e') {
                        id = 31;
                    } else if (direction == 's') {
                        id = 32;
                    } else if (direction == 'w') {
                        id = 33;
                    }
                    app.engine.tile.draw(21, 15, {b:0, g:id});
                }
            },
            tile: {
                draw: function(x, y, tile) {
                    var x_pixel = x * app.engine.TILEWIDTH;
                    var y_pixel = y * app.engine.TILEHEIGHT;
                   app.engine.handle.drawImage(
                       app.engine.tile.retrieve(tile.g),
                       x_pixel,
                       y_pixel
                   );

                   if (tile.b) {
                      app.engine.handle.drawImage(
                          app.engine.tile.retrieve(tile.b),
                          x_pixel,
                          y_pixel
                      );
                   }
                },
                images: [],
                store: function(id, imgSrc) {
                    var newid = app.engine.tile.images.length;
                    var tile  = [id, new Image(), false];   // format as explained: [id, Image, loaded]

                    tile[1].src    = imgSrc;
                    tile[1].onload = function() {
                        tile[2] = true;
                    }
                    app.engine.tile.images[newid] = tile;   // store this tile
                },
                retrieve: function(id) {
                    var i, len = app.engine.tile.images.length;

                    for (i=0; i<len; i++) {
                        if (app.engine.tile.images[i][0] == id) {
                            return app.engine.tile.images[i][1];   // return the image object
                        }
                    }
                },
                allLoaded: function() {
                    var i, len = app.engine.tile.images.length;

                    for (i=0; i<len; i++) {
                        if (app.engine.tile.images[i][2] === false) {
                            return false;
                        }
                    }
                    return true;
                }
            },
            initialDraw: function(mapData) {
                if (app.engine.tile.allLoaded() === false) {
                    setTimeout(function(md) {
                        return function() {
                            app.engine.initialDraw(md);
                        }
                    }(mapData), 50);   // wait 100 ms
                } else {
                    app.displayMessage('Client', 'Drawing Map...', 'client');
                    app.engine.map.draw(mapData);
                    app.displayMessage('Client', 'Done Drawing Map.', 'client');
                }
            },

            start: function(mapData, x, y) {

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
                    console.log("Chat", data);
                    app.displayMessage(data.name, data.message, data.priority);
                });

                app.socket.on('move', function(data) {
                    console.log("Move", data);
                    app.engine.players.update(data.session, data.x, data.y, data.direction);
                    app.engine.map.draw(mapData);
                });

                app.socket.on('terraform', function (data) {
                    var node = window.mapData[data.y][data.x];
                    if (data.g !== null) {
                        node.g = data.g;
                        console.log('change background');
                    }
                    if (data.b !== null) {
                        node.b = data.b;
                        console.log('change foreground');
                    }
                    console.log("Terraform", data, node);
                    app.engine.map.draw(window.mapData);
                });

                app.$playerName.val('Anon' + Math.floor(Math.random()*8999+1000));

                app.engine.screen.width  = window.app.$canvas.width();
                app.engine.screen.height = window.app.$canvas.height();
                app.engine.screen.tilesX = window.app.$canvas.width() / 15;
                app.engine.screen.tilesY = window.app.$canvas.height() / 16;

                app.engine.viewport.x = x;
                app.engine.viewport.y = y;

                app.displayMessage("Client", "Downloading Tiles...", 'client');

                // Terrain
                app.engine.tile.store(0, '/assets/tiles/water.png');
                app.engine.tile.store(1, '/assets/tiles/grass.png');
                app.engine.tile.store(2, '/assets/tiles/sand.png');

                // Foreground
                app.engine.tile.store(3, '/assets/tiles/house.png');
                app.engine.tile.store(4, '/assets/tiles/town.png');
                app.engine.tile.store(5, '/assets/tiles/village.png');
                app.engine.tile.store(6, '/assets/tiles/temple.png');
                app.engine.tile.store(7, '/assets/tiles/tree.png');
                app.engine.tile.store(8, '/assets/tiles/wood.png');
                app.engine.tile.store(9, '/assets/tiles/stone.png');
                app.engine.tile.store(10, '/assets/tiles/rock.png');
                app.engine.tile.store(11, '/assets/tiles/sign.png');
                app.engine.tile.store(12, '/assets/tiles/bush.png');
                app.engine.tile.store(13, '/assets/tiles/grave.png');
                app.engine.tile.store(14, '/assets/tiles/tile.png');
                app.engine.tile.store(15, '/assets/tiles/forest.png');
                app.engine.tile.store(16, '/assets/tiles/well.png');

                // Mountains Only
                app.engine.tile.store(20, '/assets/tiles/mountain.png');
                app.engine.tile.store(21, '/assets/tiles/mountain_nw.png');
                app.engine.tile.store(22, '/assets/tiles/mountain_n.png');
                app.engine.tile.store(23, '/assets/tiles/mountain_ne.png');
                app.engine.tile.store(24, '/assets/tiles/mountain_w.png');
                app.engine.tile.store(25, '/assets/tiles/mountain_c.png');
                app.engine.tile.store(26, '/assets/tiles/mountain_e.png');
                app.engine.tile.store(27, '/assets/tiles/mountain_sw.png');
                app.engine.tile.store(28, '/assets/tiles/mountain_s.png');
                app.engine.tile.store(29, '/assets/tiles/mountain_se.png');

                // Character Graphics
                app.engine.tile.store(30, '/assets/tiles/character_n.png');
                app.engine.tile.store(31, '/assets/tiles/character_e.png');
                app.engine.tile.store(32, '/assets/tiles/character_s.png');
                app.engine.tile.store(33, '/assets/tiles/character_w.png');

                app.displayMessage('Client', 'Done Downloading Tiles.', 'client');

                app.engine.initialDraw(mapData);

                var $background = $('#terraform .background');
                for (var i = 0; i <= 2; i++) {
                    var tile = app.engine.tile.images[i];
                    var $graphic = $(tile[1]);
                    $graphic.attr('data-id', tile[0]).attr('data-type', 'background');
                    $background.append($graphic);
                }

                var $foreground = $('#terraform .foreground');
                for (var i = 3; i <= 26; i++) {
                    var tile = app.engine.tile.images[i];
                    var $graphic = $(tile[1]);
                    $graphic.attr('data-id', tile[0]).attr('data-type', 'foreground');
                    $foreground.append($graphic);
                }

                $('#terraform img, #terraform span').click(function() {
                    var g = null, b = null;
                    var $el = $(this);
                    if ($el.attr('data-type') == 'foreground') {
                        b = parseInt($(this).attr('data-id'), 10);
                        window.mapData[app.engine.viewport.y + 15][app.engine.viewport.x + 21].b = b;
                    } else {
                        g = parseInt($(this).attr('data-id'), 10);
                        window.mapData[app.engine.viewport.y + 15][app.engine.viewport.x + 21].g = g;
                    }
                    app.engine.map.draw(window.mapData);

                    app.socket.emit('terraform', {
                        x: app.engine.viewport.x + 21,
                        y: app.engine.viewport.y + 15,
                        g: g,
                        b: b
                    });
                });

                var $tilesetSelector = $('#tileset .selector');
                $('#tileset').mousemove(function(e) {
                    var x = Math.floor(e.offsetX / app.engine.TILEWIDTH);
                    var y = Math.floor(e.offsetY / app.engine.TILEHEIGHT);
                    $tilesetSelector.css({top: y * app.engine.TILEHEIGHT, left: x * app.engine.TILEWIDTH});
                });
                $('#tileset').click(function(e) {
                    var x = Math.floor(e.offsetX / app.engine.TILEWIDTH);
                    var y = Math.floor(e.offsetY / app.engine.TILEHEIGHT);
                    console.log(x, y);
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
                        e.preventDefault();
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
                        if (app.engine.viewport.y >= 184) {
                            return false;
                        }
                        app.engine.viewport.y++;
                        break;
                    case 'e':
                        if (app.engine.viewport.x >= 178) {
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

                app.engine.map.draw(window.mapData, direction);

                return true;
            },

            moveToSpawn: function() {
                app.engine.viewport.y = 100;
                app.engine.viewport.x = 100;
                app.engine.lastDirection = 's';
                app.socket.emit('move', {
                    x: app.engine.viewport.x + 21,
                    y: app.engine.viewport.y + 15,
                    direction: 's'
                });

                app.engine.map.draw(window.mapData, 's');
            }
        },

        displayMessage: function(label, message, priority) {
            this.$messages.append("<div class='message " + priority + "'><span class='username'>" + label + ": </span><span class='content'>" + message + "</span></div>");
            this.$messages.animate({scrollTop: this.$messages[0].scrollHeight});
        },

    };

    app.displayMessage('Client', 'Downloading Map Data...', 'client');
    $.get('/map', function(data) {
        app.displayMessage('Client', 'Initializing Map...', 'client');
        window.mapData = data;
        app.engine.start(window.mapData, 100, 100);
    });

});
