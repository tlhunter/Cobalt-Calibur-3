var colors = require('colors');

var Logger = function() {
    var self = this;

    function logger(title, message) {
        while (title.length < 26) {
            title = title + ' ';
        }
        console.log(title + message);
    }

    self.error = function(title, message) {
        logger(title.red, message);
    };

    self.info = function(title, message) {
        logger(title.blue, message);
    };

    self.debug = function(title, message) {
        logger(title.grey, message);
    };

    self.success = function(title, message) {
        logger(title.green, message);
    };

    self.notice = function(title, message) {
        logger(title.magenta, message);
    };

    self.action = function(title, message) {
        logger(title.cyan, message);
    };
};

module.exports = new Logger();
