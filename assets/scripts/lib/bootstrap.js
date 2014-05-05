'use strict';

var _ = require('underscore');
var audio = require('./audio.js');
var chat = require('./chat.js');
var environment = require('./environment.js');
var graphics = require('./graphics.js');
var network = require('./network.js');
var npcs = require('./npcs.js');
var persistence = require('./persistence.js');
var player = require('./player.js');
var players = require('./players.js');

console.log('bootstrap load');

// TODO: All the code below (except for initialization stuff) needs to be broken out into the modules listed above
$(function() {
window.app = {
    // First we download a bunch of our assets
    downloadAssets: function() {
        chat.message('About', 'Cobalt Calibur, by Thomas Hunter (@tlhunter).', 'help');

        $.when(
            app.graphics.tilesets.download(
                '/assets/tilesets/inventory-32x32.png',
                app.graphics.tilesets.inventory
            ),
            app.graphics.tilesets.download(
                '/assets/tilesets/monsters-32x32.png',
                app.graphics.tilesets.monsters
            ),
            app.graphics.tilesets.download(
                '/assets/tilesets/characters-32x48.png',
                app.graphics.tilesets.characters
            ),
            app.graphics.tilesets.download(
                '/assets/tilesets/terrain-32x32.png',
                app.graphics.tilesets.terrain
            ),
            environment.downloadTiles(),
            environment.downloadMap()
        ).done(function() {
            app.initialize();
        });
    },

    // Once the assets are done downloading we initialize the rest of the app
    initialize: function() {
        app.graphics.initialize();
        app.network.connectSocket();
        app.graphics.viewport.update();
        app.network.bindEvents();
        app.network.send.join(player.name);
        app.initializeKeybindings();
        app.graphics.startAnimation();
        app.graphics.hearts.draw();
        chat.message('Help', 'Type /help for some help', 'help');
        chat.message('Help', 'Use the WASD keys to move around', 'help');

        setTimeout(function() {
            app.network.send.move(player.coordinates, player.direction);
            app.network.send.character(player.name, player.picture);
        }, 500);

        $('#controls .button').tipsy({fade: false, gravity: 's', html: true});
    },

    initializeKeybindings: function () {

        function changeDirection (direction, remove) {
            if (remove) {
                pressed = pressed.replace(direction, "");
            } else {
                // micro-optimization? - only declare the variables if they will be needed
                // even though they are scoped at this level maybe delayed definition is faster?
                var rEW = /[ew]/i, rNS = /[ns]/i;
                if (rEW.test(direction) && !rEW.test(pressed)) {
                    pressed += direction;
                } else if (rNS.test(direction) && !rNS.test(pressed)) {
                    pressed += direction;
                }
            }
        }

        function focusCLIslash() {
            $('#message-input').val('/');
            focusCLI();
        }

        function focusCLI () {
            // first boolean wil [enable|disable] movement interruption by command keys
            if (false || !pressed.length) {
                reset(true);
                $('#message-input').focus();
            }
        }

        // do as little as possible in here since it is firing for all keyboard events
        function keyvent (event) {
            var key = event.which,
                control = CONTROL[key],
                direction = MOVEMENT[key],
                keyup = event.type === "keyup";

            if (+key === 27) {
                reset(); // special case for "escape" key so that it can reset everything
            } else {
                if (!cliHasFocus) {
                    // only fire control function on keyup
                    if (control) {
                        keyup && control();
                    } else if (direction) {
                        event.preventDefault();
                        changeDirection(direction, keyup);

                        if (keyup) {
                            // if nothing is being held just clean up everything to baseline
                            !pressed.length && reset();
                        } else if (pressed.length && !pending) {
                            // immediately when the user presses a direction 
                            // turn the player to face that direction
                            player.setDirection(direction);
                            // if the user is only tapping the direction to 
                            // face that direction the keyup event will cancel
                            // the hold, other wise the user is intending to
                            // hold and move continuously
                            pending = setTimeout(movementCycle, 80);
                        }
                    }
                }
            }
        }

        // factory for placing items for static execution during gameplay
        function makeItemPlacement (num) {
            return function () {
                player.placeItem(8 + num);
            };
        }

        // movementCycle is started by key press and continues calling itself
        // while movement keys are held by the user to keep the player moving
        function movementCycle () {
            player.move(pressed);
            // when player can be different classes and have a different movement rate
            // the timeout variable should be a part of the player class and inserted below
            pending = setTimeout(movementCycle, player.speed || 200);
        }

        // "escape" key functionality - reset everything
        function reset (cli) {      // arg is a little bit of sugar
            cliHasFocus = !!cli;    // default to player control
            clearTimeout(pending);  // stop all movements
            pending = null;         // clear for starting new movements
            pressed = "";           // delete all held keys
        }

        var CONTROL = {                      // letter "f"
                "70" : player.mineFacingTile.bind(player),
                "84" : focusCLI,             // letter "t"
                "191": focusCLIslash,             // forward-slash "/"

                // "32" : 0, // space " "

                "49" : makeItemPlacement(1), // number "1"
                "50" : makeItemPlacement(2), // number "2"
                "51" : makeItemPlacement(3), // number "3"
                "52" : makeItemPlacement(4), // number "4"
                "53" : makeItemPlacement(5), // number "5"
                "54" : makeItemPlacement(6)  // number "6"
            },

            MOVEMENT = {
                "37" : "w", // arrow left
                "38" : "n", // arrow up
                "39" : "e", // arrow right
                "40" : "s", // arrow down

                "65" : "w", // letter a
                "68" : "e", // letter d
                "83" : "s", // letter s
                "87" : "n"  // letter w
            },

            // prevents movement and actions while the command box has focus
            cliHasFocus = false,

            // holds reference to current timeout
            pending,

            // current held keys
            pressed = "";

        $(document).on("keydown keyup", keyvent);
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
                    name: player.name,
                    message: message,
                    priority: 0
                });
            },
            // Player moves to a new location
            move: function(coords, direction) {
                app.network.socket.emit('character info', {
                    x: coords.x,
                    y: coords.y,
                    direction: direction
                });
            },
            // Player builds a tile or mines a tile
            terraform: function(x, y, tile) {
                app.network.socket.emit('terraform', {
                    x: x,
                    y: y,
                    tile: tile
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
                    audio.play('chat');
                }
                chat.message(data.name, data.message, data.priority);
            });

            socket.on('disconnect', function(data) {
                chat.message('Server', 'Disconnected', 'server');
            });

            socket.on('leave', function(data) {
                players.remove(data.session);
                chat.message(data.name || 'unknown', "Player Disconnected", 'server');
            });

            socket.on('terraform', function (data) {
                environment.map[data.x][data.y] = data.tile;
            });

            socket.on('character info', function(data) {
                if (socket.socket.sessionid == data.dession) return;
                players.update(data);
            });

            socket.on('event time', function(data) {
                environment.daylight.setTime(data.time);
            });

            socket.on('event earthquake', function(data) {
                $.get('/map', function(data) {
                    environment.data = data;
                });
                chat.message('Server', "There has been an earthquake! New Rock and Ore has been added to the world.", 'server');
                audio.play('earthquake');
            });

            socket.on('event npcmovement', function(data) {
                npcs.update(data.npcs);
            });

            socket.on('event corruption', function(data) {
                environment.corruption = data.map;
            });

            socket.on('event bigterraform', function(data) {
                $.get('/map', function(data) {
                    environment.map = data;
                });
            });
        }
    },

    // Functions and data regarding the map

    graphics: {
        TILE_WIDTH_PIXEL: 32,
        TILE_HEIGHT_PIXEL: 32,

        globalAnimationFrame: false,
        selfAnimationFrame: false,
        $canvas: null,
        handle: null,

        initialize: function() {
            var view = app.graphics.viewport;
            view.WIDTH_TILE = Math.floor($(window).width() / app.graphics.TILE_WIDTH_PIXEL);
            view.HEIGHT_TILE = Math.floor($(window).height() / app.graphics.TILE_HEIGHT_PIXEL);
            view.WIDTH_PIXEL = app.graphics.viewport.WIDTH_TILE * app.graphics.TILE_WIDTH_PIXEL;
            view.HEIGHT_PIXEL = app.graphics.viewport.HEIGHT_TILE * app.graphics.TILE_HEIGHT_PIXEL;
            view.PLAYER_OFFSET_TOP_TILE = Math.floor(view.HEIGHT_TILE / 2);
            view.PLAYER_OFFSET_LEFT_TILE = Math.floor(view.WIDTH_TILE / 2) + 1;
            $('#gamefield').append('<canvas id="map" width="' + view.WIDTH_PIXEL + '" height="' + view.HEIGHT_PIXEL + '"></canvas>');
            $('#page, #nametags').width(view.WIDTH_PIXEL).height(view.HEIGHT_PIXEL);

            app.graphics.$canvas = $('#map');
            app.graphics.handle = document.getElementById('map').getContext('2d');
        },

        startAnimation: function() {
            var currentFrame = 0;
            setInterval(function() {
                currentFrame++;
                if (currentFrame % 3 == 0) {
                    currentFrame = 0;
                    // redraw every 150 ms, but change animation every 450 ms
                    app.graphics.globalAnimationFrame = !app.graphics.globalAnimationFrame;
                    var adjacent = npcs.adjacent(player.coordinates);
                    if (adjacent !== false) {
                        player.hurt("Killed by " + app.graphics.tilesets.descriptors.monsters[adjacent].name);
                    }
                }
                environment.render();
            }, 150);
        },

        viewport: {
            update: function() {
                app.graphics.viewport.x = player.coordinates.x - app.graphics.viewport.PLAYER_OFFSET_LEFT_TILE;
                app.graphics.viewport.y = player.coordinates.y - app.graphics.viewport.PLAYER_OFFSET_TOP_TILE;
            },

            WIDTH_PIXEL: null,
            HEIGHT_PIXEL: null,

            WIDTH_TILE: null,
            HEIGHT_TILE: null,

            PLAYER_OFFSET_LEFT_TILE: null,
            PLAYER_OFFSET_TOP_TILE: null,

            x: null,
            y: null
        },

        tilesets: {
            terrain: new Image(),
            characters: new Image(),
            monsters: new Image(),
            inventory: new Image(),
            descriptors: {
                terrain: null,
                characters: null,
                monsters: null,
                inventory: null
            },

            download: function(url, tileset) {
                var d = $.Deferred();
                tileset.src = url;
                tileset.onload = function() { d.resolve(); }
                tileset.onerror = function() { d.reject(); }
                return d.promise();
            }
        },

        // Nametags are displayed in HTML in a layer above canvas
        nametags: {
            $tags: $('#nametags'),

            // adds a player name, provided the X and Y coords of the player
            add: function(name, x, y, monster) {
                var cls = ''
                if (monster) {
                    cls = ' class="monster"'
                }
                var x_pixel = (x - 2) * app.graphics.TILE_WIDTH_PIXEL;
                var y_pixel = (y + 1) * app.graphics.TILE_HEIGHT_PIXEL;
                var $tags = app.graphics.nametags.$tags;
                var $name = $('<div class="name"><span' + cls + '>' + name + '</span></div>');
                $name.css({
                    left: x_pixel,
                    top: y_pixel
                });
                $tags.append($name);
            },

            // hide (for efficient DOM redraws) and clear entries
            hide: function() {
                app.graphics.nametags.$tags.hide().empty();
            },

            // show list again
            show: function() {
                app.graphics.nametags.$tags.show();
            }
        },

        drawAvatar: function(x, y, tile_x, tile_y, tileset) {
            var x_pixel = x * app.graphics.TILE_WIDTH_PIXEL;
            var y_pixel = y * app.graphics.TILE_HEIGHT_PIXEL;
            var tile_height = 32;

            if (tileset == 'monsters') {
                tileset = app.graphics.tilesets.monsters;
                tile_height = 32;
            } else if (tileset == 'characters') {
                tileset = app.graphics.tilesets.characters;
                y_pixel -= 16;
                tile_height = 48;
            }
            app.graphics.handle.drawImage(
                tileset,
                tile_x * app.graphics.TILE_WIDTH_PIXEL,
                tile_y * tile_height,
                app.graphics.TILE_WIDTH_PIXEL,
                tile_height,
                x_pixel,
                y_pixel,
                app.graphics.TILE_WIDTH_PIXEL,
                tile_height
            );
        },

        drawTile: function(x, y, tile) {
            var x_pixel = x * app.graphics.TILE_WIDTH_PIXEL;
            var y_pixel = y * app.graphics.TILE_HEIGHT_PIXEL;

            if (typeof tile !== 'number') {
                return;
            }

            app.graphics.handle.drawImage(
                app.graphics.tilesets.terrain,
                0,
                tile * app.graphics.TILE_HEIGHT_PIXEL,
                app.graphics.TILE_WIDTH_PIXEL,
                app.graphics.TILE_HEIGHT_PIXEL,
                x_pixel,
                y_pixel,
                app.graphics.TILE_WIDTH_PIXEL,
                app.graphics.TILE_HEIGHT_PIXEL
            );
        },

        drawCorruption: function(x, y) {
            app.graphics.handle.fillRect(
                x * app.graphics.TILE_WIDTH_PIXEL,
                y * app.graphics.TILE_HEIGHT_PIXEL,
                app.graphics.TILE_WIDTH_PIXEL,
                app.graphics.TILE_HEIGHT_PIXEL
            );
        },

        getAvatarFrame: function(direction, altFrame) {
            return ({e:3, n:6, w:9}[direction] || 0) + (altFrame && 2);
        },

        hearts: {
            $holder: $('#hearts .holder'),

            draw: function() {
                app.graphics.hearts.$holder.html(Array(1+player.life).join('<div class="heart"></div>'));
            }
        }
    }

};

// TODO: These should all be broken up into constructors
chat.setPlayer(player).setPlayers(players).setEnvironment(environment).setNetwork(app.network);
persistence.setPlayer(player).setChat(chat).init();
player.setEnvironment(environment).setGraphics(app.graphics).setAudio(audio).setNetwork(app.network).setChat(chat).setPersistence(persistence);
environment.setGraphics(app.graphics).setChat(chat).setNPCs(npcs).setPlayers(players).setPlayer(player);

app.downloadAssets();
});
