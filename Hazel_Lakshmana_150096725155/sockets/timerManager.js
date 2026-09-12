const { auctions, publicAuction } = require("./auctionEngine");

function startTimer(io) {
  setInterval(() => {
    Object.values(auctions).forEach((auction) => {
      if (auction.status !== "active") {
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

        const winner = auction.highestBidder
          ? auction.highestBidder.username
          : null;

        io.to(auction.id).emit("auction:sold", {
          winner,
          finalPrice: auction.currentBid,
          status: "sold"
        });
      }
    });
  }, 1000);
}

module.exports = { startTimer };