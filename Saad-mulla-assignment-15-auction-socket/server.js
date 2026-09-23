const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const path = require('path');
const dotenv = require('dotenv');

dotenv.config();

const { initializeTimers } = require('./sockets/timerManager');
const { registerAuctionHandlers } = require('./sockets/auctionEngine');

const app = express();
const server = http.createServer(app);

app.use(cors());
app.use(express.static(path.join(__dirname, 'public')));

const io = new Server(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST']
  }
});

// In-Memory Auction Room State
const auctions = {
  "AUC_VINTAGE_99": {
    id: "AUC_VINTAGE_99",
    title: "1967 Vintage Fender Stratocaster",
    description: "Original condition rare electric guitar in Sunburst finish",
    startingPrice: 50000,
    currentBid: 50000,
    highestBidder: null, // { socketId, username }
    minIncrement: 2000,
    timeRemainingSeconds: 60,
    status: "active", // "upcoming", "active", "ended"
    bidHistory: [],
    viewers: new Map() // socketId -> username
  }
};

// Initialize server-side timer loops
initializeTimers(io, auctions);

// Handle WebSocket connections
io.on('connection', (socket) => {
  registerAuctionHandlers(io, socket, auctions);
});

const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
  console.log(`🚀 Live Auction Engine running on http://localhost:${PORT}`);
});
