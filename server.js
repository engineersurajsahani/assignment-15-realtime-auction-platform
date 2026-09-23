const express = require("express");
const http = require("http");
const cors = require("cors");
const dotenv = require("dotenv");
const path = require("path");
const { Server } = require("socket.io");

const {
  auctions,
  registerAuctionHandlers
} = require("./sockets/auctionEngine");

const {
  startAuctionTimer
} = require("./sockets/timerManager");

dotenv.config();

const app = express();
const server = http.createServer(app);

const PORT = process.env.PORT || 5050;

// Middleware
app.use(cors());
app.use(express.json());

// Serve frontend
app.use(express.static(path.join(__dirname, "public")));

// Socket.io
const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

// Basic API route
app.get("/api/auctions", (req, res) => {
  const auctionList = Object.values(auctions).map((auction) => ({
    id: auction.id,
    title: auction.title,
    description: auction.description,
    startingPrice: auction.startingPrice,
    currentBid: auction.currentBid,
    highestBidder: auction.highestBidder,
    minIncrement: auction.minIncrement,
    timeRemaining: auction.timeRemainingSeconds,
    status: auction.status
  }));

  res.json(auctionList);
});

// Socket connection
io.on("connection", (socket) => {
  console.log(`User connected: ${socket.id}`);

  registerAuctionHandlers(io, socket);

  socket.on("disconnect", () => {
    console.log(`User disconnected: ${socket.id}`);
  });
});

// Start timers for all active auctions
Object.values(auctions).forEach((auction) => {
  if (auction.status === "active") {
    startAuctionTimer(io, auction);
  }
});

// Start server
server.listen(PORT, () => {
  console.log(`🚀 Auction server running on http://localhost:${PORT}`);
});