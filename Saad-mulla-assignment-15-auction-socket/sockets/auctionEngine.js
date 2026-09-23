function registerAuctionHandlers(io, socket, auctions) {
  
  // Join Auction Room
  socket.on('auction:join', ({ auctionId, username }) => {
    const auction = auctions[auctionId];
    if (!auction) {
      return socket.emit('bid:rejected', { reason: 'Auction room not found' });
    }

    // Join Socket Room
    socket.join(auctionId);
    socket.auctionId = auctionId;
    socket.username = username || `Bidder_${socket.id.substring(0, 4)}`;

    // Track Viewer
    auction.viewers.set(socket.id, socket.username);

    // Send full current state to newly joined client
    socket.emit('auction:init', {
      item: {
        id: auction.id,
        title: auction.title,
        description: auction.description,
        startingPrice: auction.startingPrice,
        currentBid: auction.currentBid,
        minIncrement: auction.minIncrement,
        status: auction.status,
        highestBidder: auction.highestBidder ? auction.highestBidder.username : null
      },
      bidHistory: auction.bidHistory,
      timeRemaining: auction.timeRemainingSeconds
    });

    // Broadcast updated audience count to room
    io.to(auctionId).emit('user:joined', {
      username: socket.username,
      totalViewers: auction.viewers.size
    });
  });

  // Place Bid Action
  socket.on('bid:place', ({ auctionId, amount }) => {
    const auction = auctions[auctionId];
    if (!auction) return;

    handleBidPlacement(io, socket, auction, Number(amount), socket.username);
  });

  // Disconnect Handler
  socket.on('disconnect', () => {
    if (socket.auctionId && auctions[socket.auctionId]) {
      const auction = auctions[socket.auctionId];
      auction.viewers.delete(socket.id);
      
      io.to(socket.auctionId).emit('user:joined', {
        username: socket.username,
        totalViewers: auction.viewers.size
      });
    }
  });
}

function handleBidPlacement(io, socket, auction, bidAmount, username) {
  // 1. Check if auction is active
  if (auction.status !== 'active' || auction.timeRemainingSeconds <= 0) {
    return socket.emit('bid:rejected', { reason: 'Auction is closed' });
  }

  // 2. Check if bidder is already the highest bidder
  if (auction.highestBidder && auction.highestBidder.socketId === socket.id) {
    return socket.emit('bid:rejected', { reason: 'You are already the highest bidder' });
  }

  // 3. Check minimum increment requirement
  const minimumRequired = auction.currentBid + auction.minIncrement;
  if (bidAmount < minimumRequired) {
    return socket.emit('bid:rejected', { 
      reason: `Bid too low. Minimum valid bid is ₹${minimumRequired.toLocaleString('en-IN')}` 
    });
  }

  // 4. Capture previous highest bidder to notify outbid
  const previousBidder = auction.highestBidder;

  // 5. Update State
  auction.currentBid = bidAmount;
  auction.highestBidder = { socketId: socket.id, username };
  auction.bidHistory.unshift({
    bidder: username,
    amount: bidAmount,
    timestamp: new Date().toLocaleTimeString()
  });

  // 6. Anti-Snipe Rule: If bid placed within last 15s, extend timer back to 20s
  if (auction.timeRemainingSeconds < 15) {
    auction.timeRemainingSeconds = 20;
    io.to(auction.id).emit('auction:extended', {
      timeRemaining: 20,
      message: 'Anti-snipe triggered: +20 seconds added!'
    });
  }

  // 7. Broadcast new top bid to room
  io.to(auction.id).emit('bid:success', {
    newBid: auction.currentBid,
    highestBidder: username,
    bidHistory: auction.bidHistory,
    timeRemaining: auction.timeRemainingSeconds
  });

  // 8. Send private alert to outbid user
  if (previousBidder && previousBidder.socketId !== socket.id) {
    io.to(previousBidder.socketId).emit('bid:outbid', {
      message: `You have been outbid by ${username} at ₹${bidAmount.toLocaleString('en-IN')}!`
    });
  }
}

module.exports = { registerAuctionHandlers };
