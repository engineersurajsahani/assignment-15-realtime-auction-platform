require('dotenv').config();

const path = require('path');
const http = require('http');
const express = require('express');
const cors = require('cors');
const { Server } = require('socket.io');

const { auctions, getAuction, listAuctions, serializeAuction } = require('./data/auctions');
const { handleBidPlacement } = require('./sockets/auctionEngine');
const { startAuctionTimer } = require('./sockets/timerManager');

const PORT = process.env.PORT || 5000;

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Simple REST endpoint to list auctions (handy for debugging / lobby view)
app.get('/api/auctions', (req, res) => {
  res.json(listAuctions());
});

const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: '*' },
});

// Track which socket is in which auction room + their username, so we can
// clean up viewer counts and highest-bidder references on disconnect.
const socketMeta = new Map(); // socketId -> { auctionId, username }

io.on('connection', (socket) => {
  socket.on('auction:join', ({ auctionId, username }) => {
    const auction = getAuction(auctionId);
    if (!auction) {
      return socket.emit('bid:rejected', { reason: 'Auction not found' });
    }

    socket.join(auction.id);
    auction.viewers.add(socket.id);
    socketMeta.set(socket.id, { auctionId: auction.id, username: username || 'Anonymous' });

    // Hydrate the newly joined client with current state
    socket.emit('auction:init', {
      item: serializeAuction(auction),
      bidHistory: auction.bidHistory,
      timeRemaining: auction.timeRemainingSeconds,
    });

    // Let the room know a new viewer joined + updated audience count
    io.to(auction.id).emit('user:joined', {
      username: username || 'Anonymous',
      totalViewers: auction.viewers.size,
    });

    // Kick off the authoritative countdown clock (idempotent if already running)
    if (auction.status === 'active') {
      startAuctionTimer(io, auction);
    }
  });

  socket.on('bid:place', ({ auctionId, amount }) => {
    const auction = getAuction(auctionId);
    const meta = socketMeta.get(socket.id);
    if (!auction || !meta) {
      return socket.emit('bid:rejected', { reason: 'You must join the auction room first' });
    }
    handleBidPlacement(io, socket, auction, Number(amount), meta.username);
  });

  socket.on('disconnect', () => {
    const meta = socketMeta.get(socket.id);
    if (!meta) return;

    const auction = getAuction(meta.auctionId);
    if (auction) {
      auction.viewers.delete(socket.id);
      io.to(auction.id).emit('user:joined', {
        username: meta.username,
        totalViewers: auction.viewers.size,
        left: true,
      });
    }
    socketMeta.delete(socket.id);
  });
});

server.listen(PORT, () => {
  console.log(`🔨 Auction platform running at http://localhost:${PORT}`);
});
