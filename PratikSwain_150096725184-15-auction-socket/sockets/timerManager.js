/**
 * timerManager.js
 * Server-authoritative timer manager for live auctions.
 * Runs a strictly synchronized 1-second interval per active auction room.
 */

class TimerManager {
  constructor() {
    this.timers = new Map(); // auctionId -> intervalId
  }

  /**
   * Start countdown for an auction
   * @param {Object} io - Socket.io server instance
   * @param {Object} auction - Authoritative auction object
   */
  startTimer(io, auction) {
    if (!auction || auction.status !== 'active') return;
    if (this.timers.has(auction.id)) {
      clearInterval(this.timers.get(auction.id));
    }

    const intervalId = setInterval(() => {
      // Synchronous tick
      if (auction.status !== 'active') {
        this.stopTimer(auction.id);
        return;
      }

      auction.timeRemainingSeconds -= 1;

      // Broadcast time tick to the room
      io.to(`auction_${auction.id}`).emit('auction:time_tick', {
        auctionId: auction.id,
        timeRemainingSeconds: Math.max(0, auction.timeRemainingSeconds)
      });

      // Handle auction expiry
      if (auction.timeRemainingSeconds <= 0) {
        auction.timeRemainingSeconds = 0;
        auction.status = 'ended';
        this.stopTimer(auction.id);

        const winner = auction.currentHighestBidder || null;
        const finalAmount = auction.currentBid;
        const bidCount = auction.bidHistory ? auction.bidHistory.length : 0;

        const soldPayload = {
          auctionId: auction.id,
          winner: winner,
          finalAmount: finalAmount,
          bidCount: bidCount,
          itemTitle: auction.title
        };

        // Broadcast sold event
        io.to(`auction_${auction.id}`).emit('auction:sold', soldPayload);

        // Broadcast activity ticker event
        io.to(`auction_${auction.id}`).emit('auction:activity', {
          auctionId: auction.id,
          activity: {
            type: 'sold',
            bidder: winner || 'No Bids Placed',
            amount: finalAmount,
            timestamp: new Date().toISOString()
          }
        });
      }
    }, 1000);

    this.timers.set(auction.id, intervalId);
  }

  /**
   * Extend an active auction countdown (used for anti-snipe logic)
   * @param {Object} io - Socket.io server instance
   * @param {Object} auction - Authoritative auction object
   * @param {number} newSeconds - New countdown duration in seconds
   */
  extendTimer(io, auction, newSeconds = 20) {
    if (!auction || auction.status !== 'active') return;
    auction.timeRemainingSeconds = newSeconds;
    
    // Broadcast immediate tick update so clients see the extended time with 0ms delay
    io.to(`auction_${auction.id}`).emit('auction:time_tick', {
      auctionId: auction.id,
      timeRemainingSeconds: auction.timeRemainingSeconds
    });
  }

  /**
   * Stop timer for a specific auction
   * @param {string} auctionId
   */
  stopTimer(auctionId) {
    if (this.timers.has(auctionId)) {
      clearInterval(this.timers.get(auctionId));
      this.timers.delete(auctionId);
    }
  }

  /**
   * Stop all running timers (e.g. server shutdown)
   */
  stopAll() {
    for (const [id, intervalId] of this.timers.entries()) {
      clearInterval(intervalId);
    }
    this.timers.clear();
  }
}

module.exports = new TimerManager();
