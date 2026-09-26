/**
 * server.js
 * Mission-Critical Live Auction Trading Floor Server
 * Node.js + Express + Socket.io with Server-Authoritative State
 */

require('dotenv').config();
const http = require('http');
const path = require('path');
const express = require('express');
const { Server } = require('socket.io');
const cors = require('cors');

const timerManager = require('./sockets/timerManager');
const { handleBidPlacement } = require('./sockets/auctionEngine');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST']
  }
});

const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Master in-memory auction store (keyed by auctionId)
const auctions = new Map();

/**
 * Seed authoritative auction data with 3 luxury showcase lots
 */
function seedAuctions() {
  const initialData = [
    {
      id: 'lot-101',
      lotNumber: 'LOT 42',
      title: "1959 Gibson Les Paul Standard 'Burst'",
      category: 'Vintage Instruments & Provenance',
      description: "One of the most mythical electric guitars in existence. Featuring original PAF humbuckers, flamed bookmatched maple top, and Brazilian rosewood fretboard in immaculate collector condition.",
      currentBid: 250000,
      minIncrement: 5000,
      currentHighestBidder: null,
      currentHighestBidderSocketId: null,
      timeRemainingSeconds: 90,
      status: 'active',
      totalViewers: 0,
      imageUrl: 'https://images.unsplash.com/photo-1516924962500-2b4b3b99ea02?auto=format&fit=crop&w=1200&q=80',
      bidHistory: []
    },
    {
      id: 'lot-102',
      lotNumber: 'LOT 43',
      title: 'Patek Philippe Grandmaster Chime 6300G',
      category: 'Haute Horlogerie & Complications',
      description: 'Double-faced reversible wristwatch in 18k white gold featuring 20 complications, five chiming modes including two patented world premieres, and reversible hand-guilloched dials.',
      currentBid: 4200000,
      minIncrement: 50000,
      currentHighestBidder: null,
      currentHighestBidderSocketId: null,
      timeRemainingSeconds: 120,
      status: 'active',
      totalViewers: 0,
      imageUrl: 'https://images.unsplash.com/photo-1522335789203-aabd1fc54bc9?auto=format&fit=crop&w=1200&q=80',
      bidHistory: []
    },
    {
      id: 'lot-103',
      lotNumber: 'LOT 44',
      title: '1963 Ferrari 250 GTO Scaglietti',
      category: 'Historic Competition Automobiles',
      description: 'The Holy Grail of motoring history. Factory Series I chassis with matching-numbers Colombo 3.0L V12 engine and period competition pedigree at Le Mans and Nürburgring 1000km.',
      currentBid: 48000000,
      minIncrement: 500000,
      currentHighestBidder: null,
      currentHighestBidderSocketId: null,
      timeRemainingSeconds: 150,
      status: 'active',
      totalViewers: 0,
      imageUrl: 'https://images.unsplash.com/photo-1583121274602-3e2820c69888?auto=format&fit=crop&w=1200&q=80',
      bidHistory: []
    }
  ];

  initialData.forEach((item) => {
    auctions.set(item.id, { ...item });
  });
}

seedAuctions();

// Start countdown timers for all active seeded auctions
auctions.forEach((auction) => {
  timerManager.startTimer(io, auction);
});

// REST API for overview & health check
app.get('/api/auctions', (req, res) => {
  const list = Array.from(auctions.values()).map(a => ({
    id: a.id,
    lotNumber: a.lotNumber,
    title: a.title,
    category: a.category,
    currentBid: a.currentBid,
    minIncrement: a.minIncrement,
    currentHighestBidder: a.currentHighestBidder,
    timeRemainingSeconds: a.timeRemainingSeconds,
    status: a.status,
    totalViewers: a.totalViewers,
    bidCount: a.bidHistory.length,
    imageUrl: a.imageUrl
  }));
  res.json({ success: true, auctions: list });
});

// Reset endpoint for testing & live demos
app.post('/api/reset', (req, res) => {
  timerManager.stopAll();
  auctions.clear();
  seedAuctions();
  auctions.forEach(auction => timerManager.startTimer(io, auction));
  io.emit('auction:reset_all', { message: 'All auction rooms re-seeded.' });
  res.json({ success: true, message: 'All auctions reset' });
});

// Socket.io Real-Time Protocol
io.on('connection', (socket) => {
  // 1. Client joins an auction room
  socket.on('auction:join', (payload) => {
    const { auctionId, username } = payload || {};
    const auction = auctions.get(auctionId);

    if (!auction) {
      socket.emit('bid:rejected', {
        auctionId: auctionId || null,
        reason: 'Auction room not found',
        currentBid: 0,
        minIncrement: 0
      });
      return;
    }

    // Leave any previously joined auction room
    if (socket.data.currentAuctionId && socket.data.currentAuctionId !== auctionId) {
      const prevAuctionId = socket.data.currentAuctionId;
      socket.leave(`auction_${prevAuctionId}`);
      const prevAuction = auctions.get(prevAuctionId);
      if (prevAuction) {
        const prevRoom = io.sockets.adapter.rooms.get(`auction_${prevAuctionId}`);
        prevAuction.totalViewers = prevRoom ? prevRoom.size : 0;
        io.to(`auction_${prevAuctionId}`).emit('user:joined', {
          totalViewers: prevAuction.totalViewers,
          username: socket.data.username || 'Anonymous',
          auctionId: prevAuctionId
        });
      }
    }

    // Join new room
    const roomName = `auction_${auctionId}`;
    socket.join(roomName);
    socket.data.currentAuctionId = auctionId;
    socket.data.username = (username && username.trim()) || `Bidder-${socket.id.substring(0, 5)}`;

    // Update viewer count
    const room = io.sockets.adapter.rooms.get(roomName);
    auction.totalViewers = room ? room.size : 1;

    // Send authoritative initial state to the joined client
    socket.emit('auction:init', {
      auction: {
        id: auction.id,
        lotNumber: auction.lotNumber,
        title: auction.title,
        category: auction.category,
        description: auction.description,
        currentBid: auction.currentBid,
        minIncrement: auction.minIncrement,
        currentHighestBidder: auction.currentHighestBidder,
        timeRemainingSeconds: auction.timeRemainingSeconds,
        status: auction.status,
        totalViewers: auction.totalViewers,
        imageUrl: auction.imageUrl,
        bidHistory: auction.bidHistory
      }
    });

    // Broadcast updated viewer count to room
    io.to(roomName).emit('user:joined', {
      totalViewers: auction.totalViewers,
      username: socket.data.username,
      auctionId: auction.id
    });
  });

  // 2. Client places a bid
  socket.on('bid:place', (payload) => {
    handleBidPlacement(io, socket, payload, auctions, timerManager);
  });

  // 3. Client disconnect
  socket.on('disconnect', () => {
    const auctionId = socket.data.currentAuctionId;
    if (auctionId) {
      const auction = auctions.get(auctionId);
      if (auction) {
        const room = io.sockets.adapter.rooms.get(`auction_${auctionId}`);
        auction.totalViewers = room ? room.size : 0;

        io.to(`auction_${auctionId}`).emit('user:joined', {
          totalViewers: auction.totalViewers,
          username: socket.data.username || 'A viewer',
          auctionId: auction.id
        });
      }
    }
  });
});

if (process.env.NODE_ENV !== 'test') {
  server.listen(PORT, () => {
    console.log(`[LIVE FLOOR] Trading floor server listening on port ${PORT}`);
    console.log(`[LIVE FLOOR] Seeded ${auctions.size} authoritative auction lots`);
  });

  const cleanup = () => {
    timerManager.stopAll();
    server.close(() => {
      process.exit(0);
    });
  };

  process.on('SIGINT', cleanup);
  process.on('SIGTERM', cleanup);
}

module.exports = { app, server, io, auctions, timerManager };

