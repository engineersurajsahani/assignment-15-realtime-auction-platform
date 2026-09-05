const express = require('express');
const http = require('http');
const path = require('path');
const cors = require('cors');
const dotenv = require('dotenv');
const { Server } = require('socket.io');

const { initAuctions, registerAuctionHandlers, auctions } = require('./sockets/auctionEngine');

dotenv.config();

const app = express();
const server = http.createServer(app);

// Configure Socket.io with permissive CORS
const io = new Server(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST']
  }
});

app.use(cors());
app.use(express.json());

// Serve static frontend assets
app.use(express.static(path.join(__dirname, 'public')));

// Health & Status API
app.get('/api/health', (req, res) => {
  res.status(200).json({
    success: true,
    message: '🔨 Real-Time Live Auction & Bidding Engine is fully operational',
    activeAuctionsCount: Object.keys(auctions).length,
    timestamp: new Date().toISOString()
  });
});

// REST API to list active auctions
app.get('/api/auctions', (req, res) => {
  const list = Object.values(auctions).map(a => ({
    id: a.id,
    title: a.title,
    category: a.category,
    image: a.image,
    description: a.description,
    currentBid: a.currentBid,
    minIncrement: a.minIncrement,
    highestBidder: a.highestBidder ? a.highestBidder.username : null,
    timeRemainingSeconds: a.timeRemainingSeconds,
    status: a.status
  }));
  res.status(200).json({ success: true, count: list.length, data: list });
});

// Socket connection pipeline
io.on('connection', (socket) => {
  console.log(`⚡ Trading Floor Client connected: ${socket.id}`);
  registerAuctionHandlers(io, socket);
});

// Initialize server-side auction engines & timers
initAuctions(io);

const PORT = process.env.PORT || 5000;

server.listen(PORT, () => {
  console.log(`🚀 Live Auction Server running at http://localhost:${PORT}`);
  console.log(`🔨 Trading Floor UI: http://localhost:${PORT}/index.html`);
});

module.exports = { app, server, io };
