var app = require('express').createServer(),
    io = require('socket.io').listen(app);

app.listen(81);

app.get('/', function (req, res) {
  res.sendfile(__dirname + '/index.html');
});

io.sockets.on('connection', function (socket) {
  socket.emit('chat', { username: 'System', message: 'Initialized' });
  socket.on('chat', function (data) {
    console.log(data);
    socket.broadcast.emit('chat', data);
  });
});
