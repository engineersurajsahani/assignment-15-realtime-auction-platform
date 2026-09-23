function startAuctionTimer(io, auction) {
  if (auction.timerInterval) {
    clearInterval(auction.timerInterval);
  }

  auction.timerInterval = setInterval(() => {
    if (auction.status !== "active") {
      clearInterval(auction.timerInterval);
      auction.timerInterval = null;
      return;
    }

    if (auction.timeRemainingSeconds > 0) {
      auction.timeRemainingSeconds -= 1;

      io.to(auction.id).emit("auction:time_tick", {
        auctionId: auction.id,
        timeRemaining: auction.timeRemainingSeconds
      });
    }

    if (auction.timeRemainingSeconds <= 0) {
      auction.timeRemainingSeconds = 0;
      auction.status = "ended";

      clearInterval(auction.timerInterval);
      auction.timerInterval = null;

      if (auction.highestBidder) {
        io.to(auction.id).emit("auction:sold", {
          winner: auction.highestBidder.username,
          finalPrice: auction.currentBid,
          status: "sold"
        });
      } else {
        io.to(auction.id).emit("auction:sold", {
          winner: null,
          finalPrice: 0,
          status: "unsold"
        });
      }
    }
  }, 1000);
}

module.exports = {
  startAuctionTimer
};