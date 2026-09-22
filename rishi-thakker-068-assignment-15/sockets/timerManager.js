// sockets/timerManager.js
// Server-side 1-second interval countdown clock for an auction room.
// This is the single source of truth for time — clients only display it.

function startTimer(io, auction, onEnd) {
  clearInterval(auction.timerInterval);

  auction.timerInterval = setInterval(() => {
    if (auction.status !== "active") {
      clearInterval(auction.timerInterval);
      return;
    }

    auction.timeRemainingSeconds -= 1;

    if (auction.timeRemainingSeconds <= 0) {
      auction.timeRemainingSeconds = 0;
      clearInterval(auction.timerInterval);
      onEnd(auction);
      return;
    }

    io.to(auction.id).emit("auction:time_tick", {
      auctionId: auction.id,
      timeRemaining: auction.timeRemainingSeconds,
    });
  }, 1000);
}

function stopTimer(auction) {
  clearInterval(auction.timerInterval);
  auction.timerInterval = null;
}

module.exports = { startTimer, stopTimer };
