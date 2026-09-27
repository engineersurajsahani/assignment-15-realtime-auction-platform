const { auctions } = require('./auctionStore');

function startAuctionTimer(io, auctionId) {
  const auction = auctions[auctionId];
  if (!auction || auction.timerInterval) return;

  auction.timerInterval = setInterval(() => {
    if (auction.timeRemainingSeconds > 0) {
      auction.timeRemainingSeconds--;
      io.to(auctionId).emit('auction:time_tick', {
        auctionId,
        timeRemaining: auction.timeRemainingSeconds
      });
    } else {
      clearInterval(auction.timerInterval);
      auction.timerInterval = null;
      auction.status = 'ended';
      
      io.to(auctionId).emit('auction:sold', {
        winner: auction.highestBidder ? auction.highestBidder.username : 'Unsold',
        finalPrice: auction.currentBid,
        status: 'sold'
      });
    }
  }, 1000);
}

module.exports = { startAuctionTimer };
