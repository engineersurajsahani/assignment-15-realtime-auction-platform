const { persistAuctionResult } = require("../data/auditStore");

const TICK_MS = 1000;

const startCountdown = (io, auction) => {
  if (auction.timerInterval) return;

  auction.timerInterval = setInterval(() => {
    auction.timeRemainingSeconds -= 1;

    if (auction.timeRemainingSeconds <= 0) {
      auction.timeRemainingSeconds = 0;
      stopCountdown(auction);

      if (auction.status === "active") {
        auction.status = "ended";

        const winner = auction.highestBidder
          ? auction.highestBidder.username
          : null;

        io.to(auction.id).emit("auction:sold", {
          auctionId: auction.id,
          winner,
          finalPrice: auction.currentBid,
          title: auction.title,
          status: winner ? "sold" : "no_bid",
        });

        persistAuctionResult(auction);
      }
      return;
    }

    io.to(auction.id).emit("auction:time_tick", {
      auctionId: auction.id,
      timeRemaining: auction.timeRemainingSeconds,
    });
  }, TICK_MS);
};

const stopCountdown = (auction) => {
  if (auction.timerInterval) {
    clearInterval(auction.timerInterval);
    auction.timerInterval = null;
  }
};

module.exports = { startCountdown, stopCountdown, TICK_MS };