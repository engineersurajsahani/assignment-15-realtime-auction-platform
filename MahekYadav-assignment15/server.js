require("dotenv").config();

const express = require("express");
const http = require("http");
const cors = require("cors");
const { Server } = require("socket.io");

const auctionEngine = require("./sockets/auctionEngine");
const { startAuctionTimer } = require("./sockets/timerManager");

const app = express();
const server = http.createServer(app);

const PORT = process.env.PORT || 4000;

app.use(cors());
app.use(express.json());
app.use(express.static("public"));

const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

// Helper to define initial auction state
const createInitialAuctionState = () => ({
  id: "AUC_VINTAGE_99",
  title: "1967 Vintage Fender Stratocaster",
  description: "Original condition rare electric guitar",
  startingPrice: 50000,
  currentBid: 50000,
  highestBidder: null,
  minIncrement: 2000,
  timeRemainingSeconds: 300, // Set to 5 minutes (300s) for testing
  status: "active",
  bidHistory: [],
  timerInterval: null,
  viewers: new Map()
});

const auctions = {
  AUC_VINTAGE_99: createInitialAuctionState()
};

app.get("/api/health", (req, res) => {
  res.json({
    success: true,
    message: "Auction server is running",
    status: "active"
  });
});

app.get("/api/auctions", (req, res) => {
  const auctionList = Object.values(auctions).map((auction) => ({
    id: auction.id,
    title: auction.title,
    description: auction.description,
    startingPrice: auction.startingPrice,
    currentBid: auction.currentBid,
    highestBidder: auction.highestBidder
      ? auction.highestBidder.username
      : null,
    minIncrement: auction.minIncrement,
    timeRemainingSeconds: auction.timeRemainingSeconds,
    status: auction.status,
    bidHistory: auction.bidHistory
  }));

  res.json(auctionList);
});

// Development Endpoint: Reset auction back to initial active state
app.post("/api/auctions/:id/reset", (req, res) => {
  const auctionId = req.params.id;
  const auction = auctions[auctionId];

  if (!auction) {
    return res.status(404).json({ success: false, reason: "Auction not found" });
  }

  // Clear existing timer interval if present
  if (auction.timerInterval) {
    clearInterval(auction.timerInterval);
  }

  // Retain connected viewers while resetting state
  const currentViewers = auction.viewers;
  auctions[auctionId] = {
    ...createInitialAuctionState(),
    viewers: currentViewers
  };

  const updatedAuction = auctions[auctionId];

  // Restart timer
  startAuctionTimer(io, updatedAuction);

  // Notify all connected clients in the room
  io.to(auctionId).emit("auction:init", {
    item: {
      id: updatedAuction.id,
      title: updatedAuction.title,
      description: updatedAuction.description,
      startingPrice: updatedAuction.startingPrice,
      currentBid: updatedAuction.currentBid,
      highestBidder: null,
      minIncrement: updatedAuction.minIncrement,
      status: updatedAuction.status
    },
    bidHistory: updatedAuction.bidHistory,
    timeRemaining: updatedAuction.timeRemainingSeconds,
    totalViewers: updatedAuction.viewers.size
  });

  res.json({
    success: true,
    message: "Auction successfully reset",
    timeRemaining: updatedAuction.timeRemainingSeconds
  });
});

io.on("connection", (socket) => {
  console.log(`Client connected: ${socket.id}`);

  socket.on("auction:join", ({ auctionId, username }) => {
    const auction = auctions[auctionId];

    if (!auction) {
      return socket.emit("bid:rejected", {
        reason: "Auction not found"
      });
    }

    if (!username || !username.trim()) {
      return socket.emit("bid:rejected", {
        reason: "Username is required"
      });
    }

    const cleanUsername = username.trim();

    socket.join(auctionId);
    auction.viewers.set(socket.id, cleanUsername);

    // If auction ended or expired before user joined, auto-reset it for testing
    if (auction.status === "closed" || auction.timeRemainingSeconds <= 0) {
      if (auction.timerInterval) {
        clearInterval(auction.timerInterval);
      }
      auction.timeRemainingSeconds = 300;
      auction.status = "active";
      startAuctionTimer(io, auction);
    } else if (!auction.timerInterval) {
      // Lazy-start the timer on first user join
      startAuctionTimer(io, auction);
    }

    socket.emit("auction:init", {
      item: {
        id: auction.id,
        title: auction.title,
        description: auction.description,
        startingPrice: auction.startingPrice,
        currentBid: auction.currentBid,
        highestBidder: auction.highestBidder
          ? auction.highestBidder.username
          : null,
        minIncrement: auction.minIncrement,
        status: auction.status
      },
      bidHistory: auction.bidHistory,
      timeRemaining: auction.timeRemainingSeconds,
      totalViewers: auction.viewers.size
    });

    io.to(auctionId).emit("user:joined", {
      username: cleanUsername,
      totalViewers: auction.viewers.size
    });

    console.log(`\({cleanUsername} joined\){auctionId}`);
  });

  socket.on("bid:place", ({ auctionId, amount }) => {
    const auction = auctions[auctionId];

    if (!auction) {
      return socket.emit("bid:rejected", {
        reason: "Auction not found"
      });
    }

    const username = auction.viewers.get(socket.id);

    if (!username) {
      return socket.emit("bid:rejected", {
        reason: "Join the auction before placing a bid"
      });
    }

    // Safety check for timer expiration
    if (auction.status === "closed" || auction.timeRemainingSeconds <= 0) {
      return socket.emit("bid:rejected", {
        reason: "Auction is closed"
      });
    }

    auctionEngine.handleBidPlacement(
      io,
      socket,
      auction,
      Number(amount),
      username
    );
  });

  socket.on("disconnect", () => {
    Object.values(auctions).forEach((auction) => {
      if (auction.viewers.has(socket.id)) {
        auction.viewers.delete(socket.id);

        io.to(auction.id).emit("user:left", {
          totalViewers: auction.viewers.size
        });
      }
    });

    console.log(`Client disconnected: ${socket.id}`);
  });
});

server.listen(PORT, () => {
  console.log(`Auction server running on port ${PORT}`);
});