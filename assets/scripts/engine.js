// Copyright 2011 Thomas Hunter :3
'use strict';

$(function() {
window.app = {
    // First we download a bunch of our assets
    downloadAssets: function() {
        app.chat.message('About', 'Cobalt Calibur, by Thomas Hunter (@tlhunter).', 'help');
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
            app.environment.downloadTiles(),
            app.environment.downloadMap()
        ).done(function() {
            app.initialize();
        });
    },

    // Once the assets are done downloading we initialize the rest of the app
    initialize: function() {
        app.graphics.initialize();
        app.network.connectSocket();
        app.audio.initialize();
        app.persistence.load() || app.persistence.createNewPlayer();
        app.graphics.viewport.update();
        app.player.regenerateHearts();
        app.player.inventory.render();
        app.chat.initialize();
        app.network.bindEvents();
        app.network.send.join(app.player.name);
        app.initializeKeybindings();
        app.persistence.startAutoSave();
        app.graphics.startAnimation();
        app.graphics.hearts.draw();
        app.chat.message('Help', 'Type /help for some help', 'help');
        app.chat.message('Help', 'Use the WASD keys to move around', 'help');

        setTimeout(function() {
            app.network.send.move(app.player.coordinates, app.player.direction);
            app.network.send.character(app.player.name, app.player.picture);
        }, 500);

        $('#controls .button').tipsy({fade: false, gravity: 's', html: true});
    },

    environment: {
        map: {
            WIDTH_TILE: 200,
            HEIGHT_TILE: 200,

            colors: {
                black: "rgb(0,0,0)",
                corruption: [
                    "rgba(15,0,61,0.5)",
                    "rgba(36,14,88,0.7)",
                    "rgba(47,24,99,0.6)"
                ]
            },
            data: [],

            getTile: function(x, y) {
                var tile = app.environment.map.data[x][y];
                var data = {};
                if (tile && typeof tile[0] != 'undefined') {
                    data.tile = app.graphics.tilesets.descriptors.terrain[tile[0]];
                }
                if (tile && typeof tile[1] != 'undefined') {
                    data.health = tile[1];
                }
                return data;
            },

            // used to filter all npc + other players to only those in view
            isInViewport: function isInViewport (avatar) {
                var viewport = app.graphics.viewport;
                // this math could be cleaned up!
                return avatar.x >= viewport.x && avatar.x <= viewport.x + viewport.WIDTH_TILE
                    && avatar.y >= viewport.y && avatar.y <= viewport.y + viewport.HEIGHT_TILE;
            },

            drawAvatar: function drawAvatar (redrawNametags, avatar) {
                var x = avatar.x - app.graphics.viewport.x,
                    y = avatar.y - app.graphics.viewport.y,
                    index = app.graphics.getAvatarFrame(avatar.d || avatar.direction, app.graphics.globalAnimationFrame),
                    isPlayer = "name" in avatar,
                    avatar_name = avatar.name || app.graphics.tilesets.descriptors.monsters[avatar.id].name || "???",
                    avatar_id = ~~avatar.picture || avatar.id || 0;

                if (redrawNametags) app.graphics.nametags.add(avatar_name, x, y, !isPlayer);
                app.graphics.drawAvatar(x, y, index, avatar_id, isPlayer ? 'characters' : 'monsters');
            },

            // return properly sorted list of all other avatars
            getAvatars: function getAvatars () {
                return app.npc.data.concat(app.players.data)
                    .sort(function (a, b) {
                        return a.x !== b.x ? 0 : a.y < b.y ? -1 : 1;
                    });
            },

            render: function(redrawNametags) {
                // immediately draw canvas as black
                app.graphics.handle.fillStyle = app.environment.map.colors.black;
                app.graphics.handle.fillRect(0, 0, app.graphics.viewport.WIDTH_PIXEL, app.graphics.viewport.HEIGHT_PIXEL);

                var i, j;
                var mapX = 0;
                var mapY = 0;
                var tile;
                if (redrawNametags) app.graphics.nametags.hide();

                for (j=0; j<app.graphics.viewport.HEIGHT_TILE; j++) {
                    for (i=0; i < app.graphics.viewport.WIDTH_TILE; i++) {
                        mapX = i + app.graphics.viewport.x;
                        mapY = j + app.graphics.viewport.y;
                        tile = (app.environment.map.data[mapX] && app.environment.map.data[mapX][mapY]) ? app.environment.map.data[mapX][mapY] : null;
                        app.graphics.drawTile(i, j, tile);

                        // Draw Corruption
                        if (app.environment.corruption.loaded && mapX >= 0 && mapX < app.environment.map.WIDTH_TILE && mapY >= 0 && mapY < app.environment.map.HEIGHT_TILE && app.environment.corruption.data[mapX][mapY] === 1) {
                            app.graphics.handle.fillStyle = app.environment.map.colors.corruption[Math.floor(Math.random() * app.environment.map.colors.corruption.length)];
                            app.graphics.drawCorruption(i, j);
                        }
                    }
                }

                // Draw NPCs + other players
                app.environment.map.getAvatars()
                    .filter(app.environment.map.isInViewport)
                    .forEach(app.environment.map.drawAvatar.bind(null, redrawNametags));

                // Draw this player
                var index = app.graphics.getAvatarFrame(app.player.direction, app.graphics.selfAnimationFrame);
                if (redrawNametags) app.graphics.nametags.add(app.player.name, app.graphics.viewport.PLAYER_OFFSET_LEFT_TILE, app.graphics.viewport.PLAYER_OFFSET_TOP_TILE, false);
                app.graphics.drawAvatar(app.graphics.viewport.PLAYER_OFFSET_LEFT_TILE, app.graphics.viewport.PLAYER_OFFSET_TOP_TILE, index, app.player.picture, 'characters');

                if (redrawNametags) app.graphics.nametags.show();

                app.environment.daylight.draw();
            },
        },

        corruption: {
            data: [],
            loaded: false,

            update: function(data) {
                app.environment.corruption.loaded = true;
                app.environment.corruption.data = data;
            }
        },

        daylight: {
            time: 8, // integer representing hour of day

            setTime: function(time) {
                app.environment.daylight.time = time;
                $('#clock').html(time + ':00');
            },

            draw: function() {
                var color = null;
                var time = app.environment.daylight.time;
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
                    app.graphics.handle.fillStyle = color;
                    app.graphics.handle.fillRect(0, 0, app.graphics.viewport.WIDTH_PIXEL, app.graphics.viewport.HEIGHT_PIXEL);
                }
            }
        },

        downloadTiles: function() {
            return $.get('/assets/tilesets/data.json').pipe(function(data) {
                app.chat.message('Client', 'Tileset Descriptors done.', 'client');
                app.graphics.tilesets.descriptors = data;
                return true;
            });
        },

        downloadMap: function() {
            return $.get('/map').pipe(function(data) {
                app.chat.message('Client', 'Map data done.', 'client');
                app.environment.map.data = data;
                return true;
            });
        },
    },

    player: {
        hearts: 5,
        picture: 0,
        name: '',
        god: false,
        coordinates: {
            x: 100,
            y: 100
        },
        direction: 's',
        speed: 150,

        // Attempts to move the character in the direction we specify
        move: function(d) {
            // if nothing is passed in or anything not acceptable is passed in do nothing
            if (!d || /[^ensw]/i.test(d)) {
                console.log("Invalid direction passed to move: " + d);
                return false;
            }

            // face the player in the direction of the first valid direction passed in
            app.player.setDirection(d.slice(0,1));

            // convert d to an array of directions for consistent processing
            // ensure that the pair is [x, y]
            d = [(d.match(/[ew]/) || [])[0] || "", (d.match(/[ns]/) || [])[0] || ""]
                // map to grid movement change values
                .map(function (item) {
                    // parse into integers
                    return ~~({e: 1, n: -1, s: 1, w: -1}[item]);
                });

            var coords = app.player.coordinates;

            if (!app.player.accessible(coords.x + d[0], coords.y + d[1])) {
                app.audio.play('walk-fail');
            } else {
                app.player.coordinates.x += d[0];
                app.player.coordinates.y += d[1];
                app.audio.play('walk');

                if (app.environment.corruption.loaded && app.environment.corruption.data[coords.x][coords.y]) {
                    if (Math.random() < 1/8) {
                        app.player.hurt("You were killed by corruption");
                        app.network.send.chat("*Killed by Corruption*");
                    }
                }

                app.graphics.selfAnimationFrame = !app.graphics.selfAnimationFrame;
                app.graphics.viewport.update();
            }
        },

        inventory: {
            data: [0, 0, 0, 0, 0, 0, 0, 0, 0],

            update: function(index, amount) {
                var data = app.player.inventory.data;
                if (amount < 0) {
                    if (data[index] >= -amount) {
                        data[index] += amount;
                        $('#inventory-'+index+' span').stop().css({fontSize: '8px'}).animate({ fontSize : '15px' }).html(data[index]);
                        return true;
                    }
                    return false;
                } else {
                    data[index] += amount;
                    $('#inventory-'+index+' span').stop().css({fontSize: '22px'}).animate({ fontSize : '15px' }).html(data[index]);
                    return true;
                }
            },

            render: function() {
                var len = app.player.inventory.data.length;
                for (var i = 0; i < len; i++) {
                    $('#inventory-'+i+' span').html(app.player.inventory.data[i]);
                }
            },
        },

        // Forces an XY location
        setLocation: function(x, y) {
            app.player.coordinates = {x: x, y: y};
            app.graphics.viewport.update();
            app.player.broadcastLocation();
        },

        // Sets the direction we are facing
        setDirection: function(d) {
            app.player.direction = d;
            app.player.broadcastLocation();
        },

        // Gets information about the tile we are facing
        getFacingTile: function() {
            var coords = app.player.coordinates;
            var data = {};
            switch(app.player.direction) {
                case 'n':
                    data.coordinates = {x: coords.x, y: coords.y - 1};
                    break;
                case 'e':
                    data.coordinates = {x: coords.x + 1, y: coords.y};
                    break;
                case 's':
                    data.coordinates = {x: coords.x, y: coords.y + 1};
                    break;
                case 'w':
                    data.coordinates = {x: coords.x - 1, y: coords.y};
                    break;
                default:
                    console.log("Invalid Direction", app.player.direction);
                    break;
            }

            _.extend(
                data,
                app.environment.map.getTile(data.coordinates.x, data.coordinates.y)
            );

            return data;
        },

        // Whether or not the tile can be walked on
        accessible: function(x, y) {
            if (x < 0 || y < 0 || x >= app.environment.map.WIDTH_TILE || y >= app.environment.map.HEIGHT_TILE) {
                return false;
            }
            if (app.environment.map.getTile(x, y).tile.block_player) {
                return false;
            }
            return true;
        },

        // Sends the players location and direction to the server
        broadcastLocation: function() {
            app.network.send.move(app.player.coordinates, app.player.direction);
            app.environment.map.render(true);
        },

        // Mines the facing tile, adjusts inventory
        mineFacingTile: function() {
            var tileData = app.player.getFacingTile();
            var coords = tileData.coordinates;
            if (!app.player.god && coords.x >= 96 && coords.x <= 104 && coords.y >= 96 && coords.y <= 104) {
                app.audio.play('mine-fail');
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
            app.environment.map.data[coords.x][coords.y][0] = becomes;
            app.network.send.terraform(coords.x, coords.y, becomes);
            app.player.inventory.update(provides.id, provides.quantity);
            app.audio.play('mine');
        },

        // Attempts to create and then place the specified tile
        placeItem: function(terrainIndex) {
            var replaceTile = app.player.getFacingTile();
            var coords = replaceTile.coordinates;
            if (!app.player.god && coords.x >= 96 && coords.x <= 104 && coords.y >= 96 && coords.y <= 104) {
                document.getElementById('sound-build-fail').play();
                app.chat.message('Client', 'You cannot change the spawn location.', 'client');
                return false;
            }
            if (!replaceTile.tile.replaceable) {
                document.getElementById('sound-build-fail').play();
                app.chat.message('Client', 'This object cannot be built over.', 'client');
                return false;
            }
            var item = app.graphics.tilesets.descriptors.terrain[terrainIndex];
            // provides is also the cost of manufacturing the tile
            if (app.player.inventory.update(item.provides.id, -item.provides.quantity)) {
                app.audio.play('build');
                app.environment.map.data[coords.x][coords.y][0] = terrainIndex;
                app.network.send.terraform(coords.x, coords.y, terrainIndex);
                return true;
            } else {
                app.chat.message('Client', "You don't have the inventory to build this.", 'client');
                return false;
            }
        },

        // Sends the player back to spawn
        kill: function(message) {
            app.audio.play('death');
            app.player.direction = 's';
            app.player.setLocation(100, 100);
            app.graphics.viewport.update();
            app.chat.message('Client', message, 'client');
            app.persistence.save();

            setTimeout(function() {
                app.player.hearts = 5;
                app.graphics.hearts.draw();
            }, 200);
        },

        // Checks to see if an NPC is adjacent to the player, and if so, kills them
        killIfNpcNearby: function() {
            var coords = app.player.coordinates;
            var len = app.npc.data.length;
            for (var l = 0; l < len; l++) {
                var npc = app.npc.data[l];
                for (var i = -1; i <= 1; i++) {
                    for (var j = -1; j <= 1; j++) {
                        if (npc.x == coords.x+i && npc.y == coords.y+j) {
                            app.player.hurt("Killed by " + app.graphics.tilesets.descriptors.monsters[npc.id].name);
                            break;
                        }
                    }
                }
            }
        },

        hurt: function(killMessage) {
            app.player.hearts--;
            if (app.player.hearts <= 0) {
                app.player.kill(killMessage);
                return;
            }
            app.graphics.hearts.draw();
        },

        regenerateHearts: function () {
            if (app.player.hearts < 5) {
                app.player.hearts++;
                app.graphics.hearts.draw();
            }
            setTimeout(app.player.regenerateHearts, 30 * 1000);
        }
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
                            app.player.setDirection(direction);
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
                app.player.placeItem(8 + num);
            };
        }

        // movementCycle is started by key press and continues calling itself
        // while movement keys are held by the user to keep the player moving
        function movementCycle () {
            app.player.move(pressed);
            // when player can be different classes and have a different movement rate
            // the timeout variable should be a part of the player class and inserted below
            pending = setTimeout(movementCycle, app.player.speed || 200);
        }

        // "escape" key functionality - reset everything
        function reset (cli) {      // arg is a little bit of sugar
            cliHasFocus = !!cli;    // default to player control
            clearTimeout(pending);  // stop all movements
            pending = null;         // clear for starting new movements
            pressed = "";           // delete all held keys
        }

        var CONTROL = {                      // letter "f"
                "70" : app.player.mineFacingTile.bind(app.player),
                "84" : focusCLI,             // letter "t"
                "191": focusCLI,             // forward-slash "/"

                // "32" : 0, // space " "

                "49" : makeItemPlacement(1), // number "1"
                "50" : makeItemPlacement(2), // number "2"
                "51" : makeItemPlacement(3), // number "3"
                "52" : makeItemPlacement(4), // number "4"
                "53" : makeItemPlacement(5)  // number "5"
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

    // NPC stuff
    npc: {
        data: [],

        update: function(data) {
            app.npc.data = data;
        }
    },

    // handles saving and loading data to local storage. One day this won't be needed at all.
    persistence: {
        save: function() {
            localStorage.setItem('data', JSON.stringify({
                inventory: app.player.inventory.data,
                direction: app.player.direction,
                location: app.player.coordinates,
                name: app.player.name,
                picture: app.player.picture,
            }));
        },

        load: function() {
            var persistentData = JSON.parse(localStorage.getItem('data'));
            if (persistentData) {
                app.player.inventory.data = persistentData.inventory;
                app.player.direction = persistentData.direction;
                app.player.coordinates = persistentData.location;
                app.player.name = persistentData.name;
                app.player.picture = persistentData.picture;
                app.chat.message('Client', 'Loaded your saved character', 'client');
                return true;
            }
            return false;
        },

        createNewPlayer: function() {
            app.player.inventory.data = [0, 0, 0, 0, 0, 0, 0, 0, 0];
            app.player.direction = 's';
            app.player.coordinates = {x: 100, y: 100};
            app.player.name = 'Anon' + Math.floor(Math.random() * 8999 + 1000);
            app.player.picture = Math.floor(Math.random() * 15) + 1;
            app.chat.message('Client', 'Creating a character for the first time', 'client');
        },

        destroy: function() {
            app.player = null;
            localStorage.setItem('data', null);
            $(window).unload(function() {
                app.persistence.destroy();
            });
            location.reload(true);
        },

        // save every 3 seconds
        startAutoSave: function() {
            setInterval(function() {
                app.persistence.save();
            }, 3000);

            $(window).unload(function() {
                app.persistence.save();
            });
        }
    },

    players: {
        data: [],

        // Updates a player location, adding if it's a new entry
        update: function(data) {
            var found = false;
            var len = app.players.data.length;
            for (var i=0; i<len; i++) {
                var player = app.players.data[i];
                if (player.session == data.session) {
                    _.extend(
                        player,
                        data
                    );
                    found = true;
                }
            }
            if (!found) {
                app.players.data.push(data);
            }
        },

        remove: function(session) {
            var len = app.players.data.length;
            for (var i=0; i<len; i++) {
                var player = app.players.data[i];
                if (player.session == session) {
                    app.players.data.splice(i, 1);
                    break;
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
                app.chat.message(data.name || 'unknown', "Player Disconnected", 'server');
            });

            socket.on('terraform', function (data) {
                app.environment.map.data[data.x][data.y] = data.tile;
            });

            socket.on('character info', function(data) {
                if (socket.socket.sessionid == data.dession) return;
                app.players.update(data);
            });

            socket.on('event time', function(data) {
                app.environment.daylight.setTime(data.time);
            });

            socket.on('event earthquake', function(data) {
                $.get('/map', function(data) {
                    app.environment.map.data = data;
                });
                app.chat.message('Server', "There has been an earthquake! New Rock and Ore has been added to the world.", 'server');
                app.audio.play('earthquake');
            });

            socket.on('event npcmovement', function(data) {
                app.npc.update(data.npcs);
            });

            socket.on('event corruption', function(data) {
                app.environment.corruption.update(data.map);
            });

            socket.on('event bigterraform', function(data) {
                $.get('/map', function(data) {
                    app.environment.map.data = data;
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
            // Tried using requestAnimationFrame, but that is slow and choppy
            var currentFrame = 0;
            setInterval(function() {
                currentFrame++;
                if (currentFrame % 3 == 0) {
                    currentFrame = 0;
                    // redraw every 150 ms, but change animation every 450 ms
                    app.graphics.globalAnimationFrame = !app.graphics.globalAnimationFrame;
                    app.player.killIfNpcNearby();
                }
                app.environment.map.render(currentFrame === 0);
            }, 150);
        },

        viewport: {
            update: function() {
                app.graphics.viewport.x = app.player.coordinates.x - app.graphics.viewport.PLAYER_OFFSET_LEFT_TILE;
                app.graphics.viewport.y = app.player.coordinates.y - app.graphics.viewport.PLAYER_OFFSET_TOP_TILE;
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

            if (tile == null || isNaN(tile[0])) {
                return;
            }

            app.graphics.handle.drawImage(
                app.graphics.tilesets.terrain,
                0,
                tile[0] * app.graphics.TILE_HEIGHT_PIXEL,
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
                app.graphics.hearts.$holder.html(Array(1+app.player.hearts).join('<div class="heart"></div>'));
            }
        }
    },

    chat: {
        $output: $('#messages'),
        $input: $('#message-input'),

        message: function(who, message, priority) {
            // Hacky code... But it fixes some XSS issues. Encoded data is getting undencoded at some point
            message = message.replace(/&/g, "&amp;").replace(/>/g, "&gt;").replace(/</g, "&lt;").replace(/"/g, "&quot;");
            who = who.replace(/&/g, "&amp;").replace(/>/g, "&gt;").replace(/</g, "&lt;").replace(/"/g, "&quot;");
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
                    app.chat.message('Help', 'Press F to mine the facing object', 'help');
                    app.chat.message('Help', 'Press T or / to enter the chat box', 'help');
                    app.chat.message('Help', 'Press Esc to leave the chat box', 'help');
                    app.chat.message('Help', '-{Commands}------------------------', 'help');
                    app.chat.message('Help', '/nick <em>name</em>: change your name', 'help');
                    app.chat.message('Help', '/pic <em>1-8</em>: change your avatar', 'help');
                    app.chat.message('Help', '/who: get a list of players', 'help');
                    app.chat.message('Help', '/gps: get coordinates', 'help');
                    app.chat.message('Help', '/clear: reset message area', 'help');
                    app.chat.message('Help', '/kill: commit suicide', 'help');
                    return;
                } else if (message.indexOf('/nick ') === 0) {
                    var playerName = message.substr(6);
                    app.player.name = playerName;
                    app.network.send.character(app.player.name, app.player.picture);
                    return;
                } else if (message.indexOf('/pic ') === 0) {
                    var picIndex = parseInt(message.substr(5), 10);
                    if (isNaN(picIndex)) {
                        picIndex = 1;
                    }
                    if (picIndex > 8) {
                        picIndex = 1;
                    }
                    app.player.picture = picIndex;
                    app.network.send.character(app.player.name, app.player.picture);
                    // change picture
                    return;
                } else if (message === '/who') {
                    app.chat.message("Client", "Found " + app.players.data.length + " players", 'client');
                    _.each(app.players.data, function(player) {
                        app.chat.message("Client", player.name, 'client');
                    });
                    return;
                } else if (message === '/kill') {
                    app.player.kill('Committed Suicide');
                        app.network.send.chat("*Committed Suicide*");
                    return;
                } else if (message === '/gps') {
                    app.chat.message("Client", "Coordinates: [" + (app.player.coordinates.x) + "," + (app.player.coordinates.y) + "]", 'client');
                    return;
                } else if (message.indexOf('/tile ') === 0) {
                    var tile = parseInt(message.substr(6), 10);
                    if (isNaN(tile)) {
                        return;
                    }
                    var coords = app.player.getFacingTile().coordinates;
                    app.environment.map.data[coords.x][coords.y][0] = tile;
                    app.network.send.terraform(coords.x, coords.y, tile);
                    return;
                }
                app.chat.message(app.player.name, message, 'self');
                app.network.send.chat(message);
            });

            // Pres Esc inside of text box, leave the text box
            $(document).keyup(function(e) {
                if ($(e.target).is(":input") && e.which == 27) {
                    e.preventDefault();
                    app.chat.$input.blur();
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
app.downloadAssets();
});
