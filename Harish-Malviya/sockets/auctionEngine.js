/**
 * auctionEngine.js
 * Mission-critical synchronous bidding engine.
 * 
 * GUARANTEED RACE-CONDITION SAFETY:
 * In Node.js's single-threaded cooperative event loop, synchronous functions
 * execute completely without yielding execution to another event or tick.
 * By keeping handleBidPlacement 100% synchronous (no `await`, no promises, no I/O),
 * concurrent incoming bids are queued and executed one-by-one in strict arrival order.
 * Stale state reads are impossible because state reads and mutations happen atomically.
 */

const { v4: uuidv4 } = require('uuid');

/**
 * Validates and places a bid atomically on the auction state.
 * 
 * @param {Object} io - Socket.io server instance
 * @param {Object} socket - Socket instance of the placing bidder
 * @param {Object} payload - { auctionId, bidder, amount }
 * @param {Map<string, Object>} auctions - Master in-memory auctions store
 * @param {Object} timerManager - Active timer manager instance
 * @returns {boolean} - True if bid was accepted, false otherwise
 */
function handleBidPlacement(io, socket, payload, auctions, timerManager) {
  if (!payload || typeof payload !== 'object') {
    socket.emit('bid:rejected', {
      auctionId: null,
      reason: 'Invalid payload structure',
      currentBid: 0,
      minIncrement: 0
    });
    return false;
  }

  const { auctionId, bidder, amount } = payload;
  const numericAmount = Number(amount);

  // 1. Basic type validation
  if (!auctionId || !bidder || typeof bidder !== 'string' || isNaN(numericAmount) || numericAmount <= 0) {
    socket.emit('bid:rejected', {
      auctionId: auctionId || null,
      reason: 'Invalid bid parameters: name and positive numeric amount required',
      currentBid: 0,
      minIncrement: 0
    });
    return false;
  }

  // 2. Fetch auction from authoritative state
  const auction = auctions.get(auctionId);
  if (!auction) {
    socket.emit('bid:rejected', {
      auctionId,
      reason: 'Auction not found',
      currentBid: 0,
      minIncrement: 0
    });
    return false;
  }

  // 3. Status check - must be active
  if (auction.status !== 'active' || auction.timeRemainingSeconds <= 0) {
    socket.emit('bid:rejected', {
      auctionId,
      reason: 'Auction is not active',
      currentBid: auction.currentBid,
      minIncrement: auction.minIncrement
    });
    return false;
  }

  // 4. Self-outbid prevention
  const cleanBidder = bidder.trim();
  if (auction.currentHighestBidder && auction.currentHighestBidder.toLowerCase() === cleanBidder.toLowerCase()) {
    socket.emit('bid:rejected', {
      auctionId,
      reason: 'You are already the highest bidder',
      currentBid: auction.currentBid,
      minIncrement: auction.minIncrement
    });
    return false;
  }

  // 5. Minimum increment validation
  const minRequired = auction.currentBid + auction.minIncrement;
  if (numericAmount < minRequired) {
    socket.emit('bid:rejected', {
      auctionId,
      reason: `Bid must be at least $${minRequired.toLocaleString()}`,
      currentBid: auction.currentBid,
      minIncrement: auction.minIncrement
    });
    return false;
  }

  // --- ATOMIC STATE MUTATION ---
  const previousHighestBidder = auction.currentHighestBidder;
  const previousHighestBidderSocketId = auction.currentHighestBidderSocketId;

  auction.currentBid = numericAmount;
  auction.currentHighestBidder = cleanBidder;
  auction.currentHighestBidderSocketId = socket.id;

  const bidRecord = {
    id: uuidv4(),
    bidder: cleanBidder,
    amount: numericAmount,
    timestamp: new Date().toISOString()
  };

  auction.bidHistory.unshift(bidRecord);

  // 6. Emit bid:success to the entire auction room
  io.to(`auction_${auction.id}`).emit('bid:success', {
    auctionId: auction.id,
    currentBid: auction.currentBid,
    currentHighestBidder: auction.currentHighestBidder,
    minIncrement: auction.minIncrement,
    bidHistory: auction.bidHistory
  });

  // 7. Emit auction:activity ticker event
  io.to(`auction_${auction.id}`).emit('auction:activity', {
    auctionId: auction.id,
    activity: {
      type: 'bid',
      bidder: cleanBidder,
      amount: numericAmount,
      timestamp: bidRecord.timestamp
    }
  });

  // 8. Targeted bid:outbid alert to previous leader
  if (previousHighestBidderSocketId && previousHighestBidderSocketId !== socket.id) {
    io.to(previousHighestBidderSocketId).emit('bid:outbid', {
      auctionId: auction.id,
      newBid: numericAmount,
      newHighestBidder: cleanBidder
    });
  }

  // 9. Anti-snipe rule: If < 15 seconds remaining, reset to 20 seconds
  if (auction.timeRemainingSeconds < 15) {
    const extensionDuration = 20;
    timerManager.extendTimer(io, auction, extensionDuration);

    // Broadcast anti-snipe extension event
    io.to(`auction_${auction.id}`).emit('auction:extended', {
      auctionId: auction.id,
      newTimeRemainingSeconds: extensionDuration,
      message: 'Anti-snipe triggered: Time extended to 20 seconds'
    });

    // Broadcast activity ticker event for anti-snipe
    io.to(`auction_${auction.id}`).emit('auction:activity', {
      auctionId: auction.id,
      activity: {
        type: 'extended',
        bidder: cleanBidder,
        amount: numericAmount,
        timestamp: new Date().toISOString(),
        message: 'Anti-snipe extension (+20s)'
      }
    });
  }

  return true;
}

module.exports = {
  handleBidPlacement
};
