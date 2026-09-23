function startAuctionTimer(io, auction) {
  // Prevent multiple timers for the same auction
  if (auction.timerInterval) {
    clearInterval(auction.timerInterval);
  }

  auction.timerInterval = setInterval(() => {
    // Stop timer if auction is no longer active
    if (auction.status !== "active") {
      clearInterval(auction.timerInterval);
      auction.timerInterval = null;
      return;
    }

    // Decrease timer
    auction.timeRemainingSeconds--;

    // Broadcast remaining time
    io.to(auction.id).emit("auction:time_tick", {
      auctionId: auction.id,
      timeRemaining: auction.timeRemainingSeconds
    });

    // Auction ended
    if (auction.timeRemainingSeconds <= 0) {
      auction.timeRemainingSeconds = 0;
      auction.status = "ended";

      clearInterval(auction.timerInterval);
      auction.timerInterval = null;

      // Send sold event
      io.to(auction.id).emit("auction:sold", {
        winner: auction.highestBidder,
        finalPrice: auction.currentBid,
        status: "sold"
      });
    }
  }, 1000);
}


function stopAuctionTimer(auction) {
  if (auction.timerInterval) {
    clearInterval(auction.timerInterval);
    auction.timerInterval = null;
  }
}


module.exports = {
  startAuctionTimer,
  stopAuctionTimer
};