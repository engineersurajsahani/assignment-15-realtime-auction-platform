const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config();

const { registerAuctionHandlers } = require('./sockets/auctionEngine');
const { startAuctionTimers } = require('./sockets/timerManager');

const app = express();
app.use(cors());
app.use(express.static(path.join(__dirname, 'public')));

const server = http.createServer(app);
const io = new Server(server, { cors: { origin: '*' } });

io.on('connection', (socket) => {
  console.log(`New connection: ${socket.id}`);
  registerAuctionHandlers(io, socket);
});

startAuctionTimers(io);

const PORT = process.env.PORT || 5050;
server.listen(PORT, () => console.log(`Server running on port ${PORT}`));