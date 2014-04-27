var Terrain = function() {
    var self = this;
    self.data = require('../assets/data.json').terrain;
    var map;
    self.synthetics = [];

    for (var k = 0; k < self.data.length; k++) {
        if (self.data[k].synthetic) {
            self.synthetics.push(k);
        }
    }

    self.setMap = function(new_map) {
        map = new_map;
    };
};

module.exports = new Terrain();
