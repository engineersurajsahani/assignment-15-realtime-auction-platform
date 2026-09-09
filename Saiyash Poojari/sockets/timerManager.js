function startAuctionTimer(io, auction) {
  if (auction.timerInterval) {
    clearInterval(auction.timerInterval);
  }

  auction.status = "active";

  auction.timerInterval = setInterval(() => {
    if (auction.timeRemainingSeconds <= 0) {
      clearInterval(auction.timerInterval);
      auction.timerInterval = null;
      auction.status = "ended";

      const winnerName = auction.highestBidder ? auction.highestBidder.username : "No Bids";
      const finalStatus = auction.highestBidder ? "sold" : "unsold";

      io.to(auction.id).emit("auction:sold", {
        auctionId: auction.id,
        winner: winnerName,
        finalPrice: auction.currentBid,
        status: finalStatus,
        message: auction.highestBidder 
          ? `SOLD! ${auction.title} was won by ${winnerName} for ₹${auction.currentBid.toLocaleString('en-IN')}!`
          : `Auction ended. No bids received for ${auction.title}.`
      });
      return;
    }

    auction.timeRemainingSeconds -= 1;

    io.to(auction.id).emit("auction:time_tick", {
      auctionId: auction.id,
      timeRemaining: auction.timeRemainingSeconds
    });
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
