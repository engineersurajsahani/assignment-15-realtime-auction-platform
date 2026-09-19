const auctions = {
  AUC_VINTAGE_99: {
    id: 'AUC_VINTAGE_99',
    title: '1967 Vintage Fender Stratocaster',
    description: 'Original condition rare electric guitar in Sunburst finish',
    startingPrice: 50000,
    currentBid: 50000,
    highestBidder: null,
    minIncrement: 2000,
    timeRemainingSeconds: 60,
    status: 'active',
    bidHistory: [],
    viewers: 0
  }
};

const handleBidPlacement = (io, socket, auction, bidAmount, username) => {
  if (auction.status !== 'active' || auction.timeRemainingSeconds <= 0) {
    return socket.emit('bid:rejected', { reason: 'Auction is closed' });
  }

  if (auction.highestBidder && auction.highestBidder.socketId === socket.id) {
    return socket.emit('bid:rejected', { reason: 'You are already the highest bidder' });
  }

  const minimumRequired = auction.currentBid + auction.minIncrement;
  const amount = Number(bidAmount);

  if (isNaN(amount) || amount < minimumRequired) {
    return socket.emit('bid:rejected', {
      reason: `Bid too low. Minimum valid bid is ₹${minimumRequired.toLocaleString()}`
    });
  }

  const previousBidder = auction.highestBidder;

  auction.currentBid = amount;
  auction.highestBidder = { socketId: socket.id, username };
  auction.bidHistory.unshift({
    bidder: username,
    amount,
    timestamp: new Date().toLocaleTimeString()
  });

  if (auction.timeRemainingSeconds < 15) {
    auction.timeRemainingSeconds = 20;
    io.to(auction.id).emit('auction:extended', {
      timeRemaining: 20,
      message: 'Anti-snipe triggered: +20 seconds added!'
    });
  }

  io.to(auction.id).emit('bid:success', {
    newBid: auction.currentBid,
    currentBid: auction.currentBid,
    highestBidder: username,
    bidHistory: auction.bidHistory,
    timeRemaining: auction.timeRemainingSeconds
  });

  if (previousBidder && previousBidder.socketId !== socket.id) {
    io.to(previousBidder.socketId).emit('bid:outbid', {
      message: `You have been outbid by ${username} at ₹${amount.toLocaleString()}!`
    });
  }
};

const setupAuctionEngine = (io, socket) => {
  socket.on('auction:join', ({ auctionId, username }) => {
    const aId = auctionId || 'AUC_VINTAGE_99';
    const uname = (username || 'Bidder').trim();

    const auction = auctions[aId];
    if (!auction) {
      return socket.emit('auction:error', { message: 'Auction not found' });
    }

    socket.join(aId);
    socket.currentAuction = aId;
    socket.username = uname;
    auction.viewers = (auction.viewers || 0) + 1;

    socket.emit('auction:init', {
      item: {
        id: auction.id,
        title: auction.title,
        description: auction.description,
        startingPrice: auction.startingPrice,
        currentBid: auction.currentBid,
        minIncrement: auction.minIncrement,
        highestBidder: auction.highestBidder ? auction.highestBidder.username : 'None',
        status: auction.status
      },
      bidHistory: auction.bidHistory,
      timeRemaining: auction.timeRemainingSeconds,
      totalViewers: auction.viewers
    });

    io.to(aId).emit('user:joined', {
      username: uname,
      totalViewers: auction.viewers
    });
  });

  socket.on('bid:place', ({ auctionId, amount }) => {
    const aId = auctionId || socket.currentAuction || 'AUC_VINTAGE_99';
    const auction = auctions[aId];
    if (!auction) return;

    handleBidPlacement(io, socket, auction, amount, socket.username || 'Anonymous');
  });

  socket.on('disconnect', () => {
    const aId = socket.currentAuction;
    if (aId && auctions[aId]) {
      auctions[aId].viewers = Math.max(0, (auctions[aId].viewers || 1) - 1);
      io.to(aId).emit('user:left', {
        username: socket.username,
        totalViewers: auctions[aId].viewers
      });
    }
  });
};

module.exports = { setupAuctionEngine, auctions, handleBidPlacement };
