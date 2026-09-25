

const ANTI_SNIPE_THRESHOLD_SECONDS = 15;
const ANTI_SNIPE_EXTENSION_SECONDS = 20;

function formatCurrency(amount) {
  return `₹${Number(amount).toLocaleString('en-IN')}`;
}

function handleBidPlacement(io, socket, auction, bidAmount, username) {

  if (typeof bidAmount !== 'number' || Number.isNaN(bidAmount) || bidAmount <= 0) {
    return socket.emit('bid:rejected', { reason: 'Invalid bid amount' });
  }


  if (auction.status !== 'active' || auction.timeRemainingSeconds <= 0) {
    return socket.emit('bid:rejected', { reason: 'Auction is closed' });
  }


  if (auction.highestBidder && auction.highestBidder.socketId === socket.id) {
    return socket.emit('bid:rejected', { reason: 'You are already the highest bidder' });
  }


  const minimumRequired = auction.currentBid + auction.minIncrement;
  if (bidAmount < minimumRequired) {
    return socket.emit('bid:rejected', {
      reason: `Bid too low. Minimum valid bid is ${formatCurrency(minimumRequired)}`,
    });
  }


  const previousBidder = auction.highestBidder;


  auction.currentBid = bidAmount;
  auction.highestBidder = { socketId: socket.id, username };
  auction.bidHistory.unshift({
    bidder: username,
    amount: bidAmount,
    timestamp: new Date().toLocaleTimeString('en-IN'),
  });

  if (auction.bidHistory.length > 50) auction.bidHistory.length = 50;


  let extended = false;
  if (auction.timeRemainingSeconds < ANTI_SNIPE_THRESHOLD_SECONDS) {
    auction.timeRemainingSeconds = ANTI_SNIPE_EXTENSION_SECONDS;
    extended = true;
    io.to(auction.id).emit('auction:extended', {
      auctionId: auction.id,
      timeRemaining: auction.timeRemainingSeconds,
      message: `Bid in final seconds: Timer extended by ${ANTI_SNIPE_EXTENSION_SECONDS}s!`,
    });
  }


  io.to(auction.id).emit('bid:success', {
    auctionId: auction.id,
    currentBid: auction.currentBid,
    highestBidder: username,
    bidHistory: auction.bidHistory,
    timeRemaining: auction.timeRemainingSeconds,
    extended,
  });


  if (previousBidder && previousBidder.socketId !== socket.id) {
    io.to(previousBidder.socketId).emit('bid:outbid', {
      auctionId: auction.id,
      message: `You were outbid by ${username} with ${formatCurrency(bidAmount)}!`,
    });
  }
}

module.exports = { handleBidPlacement, formatCurrency, ANTI_SNIPE_THRESHOLD_SECONDS, ANTI_SNIPE_EXTENSION_SECONDS };
