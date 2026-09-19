const { auctions } = require('./auctionEngine');

let timerStarted = false;

const startAuctionTimers = (io) => {
  if (timerStarted) return;
  timerStarted = true;

  setInterval(() => {
    Object.values(auctions).forEach((auction) => {
      if (auction.status === 'active') {
        if (auction.timeRemainingSeconds > 0) {
          auction.timeRemainingSeconds--;
          io.to(auction.id).emit('auction:time_tick', {
            auctionId: auction.id,
            timeRemaining: auction.timeRemainingSeconds
          });
        } else {
          auction.status = 'ended';
          io.to(auction.id).emit('auction:sold', {
            winner: auction.highestBidder ? auction.highestBidder.username : 'None',
            finalPrice: auction.currentBid,
            status: 'sold'
          });
        }
      }
    });
  }, 1000);
};

module.exports = { startAuctionTimers };
