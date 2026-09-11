const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const cors = require("cors");
const path = require("path");

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: "*" } });

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

const auctions = {
  AUC_VINTAGE_99: {
    id: "AUC_VINTAGE_99",
    title: "1967 Vintage Fender Stratocaster",
    description: "Original condition rare electric guitar",
    startingPrice: 50000,
    currentBid: 50000,
    highestBidder: null,
    minIncrement: 2000,
    timeRemainingSeconds: 60,
    status: "active",
    bidHistory: []
  }
};

function resetAuction(auction) {
  auction.currentBid = auction.startingPrice;
  auction.highestBidder = null;
  auction.timeRemainingSeconds = 60;
  auction.status = "active";
  auction.bidHistory = [];
}

function emitState(auction) {
  io.to(auction.id).emit("auction:init", {
    item: auction,
    bidHistory: auction.bidHistory,
    timeRemaining: auction.timeRemainingSeconds
  });
}

io.on("connection", socket => {
socket.on("auction:join", ({ auctionId, username }) => {
  const auction = auctions[auctionId];

  if (!auction) {
    return socket.emit("bid:rejected", {
      reason: "Auction not found"
    });
  }

  socket.data.username = username || "Guest";
  socket.data.auctionId = auctionId;

  socket.join(auctionId);

  // If previous auction has ended, start a fresh auction
  if (auction.status === "ended") {
    resetAuction(auction);
  }

  emitState(auction);

  const room = io.sockets.adapter.rooms.get(auctionId);

  io.to(auctionId).emit("user:joined", {
    username: socket.data.username,
    totalViewers: room ? room.size : 1
  });
});

  socket.on("bid:place", ({ auctionId, amount }) => {
    const auction = auctions[auctionId];
    const username = socket.data.username || "Guest";
    const bidAmount = Number(amount);

    if (!auction || auction.status !== "active" || auction.timeRemainingSeconds <= 0)
      return socket.emit("bid:rejected", { reason: "Auction is closed" });

    if (auction.highestBidder && auction.highestBidder.socketId === socket.id)
      return socket.emit("bid:rejected", { reason: "You are already the highest bidder" });

    const minimumRequired = auction.currentBid + auction.minIncrement;
    if (!Number.isFinite(bidAmount) || bidAmount < minimumRequired)
      return socket.emit("bid:rejected", { reason: `Bid too low. Minimum valid bid is ₹${minimumRequired.toLocaleString("en-IN")}` });

    const previousBidder = auction.highestBidder;
    auction.currentBid = bidAmount;
    auction.highestBidder = { socketId: socket.id, username };
    auction.bidHistory.unshift({
      bidder: username,
      amount: bidAmount,
      timestamp: new Date().toLocaleTimeString()
    });

    if (auction.timeRemainingSeconds < 15) {
      auction.timeRemainingSeconds = 20;
      io.to(auction.id).emit("auction:extended", {
        timeRemaining: 20,
        message: "Anti-snipe triggered: +20 seconds added!"
      });
    }

    io.to(auction.id).emit("bid:success", {
      currentBid: auction.currentBid,
      highestBidder: username,
      bidHistory: auction.bidHistory,
      timeRemaining: auction.timeRemainingSeconds
    });

    if (previousBidder && previousBidder.socketId !== socket.id)
      io.to(previousBidder.socketId).emit("bid:outbid", {
        message: `You were outbid by ${username} with ₹${bidAmount.toLocaleString("en-IN")}!`
      });
  });

  socket.on("disconnect", () => {
    const auctionId = socket.data.auctionId;
    if (auctionId) {
      const room = io.sockets.adapter.rooms.get(auctionId);
      io.to(auctionId).emit("user:joined", {
        username: socket.data.username || "Guest",
        totalViewers: room ? room.size : 0
      });
    }
  });
});

setInterval(() => {
  Object.values(auctions).forEach(auction => {
    if (auction.status !== "active") return;
    auction.timeRemainingSeconds--;
    io.to(auction.id).emit("auction:time_tick", {
      auctionId: auction.id,
      timeRemaining: auction.timeRemainingSeconds
    });

    if (auction.timeRemainingSeconds <= 0) {
      auction.timeRemainingSeconds = 0;
      auction.status = "ended";
      io.to(auction.id).emit("auction:sold", {
        winner: auction.highestBidder?.username || null,
        finalPrice: auction.currentBid,
        status: "sold"
      });
    }
  });
}, 1000);

app.get("/api/auction/:id", (req, res) => {
  const auction = auctions[req.params.id];
  if (!auction) return res.status(404).json({ error: "Auction not found" });
  res.json(auction);
});

app.get("*", (_, res) => res.sendFile(path.join(__dirname, "public", "index.html")));

server.listen(process.env.PORT || 5000, () =>
  console.log(`Pulse Auction running on http://localhost:${process.env.PORT || 5000}`)
);