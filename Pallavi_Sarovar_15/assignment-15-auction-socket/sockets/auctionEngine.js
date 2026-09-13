const { v4: uuidv4 } = require("uuid");

function createAuction() {
  return {
    id: "AUC_VINTAGE_99",
    title: "1967 Vintage Fender Stratocaster",
    description: "Original-condition vintage electric guitar with a rare sunburst finish.",
    startingPrice: 50000,
    currentBid: 50000,
    highestBidder: null,
    minIncrement: 2000,
    timeRemainingSeconds: 60,
    status: "active",
    bidHistory: [],
    timerInterval: null,
    viewers: new Map()
  };
}

function startTimer(io, auction) {
  if (auction.timerInterval) return;

  auction.timerInterval = setInterval(() => {
    if (auction.status !== "active") return;

    if (auction.timeRemainingSeconds > 0) {
      auction.timeRemainingSeconds -= 1;

      io.to(auction.id).emit("auction:time_tick", {
        auctionId: auction.id,
        timeRemaining: auction.timeRemainingSeconds
      });
    }

    if (auction.timeRemainingSeconds <= 0) {
      auction.status = "ended";

      io.to(auction.id).emit("auction:sold", {
        winner: auction.highestBidder ? auction.highestBidder.username : null,
        finalPrice: auction.currentBid,
        status: auction.highestBidder ? "sold" : "unsold"
      });
    }
  }, 1000);
}

function stopTimer(auction) {
  if (auction.timerInterval) {
    clearInterval(auction.timerInterval);
    auction.timerInterval = null;
  }
}

function handleBidPlacement(io, socket, auction, bidAmount, username) {
  const amount = Number(bidAmount);

  if (!Number.isFinite(amount) || amount <= 0) {
    socket.emit("bid:rejected", { reason: "Enter a valid bid amount." });
    return;
  }

  if (auction.status !== "active" || auction.timeRemainingSeconds <= 0) {
    socket.emit("bid:rejected", { reason: "Auction is closed." });
    return;
  }

  if (auction.highestBidder && auction.highestBidder.socketId === socket.id) {
    socket.emit("bid:rejected", { reason: "You are already the highest bidder." });
    return;
  }

  const minimumRequired = auction.currentBid + auction.minIncrement;

  if (amount < minimumRequired) {
    socket.emit("bid:rejected", {
      reason: `Bid too low. Minimum valid bid is ₹${minimumRequired.toLocaleString("en-IN")}.`
    });
    return;
  }

  const previousBidder = auction.highestBidder;

  auction.currentBid = amount;
  auction.highestBidder = {
    socketId: socket.id,
    username
  };

  auction.bidHistory.unshift({
    id: uuidv4(),
    bidder: username,
    amount,
    timestamp: new Date().toISOString()
  });

  let extended = false;

  if (auction.timeRemainingSeconds < 15) {
    auction.timeRemainingSeconds = 20;
    extended = true;

    io.to(auction.id).emit("auction:extended", {
      timeRemaining: 20,
      message: "Anti-snipe protection triggered — timer extended to 20 seconds."
    });
  }

  io.to(auction.id).emit("bid:success", {
    currentBid: auction.currentBid,
    highestBidder: username,
    bidHistory: auction.bidHistory,
    timeRemaining: auction.timeRemainingSeconds,
    extended
  });

  if (previousBidder && previousBidder.socketId !== socket.id) {
    io.to(previousBidder.socketId).emit("bid:outbid", {
      message: `You were outbid by ${username} at ₹${amount.toLocaleString("en-IN")}.`
    });
  }
}

module.exports = {
  createAuction,
  startTimer,
  stopTimer,
  handleBidPlacement
};
