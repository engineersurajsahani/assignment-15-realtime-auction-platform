const express = require("express");
const http = require("http");
const path = require("path");
const cors = require("cors");
const { Server } = require("socket.io");

require("dotenv").config();

const connectDB = require("./config/db");
const Bid = require("./models/Bid");
const Auction = require("./models/Auction");
const { setupAuctionSockets, auctions } = require("./sockets/auctionEngine");

const app = express();
const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"],
  },
  maxHttpBufferSize: 1e6,
});

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

const publicAuction = (auction) => ({
  id: auction.id,
  title: auction.title,
  description: auction.description,
  image: auction.image,
  startingPrice: auction.startingPrice,
  currentBid: auction.currentBid,
  highestBidder: auction.highestBidder ? auction.highestBidder.username : null,
  minIncrement: auction.minIncrement,
  timeRemaining: auction.timeRemainingSeconds,
  status: auction.status,
  bids: auction.bidHistory.length,
});

app.get("/api/health", (req, res) => {
  res.json({
    status: "ok",
    activeAuctions: Object.values(auctions)
      .filter((a) => a.status === "active")
      .map((a) => a.id),
    db: Boolean(Auction.db.readyState === 1),
  });
});

app.get("/api/auctions", (req, res) => {
  res.json({
    auctions: Object.values(auctions).map(publicAuction),
  });
});

app.get("/api/auctions/:id", (req, res) => {
  const auction = auctions[req.params.id];
  if (!auction) return res.status(404).json({ error: "Auction not found" });
  res.json({ item: publicAuction(auction), bidHistory: auction.bidHistory });
});

app.get("/api/auctions/:id/bids", async (req, res) => {
  try {
    const bids = await Bid.find({ auctionId: req.params.id })
      .sort({ _id: -1 })
      .limit(100);
    res.json({ auctionId: req.params.id, bids });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get("/api/auctions/:id/result", async (req, res) => {
  try {
    const result = await Auction.findOne({ auctionId: req.params.id });
    if (!result) return res.json({ auctionId: req.params.id, status: "not_ended" });
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

const start = async () => {
  if (process.env.MONGO_URI) {
    await connectDB();
  } else {
    console.warn("Warning: MONGO_URI is not set — auction audit log kept in memory only.");
  }

  io.on("connection", (socket) => {
    console.log(`user:connect ${socket.id}`);
    setupAuctionSockets(io, socket);
  });

  // macOS: AirPlay occupies port 5000, so the default is 5001
  const PORT = process.env.PORT || 5001;
  server.listen(PORT, () => {
    console.log(`\nAuction server running at http://localhost:${PORT}`);
    console.log(`Open multiple tabs at http://localhost:${PORT} to test bidding, outbid alerts & anti-snipe\n`);
  });

  const shutdown = () => {
    console.log("\nShutting down... clearing auction timers.");
    Object.values(auctions).forEach((auction) => {
      if (auction.timerInterval) clearInterval(auction.timerInterval);
    });
    server.close(() => process.exit(0));
    setTimeout(() => process.exit(0), 3000).unref();
  };
  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
};

start().catch((error) => {
  console.error("Failed to start server:", error);
  process.exit(1);
});