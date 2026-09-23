function initializeTimers(io, auctions) {
  Object.keys(auctions).forEach((auctionId) => {
    const auction = auctions[auctionId];

    auction.timerInterval = setInterval(() => {
      if (auction.status !== 'active') return;

      if (auction.timeRemainingSeconds > 0) {
        auction.timeRemainingSeconds -= 1;
        
        io.to(auction.id).emit('auction:time_tick', {
          auctionId: auction.id,
          timeRemaining: auction.timeRemainingSeconds
        });
      } else {
        // Clock hit 0 -> End Auction
        auction.status = 'ended';
        clearInterval(auction.timerInterval);

        const winnerName = auction.highestBidder ? auction.highestBidder.username : 'None';
        
        io.to(auction.id).emit('auction:sold', {
          winner: winnerName,
          finalPrice: auction.currentBid,
          status: 'sold'
        });
      }
    }, 1000);
  });
}

module.exports = { initializeTimers };
