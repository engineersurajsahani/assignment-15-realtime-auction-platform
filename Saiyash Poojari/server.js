const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const cors = require("cors");
const path = require("path");
require("dotenv").config();

const { initializeAuctionEngine, auctions } = require("./sockets/auctionEngine");

const app = express();
const server = http.createServer(app);

app.use(cors());
app.use(express.json());

app.use(express.static(path.join(__dirname, "public")));

app.get("/api/auctions", (req, res) => {
  const catalog = Object.values(auctions).map(a => ({
    id: a.id,
    title: a.title,
    category: a.category,
    description: a.description,
    startingPrice: a.startingPrice,
    currentBid: a.currentBid,
    highestBidder: a.highestBidder ? a.highestBidder.username : null,
    minIncrement: a.minIncrement,
    timeRemainingSeconds: a.timeRemainingSeconds,
    status: a.status,
    bidHistoryCount: a.bidHistory.length,
    imageUrl: a.imageUrl
  }));
  res.json({ success: true, count: catalog.length, auctions: catalog });
});

const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

initializeAuctionEngine(io);

const PORT = process.env.PORT || 5005;

server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
