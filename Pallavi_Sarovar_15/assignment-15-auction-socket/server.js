require("dotenv").config();

const express = require("express");
const http = require("http");
const cors = require("cors");
const path = require("path");
const { Server } = require("socket.io");
const { createAuction, startTimer, stopTimer, handleBidPlacement } = require("./sockets/auctionEngine");

const app = express();
const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

const PORT = Number(process.env.PORT) || 5000;
const auction = createAuction();

startTimer(io, auction);

app.get("/api/health", (_req, res) => {
  res.json({
    status: "ok",
    service: "Real-Time Live Auction & Bidding Engine",
    auctionId: auction.id,
    auctionStatus: auction.status
  });
});

app.get("/api/auction", (_req, res) => {
  res.json({
    item: {
      id: auction.id,
      title: auction.title,
      description: auction.description,
      startingPrice: auction.startingPrice,
      currentBid: auction.currentBid,
      minIncrement: auction.minIncrement,
      status: auction.status
    },
    highestBidder: auction.highestBidder
      ? { username: auction.highestBidder.username }
      : null,
    bidHistory: auction.bidHistory,
    timeRemaining: auction.timeRemainingSeconds,
    totalViewers: auction.viewers.size
  });
});

app.get("*", (_req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

io.on("connection", (socket) => {
  socket.on("auction:join", ({ auctionId, username } = {}) => {
    const cleanUsername = String(username || "").trim().slice(0, 24);

    if (!cleanUsername) {
      socket.emit("auction:error", { message: "Please enter a username." });
      return;
    }

    if (auctionId !== auction.id) {
      socket.emit("auction:error", { message: "Auction room not found." });
      return;
    }

    if (socket.data.auctionJoined) {
      auction.viewers.delete(socket.id);
      socket.leave(auction.id);
    }

    socket.join(auction.id);
    socket.data.auctionJoined = true;
    socket.data.username = cleanUsername;
    auction.viewers.set(socket.id, cleanUsername);

    socket.emit("auction:init", {
      item: {
        id: auction.id,
        title: auction.title,
        description: auction.description,
        startingPrice: auction.startingPrice,
        currentBid: auction.currentBid,
        minIncrement: auction.minIncrement,
        status: auction.status
      },
      highestBidder: auction.highestBidder
        ? { username: auction.highestBidder.username }
        : null,
      bidHistory: auction.bidHistory,
      timeRemaining: auction.timeRemainingSeconds,
      totalViewers: auction.viewers.size
    });

    io.to(auction.id).emit("user:joined", {
      username: cleanUsername,
      totalViewers: auction.viewers.size
    });
  });

  socket.on("bid:place", ({ auctionId, amount } = {}) => {
    if (!socket.data.auctionJoined) {
      socket.emit("bid:rejected", { reason: "Join the auction before placing a bid." });
      return;
    }

    if (auctionId !== auction.id) {
      socket.emit("bid:rejected", { reason: "Auction room not found." });
      return;
    }

    handleBidPlacement(io, socket, auction, amount, socket.data.username);
  });

  socket.on("disconnect", () => {
    if (auction.viewers.delete(socket.id)) {
      io.to(auction.id).emit("viewer:update", {
        totalViewers: auction.viewers.size
      });
    }
  });
});

server.listen(PORT, () => {
  console.log(`Auction server running on http://localhost:${PORT}`);
});

process.on("SIGINT", () => {
  stopTimer(auction);
  server.close(() => process.exit(0));
});
