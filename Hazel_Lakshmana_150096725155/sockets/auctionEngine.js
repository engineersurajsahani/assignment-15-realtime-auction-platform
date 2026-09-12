const { v4: uuidv4 } = require("uuid");

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
    bidHistory: [],
    viewers: new Map(),
    timerInterval: null
  }
};

function publicAuction(auction) {
  return {
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
    bidHistory: auction.bidHistory,
    totalViewers: auction.viewers.size
  };
}

function setupAuctionEngine(io, socket) {
  socket.on("auction:join", ({ auctionId, username }) => {
    const auction = auctions[auctionId];

    if (!auction) {
      return socket.emit("bid:rejected", { reason: "Auction not found" });
    }

    const cleanUsername = String(username || "").trim();

    if (!cleanUsername) {
      return socket.emit("bid:rejected", { reason: "Username is required" });
    }

    socket.join(auctionId);
    auction.viewers.set(socket.id, cleanUsername);
    socket.data.auctionId = auctionId;
    socket.data.username = cleanUsername;

    socket.emit("auction:init", {
      item: publicAuction(auction),
      bidHistory: auction.bidHistory,
      timeRemaining: auction.timeRemainingSeconds
    });

    io.to(auctionId).emit("user:joined", {
      username: cleanUsername,
      totalViewers: auction.viewers.size
    });
  });

  socket.on("bid:place", ({ auctionId, amount }) => {
    const auction = auctions[auctionId];

    if (!auction) {
      return socket.emit("bid:rejected", { reason: "Auction not found" });
    }

    const username = socket.data.username;

    if (!username || !auction.viewers.has(socket.id)) {
      return socket.emit("bid:rejected", {
        reason: "Join the auction before bidding"
      });
    }

    handleBidPlacement(io, socket, auction, Number(amount), username);
  });

  socket.on("disconnect", () => {
    const auctionId = socket.data.auctionId;

    if (!auctionId || !auctions[auctionId]) {
      return;
    }

    const auction = auctions[auctionId];
    auction.viewers.delete(socket.id);

    io.to(auctionId).emit("user:joined", {
      username: socket.data.username || "User",
      totalViewers: auction.viewers.size
    });
  });
}

function handleBidPlacement(io, socket, auction, bidAmount, username) {
  if (auction.status !== "active" || auction.timeRemainingSeconds <= 0) {
    return socket.emit("bid:rejected", {
      reason: "Auction is closed"
    });
  }

  if (!Number.isFinite(bidAmount) || bidAmount <= 0) {
    return socket.emit("bid:rejected", {
      reason: "Enter a valid bid amount"
    });
  }

  if (
    auction.highestBidder &&
    auction.highestBidder.socketId === socket.id
  ) {
    return socket.emit("bid:rejected", {
      reason: "You are already the highest bidder"
    });
  }

  const minimumRequired = auction.currentBid + auction.minIncrement;

  if (bidAmount < minimumRequired) {
    return socket.emit("bid:rejected", {
      reason: `Bid too low. Minimum valid bid is ₹${minimumRequired}`
    });
  }

  const previousBidder = auction.highestBidder;

  auction.currentBid = bidAmount;
  auction.highestBidder = {
    socketId: socket.id,
    username
  };

  auction.bidHistory.unshift({
    id: uuidv4(),
    bidder: username,
    amount: bidAmount,
    timestamp: new Date().toLocaleTimeString()
  });

  if (auction.timeRemainingSeconds < 15) {
    auction.timeRemainingSeconds = 20;

    io.to(auction.id).emit("auction:extended", {
      timeRemaining: 20,
      message: "Bid in final seconds: Timer extended by 20s!"
    });
  }

  io.to(auction.id).emit("bid:success", {
    newBid: auction.currentBid,
    currentBid: auction.currentBid,
    highestBidder: username,
    bidHistory: auction.bidHistory,
    timeRemaining: auction.timeRemainingSeconds
  });

  if (previousBidder && previousBidder.socketId !== socket.id) {
    io.to(previousBidder.socketId).emit("bid:outbid", {
      message: `You were outbid by ${username} with ₹${bidAmount}!`
    });
  }
}

module.exports = {
  auctions,
  setupAuctionEngine,
  handleBidPlacement,
  publicAuction
};