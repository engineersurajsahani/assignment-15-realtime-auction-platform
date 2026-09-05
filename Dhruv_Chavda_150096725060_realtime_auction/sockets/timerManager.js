// Timer Manager for Real-Time Auction Countdown & Anti-Snipe

function startAuctionTimer(io, auction) {
  if (auction.timerInterval) {
    clearInterval(auction.timerInterval);
  }

  auction.timerInterval = setInterval(() => {
    if (auction.status !== 'active') {
      clearInterval(auction.timerInterval);
      return;
    }

    auction.timeRemainingSeconds -= 1;

    // Broadcast 1-second synchronized clock tick
    io.to(auction.id).emit('auction:time_tick', {
      auctionId: auction.id,
      timeRemaining: auction.timeRemainingSeconds
    });

    // Auction ended / hammer dropped
    if (auction.timeRemainingSeconds <= 0) {
      clearInterval(auction.timerInterval);
      auction.status = 'ended';

      const winnerName = auction.highestBidder ? auction.highestBidder.username : null;
      const finalPrice = auction.currentBid;

      io.to(auction.id).emit('auction:sold', {
        auctionId: auction.id,
        winner: winnerName || 'No Winner (Reserve Not Met)',
        finalPrice: finalPrice,
        status: 'sold',
        message: winnerName
          ? `🔨 SOLD! Congratulations to ${winnerName} for winning at ₹${finalPrice.toLocaleString()}!`
          : '🔨 Auction ended with no winning bids.'
      });

      console.log(`🔨 Auction [${auction.id}] closed. Winner: ${winnerName || 'None'} @ ₹${finalPrice}`);
    }
  }, 1000);
}

function resetAuctionTimer(io, auction, newSeconds = 20) {
  auction.timeRemainingSeconds = newSeconds;
  io.to(auction.id).emit('auction:extended', {
    auctionId: auction.id,
    timeRemaining: newSeconds,
    message: `⚡ Anti-snipe triggered: +${newSeconds} seconds added to the clock!`
  });
}

module.exports = {
  startAuctionTimer,
  resetAuctionTimer
};
