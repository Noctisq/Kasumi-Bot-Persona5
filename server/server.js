const musicList = require('./routes/musicList');
const cors = require("cors");
const express = require('express');
const app = express();
const http = require('http');
const server = http.createServer(app);
const { Server } = require("socket.io");

app.use(cors());
app.use('/music', musicList);

const io = new Server(server, {
	cors: {
    origin: "http://localhost:3001",
    methods: ["GET", "POST", "PUT", "DELETE"]
}});


const musicHandler = require("./socketHandlers/musicHandler");
const onConnection = (socket) => {
    musicHandler(io, socket)
};
  

io.on('connection',onConnection);

server.listen(3000, () => {
  console.log('listening on *:3000');
});