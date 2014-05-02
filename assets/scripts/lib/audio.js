'use strict';

var _ = require('underscore');

var Audio = function() {
  var self = this;

  self.data = {
    'mine': null,
    'mine-fail': null,
    'build': null,
    'build-fail': null,
    'walk': null,
    'walk-fail': null,
    'death': null,
    'earthquake': null,
    'chat': null,
  };

  self.volume = {
    sound: 1.0,
    music: 1.0
  };

  $(function() {
    _.each(self.data, function(data, key) {
      self.data[key] = document.getElementById('sound-' + key);
    });
  });

  // Sets the volume for the type of audio
  self.setVolume = function(type, vol) {
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
  };

  // Plays the specified sound
  self.play = function(name) {
    var sound = null;

    if (_.has(self.data, name)) {
      sound = self.data[name];
      sound.volume = self.volume.sound;
      sound.play();

      return true;
    }

    return false;
  }

};

module.exports = new Audio();
