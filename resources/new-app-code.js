// Copyright 2011 Thomas Hunter :3
'use strict';

$(function() {
window.app = {
	initialize: function() {
		// Setup a promise thingy
		// http://jsfiddle.net/jfromaniello/FPqc4/7/light/
		// Download all of the assets
		// app.persistance.load() || app.persistance.createNewPlayer()
		// app.network.bindEvents()
		// app.audio.initialize();
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
			
			},
			setExactLocation: function(x, y) {
				
			},
			setDirection: function(direction) {
				
			}
		},
		inventory: {
			data: [],
			update: function(item, amount) {
				
			},
			updatCounter: function(item) {
				
			},
			updateAllCounters: function() {
			
			}
		},
		kill: function() {
			
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
		
		updateMap: function(callback) {
			$.get('/map', function(data) {
                app.environment.map = data;
				if (typeof callback === 'function') {
					callback();
				}
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