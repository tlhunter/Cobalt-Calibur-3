// Copyright 2011 Thomas Hunter :3
'use strict';

$(function() {
window.app = {
	initialize: function() {
        $.when(
            app.graphics.tilesets.download(
                '/assets/tilesets/inventory.png',
                app.graphics.tilesets.inventory
            ),
            app.graphics.tilesets.download(
                '/assets/tilesets/characters.png',
                app.graphics.tilesets.avatars
            ),
            app.graphics.tilesets.download(
                '/assets/tilesets/terrain.png',
                app.graphics.tilesets.terrain
            ),
            app.environment.downloadTiles(),
            app.environment.downloadMap()
        ).done(function() {
            app.persistence.load() || app.persistence.createNewPlayer();
            app.audio.initialize();
            app.network.bindEvents();
            app.network.connectSocket();
        });
	},

	player: {
		name: '',
		position: {
			coordinates: {
				x: 0,
				y: 0
			},
			direction: 's',
			move: function(direction) {
                var coords = app.player.position.coordinates;
                var dir = app.player.position.direction;
                switch (direction) {
                    case 'n':
                        if (coords.y <= 0 || !app.player.canMoveTo(coords.x, coords.y - 1)) {
                            dir = direction;
                            app.audio.play('move-fail');
                            return false;
                        }
                        coords.y--;
                        break;
                    case 'e':
                        if (coords.x >= app.environment.MAP_WIDTH_TILE - 1 || !app.player.canMoveTo(coords.x + 1, coords.y)) {
                            dir = direction;
                            app.audio.play('move-fail');
                            return false;
                        }
                        coords.x++;
                        break;
                    case 's':
                        if (coords.y >= app.environment.MAP_HEIGHT_TILE - 1 || !app.player.canMoveTo(coords.x, coords.y + 1)) {
                            dir = direction;
                            app.audio.play('move-fail');
                            return false;
                        }
                        coords.y++;
                        break;
                    case 'w':
                        if (coords.x <= 0 || !app.player.canMoveTo(coords.x - 1, coords.y)) {
                            dir = direction;
                            app.audio.play('move-fail');
                            return false;
                        }
                        coords.x--;
                        break;
                    default:
                        return null;
                        break;
                }

                app.player.killIfInCorruption(coords);
                app.graphics.selfAnimationFrame = !app.graphics.selfAnimationFrame;
                app.graphics.updateViewport();

                app.network.send.move(coords.x, coords.y, direction);
			},

			setExactLocation: function(x, y) {
                app.player.position.coordinates.x = x;
                app.player.position.coordinates.y = y;

                app.graphics.updateViewport();

                app.network.send.move(x, y, 's');
			},

			setDirection: function(direction) {
                app.player.position.direction = direction;
			},

            getFacingTile: function() {
                var coords = app.player.position.coordinates;
                var data = {};
                switch(app.player.position.direction) {
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
                        break;
                }

                _.extend(
                    data,
                    app.environment.map.getTileData(data.coordinates.x, data.coordinates.y)
                );

                return data;
            },

            canMoveTo: function(x, y) {
                if (app.environment.map.getTileData(x, y).tile.block_player) {
                    return false;
                }
                return true;
            },

            mineFacingTile: function() {
                var tileData = app.player.getFacingTile();
                var coords = tileData.coordinates;
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
                app.environment.map.data[coords.x][coords.y][0] = becomes;
                app.network.send.terraform(coords.x, coords.y, becomes);
                app.player.inventory.update(provides.id, provides.quantity);
                app.audio.play('mine');
            },

            // Attempts to create and then place the specified tile
            placeItem: function(terrainIndex) {
                var replaceTile = app.player.getFacingTile();
                var coords = replaceTile.coordinates;
                if (!app.god && coords.x >= 96 && coords.x <= 104 && coords.y >= 96 && coords.y <= 104) {
                    app.chat.message('Client', 'You cannot change the spawn location.', 'client');
                    return false;
                }
                if (!replaceTile.tile.replaceable) {
                    app.chat.message('Client', 'This object cannot be built over.', 'client');
                    return false;
                }
                var item = app.environment.tilesets.data.terrain[terrainIndex];
                // provides is also the cost of manufacturing the tile
                if (app.engine.player.inventory.update(item.provides.id, -item.provides.quantity)) {
                    document.getElementById('sound-build').play();
                    app.engine.map.data[coords.x][coords.y][0] = terrainIndex;
                    app.socket.emit('terraform', {
                        x: coords.x,
                        y: coords.y,
                        tile: [terrainIndex, null]
                    });
                        return true;
                } else {
                    app.chat.message('Client', "You don't have the inventory to build this.", 'client');
                    return false;
                }
            },

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
			updateAllCounters: function() {
                var len = app.player.inventory.data.length;
                for (var i = 0; i < len; i++) {
                    $('#inventory-'+i).html(app.player.inventory.data[i]);
                }
			}
		},
		kill: function() {

		},
        killIfInCorruption: function(coords) {
            if (app.environment.map.corruption[coords.x][coords.y]) {
                if (Math.random() < 1/10) {
                    app.player.kill("You were killed by corruption");
                    app.socket.emit('chat', {
                        name: app.engine.player.name,
                        message: "Killed by Corruption",
                        priority: 0
                    });
                }
            }
        }
	},

	players: {
		data: [],
		update: function(data) {

		},
		remove: function(data) {

		},
		drawAll: function() {

		}
	},

	npcs: {
		data: [],
		updateAllData: function(data) {
			app.npcs.data = data;
		},
		drawAll: function() {

		}
	},

	persistence: {
		save: function(data, value) {

		},
		load: function() {

		},
		createNewPlayer: function() {

		}
	},

	graphics: {
		screen: {

		},
		TILE_WIDTH_PIXEL: 16,
        TILE_HEIGHT_PIXEL: 16,

		viewport: {
			WIDTH_PIXEL: 272,
			HEIGHT_PIXEL: 272,

			WIDTH_TILE: 17,
			HEIGHT_TILE: 17,

			PLAYER_OFFSET_LEFT_TILE: 8,
		    PLAYER_OFFSET_TOP_TILE: 8,

			x: null,
			y: null
		},

		tilesets: {
			terrain: new Image(),
			avatars: new Image(),
			inventory: new Image(),

            download: function(url, tileset) {
                var d = $.Deferred();
                tileset.src = url;
                tileset.onload = function() { d.resolve(); }
                tileset.onerror = function() { d.reject(); }
                return d.promise();
            }
		},

		globalAnimationFrame: false,
		selfAnimationFrame: false,

		$canvas: $('canvas#map'),
		context: document.getElementById('map').getContext('2d'),

		updateViewport: function(player_x, player_y) {

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
				app.socket.emit('character info', {
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
				app.socket.emit('character info', {
                    name: name,
                    picture: picture
                });
			}
		},

		bindEvents: function() {
			// setup all of the event bindings
		}
	},

	environment: {
        MAP_WIDTH_TILE: 200,
        MAP_HEIGHT_TILE: 200,

		map: [], // world map
		tiles: [], // tile descriptors
		corruption: [], // corruption map
		corruptionLoaded: false, // bandaid
		time: 8, // current time

		updateTime: function(newTime) {
			app.environment.time = newTime;
			// Set a transparent background color on a layer above the canvas
		},

		updateTile: function(x, y, newTile) {

		},

        // Downloads the map after the app is up and running, usually when big changes occur
		updateMap: function(callback) {
			$.get('/map', function(data) {
                app.environment.map = data;
				if (typeof callback === 'function') {
					callback();
				}
            });
		},

        // Downloads the tiles for the first time, uses promises
        downloadTiles: function() {
            return $.get('/assets/tilesets/data.json').pipe(function(data) {
                app.environment.tiles = data;
                return true;
            });
        },

        // Downloads the map for the first time, uses promises
        downloadMap: function() {
            return $.get('/assets/tilesets/data.json').pipe(function(data) {
                app.engine.tilesets.descriptors = data;
                return true;
            });
        },

		doesLocationBlockPlayer: function(x, y) {

		},

		getLocationData: function(x, y) {

		},

		attemptMineTile: function(x, y) {

		},

		attemptPlaceItem: function(x, y, tile_id) {

		},

		updateCorruption: function(data) {
			app.environment.corruption = data;
			app.environment.corruptionLoaded = true;
		},

		isLocationValid: function(coords) {
			if (coords.x >= 0 && coords.y >= 0 && coords.x < app.environment.MAP_WIDTH_TILE && coords.y < app.environment.MAP_HEIGHT_TILE) {
				return true;
			}
			return false;
		}
	},

	chat: {
		$messageOutput: $('#messages'),
        $messageInput: $('#message-input'),
		message: function(who, message, priority) {

		},
		clear: function() {

		},
		initialize: function() {
			// bindings
		}
	},

	audio: {
		data: {
			'mine': null,
			'mine-fail': null,
			'build': null,
			'build-fail': null,
			'move': null,
			'move-fail': null,
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
				data = document.getElementById('sound-' + key);
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
}.initialize();
}); // dom ready
