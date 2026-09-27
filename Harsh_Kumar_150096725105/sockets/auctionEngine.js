const { auctions, getAuctionSafe } = require('./auctionStore');

function handleBidPlacement(io, socket, auctionId, bidAmount, username) {
  const auction = auctions[auctionId];
  if (!auction) return socket.emit('bid:rejected', { reason: 'Auction not found' });

  if (auction.status !== 'active' || auction.timeRemainingSeconds <= 0) {
    return socket.emit('bid:rejected', { reason: 'Auction is closed' });
  }

  if (auction.highestBidder && auction.highestBidder.socketId === socket.id) {
    return socket.emit('bid:rejected', { reason: 'You are already the highest bidder' });
  }

  const minimumRequired = auction.currentBid + (auction.highestBidder ? auction.minIncrement : 0);
  if (bidAmount < minimumRequired) {
    return socket.emit('bid:rejected', { 
      reason: `Bid too low. Minimum valid bid is ₹${minimumRequired}` 
    });
  }

  const previousBidder = auction.highestBidder;

  auction.currentBid = bidAmount;
  auction.highestBidder = { socketId: socket.id, username };
  auction.bidHistory.unshift({
    bidder: username,
    amount: bidAmount,
    timestamp: new Date().toLocaleTimeString()
  });

  // Anti-Snipe Protection
  if (auction.timeRemainingSeconds < 15) {
    auction.timeRemainingSeconds = 20;
    io.to(auction.id).emit('auction:extended', {
      timeRemaining: 20,
      message: 'Bid in final seconds: Timer extended by 20s!'
    });
  }

  io.to(auction.id).emit('bid:success', {
    currentBid: auction.currentBid,
    highestBidder: username,
    bidHistory: auction.bidHistory,
    timeRemaining: auction.timeRemainingSeconds
  });

  if (previousBidder && previousBidder.socketId !== socket.id) {
    io.to(previousBidder.socketId).emit('bid:outbid', {
      message: `You were outbid by ${username} at ₹${bidAmount}!`
    });
  }
}

module.exports = { handleBidPlacement };
