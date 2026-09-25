

const timers = new Map();

function startAuctionTimer(io, auction) {
  if (timers.has(auction.id)) return;

  const intervalId = setInterval(() => {
    if (auction.status !== 'active') {
      stopAuctionTimer(auction.id);
      return;
    }

    auction.timeRemainingSeconds = Math.max(0, auction.timeRemainingSeconds - 1);

    io.to(auction.id).emit('auction:time_tick', {
      auctionId: auction.id,
      timeRemaining: auction.timeRemainingSeconds,
    });

    if (auction.timeRemainingSeconds <= 0) {
      endAuction(io, auction);
    }
  }, 1000);

  timers.set(auction.id, intervalId);
}

function stopAuctionTimer(auctionId) {
  const intervalId = timers.get(auctionId);
  if (intervalId) {
    clearInterval(intervalId);
    timers.delete(auctionId);
  }
}

function endAuction(io, auction) {
  auction.status = 'ended';
  stopAuctionTimer(auction.id);

  if (auction.highestBidder) {
    io.to(auction.id).emit('auction:sold', {
      auctionId: auction.id,
      winner: auction.highestBidder.username,
      finalPrice: auction.currentBid,
      status: 'sold',
    });
  } else {
    io.to(auction.id).emit('auction:sold', {
      auctionId: auction.id,
      winner: null,
      finalPrice: auction.currentBid,
      status: 'unsold',
    });
  }
}

module.exports = { startAuctionTimer, stopAuctionTimer, endAuction };
