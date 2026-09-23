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
      reason: `Bid too low. Minimum valid bid is ₹${minimumRequired.toLocaleString(
        "en-IN"
      )}`
    });
  }

  const previousBidder = auction.highestBidder;

  auction.currentBid = bidAmount;
  auction.highestBidder = {
    socketId: socket.id,
    username
  };

  auction.bidHistory.unshift({
    bidder: username,
    amount: bidAmount,
    timestamp: new Date().toLocaleTimeString("en-IN")
  });

  if (auction.timeRemainingSeconds < 15) {
    auction.timeRemainingSeconds = 20;

    io.to(auction.id).emit("auction:extended", {
      timeRemaining: 20,
      message: "Bid in final seconds: Timer extended to 20 seconds!"
    });
  }

  io.to(auction.id).emit("bid:success", {
    currentBid: auction.currentBid,
    newBid: auction.currentBid,
    highestBidder: username,
    bidHistory: auction.bidHistory,
    timeRemaining: auction.timeRemainingSeconds
  });

  if (
    previousBidder &&
    previousBidder.socketId !== socket.id
  ) {
    io.to(previousBidder.socketId).emit("bid:outbid", {
      message: `You were outbid by ${username} with ₹${bidAmount.toLocaleString(
        "en-IN"
      )}!`
    });
  }
}

module.exports = {
  handleBidPlacement
};