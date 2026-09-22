// sockets/auctionEngine.js
const { startTimer, stopTimer } = require("./timerManager");

// In-Memory Auction Room State (per the assignment's data model)
const auctions = {
  AUC_VINTAGE_99: {
    id: "AUC_VINTAGE_99",
    title: "1987 Ferrari F40",
    description: "Beautiful vintage car in mint condition",
    startingPrice: 20000000,
    currentBid: 20000000,
    highestBidder: null, // { socketId, username }
    minIncrement: 1000000,
    timeRemainingSeconds: 60,
    status: "active", // "upcoming" | "active" | "ended"
    bidHistory: [],
    timerInterval: null,
    viewers: new Set(),
  },
};

function endAuction(io, auction) {
  auction.status = "ended";
  stopTimer(auction);

  io.to(auction.id).emit("auction:sold", {
    winner: auction.highestBidder ? auction.highestBidder.username : null,
    finalPrice: auction.currentBid,
    status: "sold",
  });
}

function handleBidPlacement(io, socket, auction, bidAmount, username) {
  // 1. Check if auction is active
  if (auction.status !== "active" || auction.timeRemainingSeconds <= 0) {
    return socket.emit("bid:rejected", { reason: "Auction is closed" });
  }

  // 2. Check if bidder is already the highest bidder
  if (auction.highestBidder && auction.highestBidder.socketId === socket.id) {
    return socket.emit("bid:rejected", { reason: "You are already the highest bidder" });
  }

  // 3. Check minimum increment
  const minimumRequired = auction.currentBid + auction.minIncrement;
  if (bidAmount < minimumRequired) {
    return socket.emit("bid:rejected", {
      reason: `Bid too low. Minimum valid bid is ₹${minimumRequired}`,
    });
  }

  // 4. Capture previous highest bidder to notify outbid
  const previousBidder = auction.highestBidder;

  // 5. Update state
  auction.currentBid = bidAmount;
  auction.highestBidder = { socketId: socket.id, username };
  auction.bidHistory.unshift({
    bidder: username,
    amount: bidAmount,
    timestamp: new Date().toLocaleTimeString(),
  });

  // 6. Anti-Snipe Rule: bid placed within last 15s -> extend timer to 20s
  if (auction.timeRemainingSeconds < 15) {
    auction.timeRemainingSeconds = 20;
    io.to(auction.id).emit("auction:extended", {
      timeRemaining: 20,
      message: "Bid in final seconds: Timer extended by 20s!",
    });
  }

  // 7. Broadcast new top bid to room
  io.to(auction.id).emit("bid:success", {
    newBid: auction.currentBid,
    highestBidder: username,
    bidHistory: auction.bidHistory,
    timeRemaining: auction.timeRemainingSeconds,
  });

  // 8. Send private alert to outbid user
  if (previousBidder && previousBidder.socketId !== socket.id) {
    io.to(previousBidder.socketId).emit("bid:outbid", {
      message: `You were outbid by ${username} with ₹${bidAmount}!`,
    });
  }
}

function registerAuctionHandlers(io, socket) {
  socket.on("auction:join", ({ auctionId, username }) => {
    const auction = auctions[auctionId];
    if (!auction) {
      socket.emit("bid:rejected", { reason: "Auction not found" });
      return;
    }

    socket.join(auction.id);
    socket.data.auctionId = auction.id;
    socket.data.username = username || "Bidder";
    auction.viewers.add(socket.id);

    // Start the countdown once the room is live and not already ticking
    if (auction.status === "active" && !auction.timerInterval) {
      startTimer(io, auction, (endedAuction) => endAuction(io, endedAuction));
    }

    socket.emit("auction:init", {
      item: {
        id: auction.id,
        title: auction.title,
        description: auction.description,
        startingPrice: auction.startingPrice,
        currentBid: auction.currentBid,
        minIncrement: auction.minIncrement,
        status: auction.status,
        highestBidder: auction.highestBidder ? auction.highestBidder.username : null,
      },
      bidHistory: auction.bidHistory,
      timeRemaining: auction.timeRemainingSeconds,
    });

    io.to(auction.id).emit("user:joined", {
      username: socket.data.username,
      totalViewers: auction.viewers.size,
    });
  });

  socket.on("bid:place", ({ auctionId, amount }) => {
    const auction = auctions[auctionId];
    if (!auction) return;
    handleBidPlacement(io, socket, auction, amount, socket.data.username);
  });

  socket.on("disconnect", () => {
    const auctionId = socket.data.auctionId;
    if (!auctionId || !auctions[auctionId]) return;
    auctions[auctionId].viewers.delete(socket.id);
  });
}

module.exports = { registerAuctionHandlers, auctions };
