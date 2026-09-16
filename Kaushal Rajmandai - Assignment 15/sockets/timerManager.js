const { auctions } = require('./auctionEngine');

const startAuctionTimers = (io) => {
  setInterval(() => {
    Object.values(auctions).forEach((auction) => {
      if (auction.status !== 'active') return;

      if (auction.timeRemainingSeconds > 0) {
        auction.timeRemainingSeconds -= 1;
        io.to(auction.id).emit('auction:time_tick', {
          auctionId: auction.id,
          timeRemaining: auction.timeRemainingSeconds
        });
      }

      if (auction.timeRemainingSeconds <= 0 && auction.status === 'active') {
        auction.status = 'ended';
        io.to(auction.id).emit('auction:sold', {
          winner: auction.highestBidder ? auction.highestBidder.username : null,
          finalPrice: auction.currentBid,
          status: 'sold'
        });
      }
    });
  }, 1000);
};

module.exports = { startAuctionTimers };