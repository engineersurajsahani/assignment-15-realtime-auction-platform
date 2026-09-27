const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const dotenv = require('dotenv');

dotenv.config();

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: '*' } });

app.use(cors());
app.use(express.static('public'));

const { auctions, getAuctionSafe } = require('./sockets/auctionStore');
const { handleBidPlacement } = require('./sockets/auctionEngine');
const { startAuctionTimer } = require('./sockets/timerManager');

// Start default auction timer
startAuctionTimer(io, 'AUC_VINTAGE_99');

io.on('connection', (socket) => {
  let currentUser = { username: null, auctionId: null };

  socket.on('auction:join', ({ auctionId, username }) => {
    const auction = auctions[auctionId];
    if (!auction) return socket.emit('error', 'Auction not found');

    socket.join(auctionId);
    currentUser = { username, auctionId };
    
    auction.viewers.add(socket.id);

    socket.emit('auction:init', {
      item: getAuctionSafe(auctionId),
      bidHistory: auction.bidHistory,
      timeRemaining: auction.timeRemainingSeconds
    });

    io.to(auctionId).emit('user:joined', {
      username,
      totalViewers: auction.viewers.size
    });
  });

  socket.on('bid:place', ({ auctionId, amount }) => {
    handleBidPlacement(io, socket, auctionId, Number(amount), currentUser.username);
  });

  socket.on('disconnect', () => {
    const { auctionId } = currentUser;
    if (auctionId && auctions[auctionId]) {
      auctions[auctionId].viewers.delete(socket.id);
      io.to(auctionId).emit('user:left', {
        username: currentUser.username,
        totalViewers: auctions[auctionId].viewers.size
      });
    }
  });
});

const PORT = process.env.PORT || 5000;
server.listen(PORT, () => console.log(`Server listening on port ${PORT}`));
