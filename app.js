var app = require('express').createServer(),
    io = require('socket.io').listen(app);

app.listen(81);

app.get('/', function (req, res) {
    res.sendfile(__dirname + '/index.html');
});

app.get('/assets/*', function (req, res) {
    // is this secure? in PHP land it would be pretty bad
    res.sendfile(__dirname + '/assets/' + req.params[0]);
});

io.sockets.on('connection', function (socket) {
    socket.emit('chat', { username: 'Server', message: 'Socket Connection Established', priority: 'server' });
    socket.on('chat', function (data) {
        socket.broadcast.emit('chat', data);
    });
});
