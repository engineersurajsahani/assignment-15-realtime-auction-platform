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
    timerInterval: null,
    viewers: new Map()
  }
};

// Handle a user joining an auction
function joinAuction(io, socket, data) {
  const { auctionId, username } = data;

  const auction = auctions[auctionId];

  if (!auction) {
    socket.emit("bid:rejected", {
      reason: "Auction not found."
    });
    return;
  }

  if (!username || username.trim() === "") {
    socket.emit("bid:rejected", {
      reason: "Username is required."
    });
    return;
  }

  // Join Socket.io room
  socket.join(auctionId);

  // Store user information on socket
  socket.data.username = username.trim();
  socket.data.auctionId = auctionId;

  // Add viewer
  auction.viewers.set(socket.id, username.trim());

  // Send auction information to the joining user
  socket.emit("auction:init", {
    item: {
      id: auction.id,
      title: auction.title,
      description: auction.description,
      startingPrice: auction.startingPrice,
      currentBid: auction.currentBid,
      highestBidder: auction.highestBidder,
      minIncrement: auction.minIncrement,
      status: auction.status
    },
    bidHistory: auction.bidHistory,
    timeRemaining: auction.timeRemainingSeconds
  });

  // Send current timer immediately
  socket.emit("auction:time_tick", {
    auctionId,
    timeRemaining: auction.timeRemainingSeconds
  });

  // Notify everyone in the auction room
  io.to(auctionId).emit("user:joined", {
    username: username.trim(),
    totalViewers: auction.viewers.size
  });
}


// Handle a bid
function placeBid(io, socket, data) {
  const { auctionId, amount } = data;

  const auction = auctions[auctionId];

  if (!auction) {
    socket.emit("bid:rejected", {
      reason: "Auction not found."
    });
    return;
  }

  const username = socket.data.username;

  if (!username) {
    socket.emit("bid:rejected", {
      reason: "Please join the auction before placing a bid."
    });
    return;
  }

  // Check auction status
  if (
    auction.status !== "active" ||
    auction.timeRemainingSeconds <= 0
  ) {
    socket.emit("bid:rejected", {
      reason: "This auction has ended."
    });
    return;
  }

  // Prevent bidder from outbidding themselves
  if (
    auction.highestBidder &&
    auction.highestBidder.socketId === socket.id
  ) {
    socket.emit("bid:rejected", {
      reason: "You are already the highest bidder."
    });
    return;
  }

  const bidAmount = Number(amount);

  if (!Number.isFinite(bidAmount)) {
    socket.emit("bid:rejected", {
      reason: "Invalid bid amount."
    });
    return;
  }

  // Minimum required bid
  const minimumRequired =
    auction.currentBid + auction.minIncrement;

  if (bidAmount < minimumRequired) {
    socket.emit("bid:rejected", {
      reason: `Minimum bid is ₹${minimumRequired}.`
    });
    return;
  }

  // Store previous highest bidder
  const previousHighestBidder = auction.highestBidder;

  // Update auction
  auction.currentBid = bidAmount;

  auction.highestBidder = {
    socketId: socket.id,
    username
  };

  // Add bid to history
  auction.bidHistory.unshift({
    bidder: username,
    amount: bidAmount,
    timestamp: new Date().toISOString()
  });

  // Anti-snipe protection
  let extended = false;

  if (auction.timeRemainingSeconds < 15) {
    auction.timeRemainingSeconds = 20;
    extended = true;
  }

  // Send successful bid to everyone
  io.to(auctionId).emit("bid:success", {
    newBid: auction.currentBid,
    highestBidder: auction.highestBidder,
    timeRemaining: auction.timeRemainingSeconds,
    bidHistory: auction.bidHistory
  });

  // Send outbid notification to previous bidder
  if (
    previousHighestBidder &&
    previousHighestBidder.socketId !== socket.id
  ) {
    io.to(previousHighestBidder.socketId).emit("bid:outbid", {
      message: `${username} outbid you with a bid of ₹${bidAmount}.`
    });
  }

  // Notify everyone about anti-snipe extension
  if (extended) {
    io.to(auctionId).emit("auction:extended", {
      message: "New bid received! Auction extended to 20 seconds.",
      timeRemaining: 20
    });
  }
}


// Handle user leaving/disconnecting
function handleDisconnect(io, socket) {
  const auctionId = socket.data.auctionId;

  if (!auctionId) {
    return;
  }

  const auction = auctions[auctionId];

  if (!auction) {
    return;
  }

  auction.viewers.delete(socket.id);

  io.to(auctionId).emit("user:joined", {
    username: socket.data.username || "User",
    totalViewers: auction.viewers.size
  });
}


// Register auction socket events
function registerAuctionHandlers(io, socket) {
  socket.on("auction:join", (data) => {
    joinAuction(io, socket, data);
  });

  socket.on("bid:place", (data) => {
    placeBid(io, socket, data);
  });

  socket.on("disconnect", () => {
    handleDisconnect(io, socket);
  });
}


module.exports = {
  auctions,
  registerAuctionHandlers,
  placeBid,
  joinAuction
};