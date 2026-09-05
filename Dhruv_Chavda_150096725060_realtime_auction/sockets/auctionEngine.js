const { startAuctionTimer, resetAuctionTimer } = require('./timerManager');

// In-Memory Live Auctions Store
const auctions = {
  'AUC_VINTAGE_99': {
    id: 'AUC_VINTAGE_99',
    title: '1967 Vintage Fender Stratocaster',
    category: 'Musical Instruments & Antiques',
    image: 'https://images.unsplash.com/photo-1550291652-6ea9114a47b1?w=800&auto=format&fit=crop&q=80',
    description: 'Original condition rare Sunburst electric guitar in custom collector flight case.',
    startingPrice: 50000,
    currentBid: 50000,
    highestBidder: null, // { socketId, username }
    minIncrement: 2000,
    timeRemainingSeconds: 90,
    status: 'active',
    bidHistory: [],
    viewers: new Set(),
    timerInterval: null
  },
  'AUC_ROLEX_55': {
    id: 'AUC_ROLEX_55',
    title: 'Rolex Cosmograph Daytona Platinum',
    category: 'Luxury Watches & Jewelry',
    image: 'https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=800&auto=format&fit=crop&q=80',
    description: 'Ice blue dial with baguette diamond bezel and original manufacturer certificate.',
    startingPrice: 120000,
    currentBid: 120000,
    highestBidder: null,
    minIncrement: 5000,
    timeRemainingSeconds: 120,
    status: 'active',
    bidHistory: [],
    viewers: new Set(),
    timerInterval: null
  },
  'AUC_CYBER_77': {
    id: 'AUC_CYBER_77',
    title: 'Tesla Cybertruck Cyberbeast VIN #001',
    category: 'Exotic Vehicles',
    image: 'https://images.unsplash.com/photo-1563720223185-11003d516935?w=800&auto=format&fit=crop&q=80',
    description: 'Tri-motor all-wheel drive, ceramic matte armor finish, pristine zero-mileage.',
    startingPrice: 250000,
    currentBid: 250000,
    highestBidder: null,
    minIncrement: 10000,
    timeRemainingSeconds: 150,
    status: 'active',
    bidHistory: [],
    viewers: new Set(),
    timerInterval: null
  }
};

function initAuctions(io) {
  // Start server-side countdown timers for all active rooms
  Object.values(auctions).forEach(auction => {
    startAuctionTimer(io, auction);
  });
}

function registerAuctionHandlers(io, socket) {
  // 1. Join Auction Room
  socket.on('auction:join', ({ auctionId, username }) => {
    const safeAuctionId = auctionId || 'AUC_VINTAGE_99';
    const safeUsername = (username && username.trim()) || `Bidder_${Math.floor(Math.random() * 900 + 100)}`;
    const auction = auctions[safeAuctionId];

    if (!auction) {
      return socket.emit('auction:error', { message: 'Auction room not found' });
    }

    // Leave any previous room
    if (socket.currentAuctionId) {
      const prevAuction = auctions[socket.currentAuctionId];
      if (prevAuction) {
        prevAuction.viewers.delete(socket.id);
        socket.leave(socket.currentAuctionId);
        io.to(prevAuction.id).emit('user:joined', {
          username: socket.username,
          totalViewers: prevAuction.viewers.size
        });
      }
    }

    socket.join(safeAuctionId);
    socket.currentAuctionId = safeAuctionId;
    socket.username = safeUsername;
    auction.viewers.add(socket.id);

    // Initial state hydration to newly joined client
    socket.emit('auction:init', {
      item: {
        id: auction.id,
        title: auction.title,
        category: auction.category,
        image: auction.image,
        description: auction.description,
        startingPrice: auction.startingPrice,
        currentBid: auction.currentBid,
        minIncrement: auction.minIncrement,
        status: auction.status,
        highestBidder: auction.highestBidder ? auction.highestBidder.username : null
      },
      bidHistory: auction.bidHistory,
      timeRemaining: auction.timeRemainingSeconds,
      totalViewers: auction.viewers.size,
      availableAuctions: Object.values(auctions).map(a => ({
        id: a.id,
        title: a.title,
        currentBid: a.currentBid,
        timeRemaining: a.timeRemainingSeconds,
        status: a.status
      }))
    });

    // Notify room of viewer count update
    io.to(safeAuctionId).emit('user:joined', {
      username: safeUsername,
      totalViewers: auction.viewers.size
    });

    console.log(`🙋 ${safeUsername} joined auction room [${safeAuctionId}] (${auction.viewers.size} viewers)`);
  });

  // 2. Place Bid
  socket.on('bid:place', ({ auctionId, amount }) => {
    const safeAuctionId = auctionId || socket.currentAuctionId;
    const auction = auctions[safeAuctionId];
    const username = socket.username || 'Anonymous';
    const bidAmount = parseInt(amount, 10);

    if (!auction) {
      return socket.emit('bid:rejected', { reason: 'Auction does not exist' });
    }

    // Validation 1: Auction active & timer remaining
    if (auction.status !== 'active' || auction.timeRemainingSeconds <= 0) {
      return socket.emit('bid:rejected', { reason: 'This auction has ended and is closed for bidding' });
    }

    // Validation 2: Prevent self-outbidding
    if (auction.highestBidder && auction.highestBidder.socketId === socket.id) {
      return socket.emit('bid:rejected', { reason: 'You are already the highest bidder!' });
    }

    // Validation 3: Check minimum bid increment
    const minimumRequired = auction.currentBid + auction.minIncrement;
    if (isNaN(bidAmount) || bidAmount < minimumRequired) {
      return socket.emit('bid:rejected', {
        reason: `Bid too low. Minimum valid bid is ₹${minimumRequired.toLocaleString()}`
      });
    }

    // Capture previous highest bidder before state mutation
    const previousBidder = auction.highestBidder;

    // Mutate state authoritatively
    auction.currentBid = bidAmount;
    auction.highestBidder = {
      socketId: socket.id,
      username: username
    };

    const newHistoryRecord = {
      id: Date.now(),
      bidder: username,
      amount: bidAmount,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })
    };
    auction.bidHistory.unshift(newHistoryRecord);

    // Keep history capped at latest 50 records
    if (auction.bidHistory.length > 50) {
      auction.bidHistory.pop();
    }

    // Anti-Snipe Rule: If bid placed within last 15s, extend timer to 20s
    if (auction.timeRemainingSeconds < 15) {
      resetAuctionTimer(io, auction, 20);
    }

    // Broadcast new leading bid to entire room
    io.to(auction.id).emit('bid:success', {
      auctionId: auction.id,
      currentBid: auction.currentBid,
      highestBidder: username,
      bidHistory: auction.bidHistory,
      timeRemaining: auction.timeRemainingSeconds,
      minNextBid: auction.currentBid + auction.minIncrement
    });

    // Targeted outbid alert to the previous highest bidder
    if (previousBidder && previousBidder.socketId && previousBidder.socketId !== socket.id) {
      io.to(previousBidder.socketId).emit('bid:outbid', {
        auctionId: auction.id,
        itemTitle: auction.title,
        newBid: bidAmount,
        outbidBy: username,
        message: `⚠️ Alert! You have been outbid by ${username} at ₹${bidAmount.toLocaleString()}!`
      });
    }

    console.log(`💰 New Bid on [${auction.id}]: ₹${bidAmount.toLocaleString()} by ${username}`);
  });

  // 3. Reset / Restart Auction (for testing/demo convenience)
  socket.on('auction:restart', ({ auctionId }) => {
    const auction = auctions[auctionId];
    if (auction) {
      auction.status = 'active';
      auction.currentBid = auction.startingPrice;
      auction.highestBidder = null;
      auction.bidHistory = [];
      auction.timeRemainingSeconds = 90;
      startAuctionTimer(io, auction);

      io.to(auction.id).emit('auction:init', {
        item: {
          id: auction.id,
          title: auction.title,
          category: auction.category,
          image: auction.image,
          description: auction.description,
          startingPrice: auction.startingPrice,
          currentBid: auction.currentBid,
          minIncrement: auction.minIncrement,
          status: auction.status,
          highestBidder: null
        },
        bidHistory: [],
        timeRemaining: auction.timeRemainingSeconds,
        totalViewers: auction.viewers.size,
        availableAuctions: Object.values(auctions).map(a => ({
          id: a.id,
          title: a.title,
          currentBid: a.currentBid,
          timeRemaining: a.timeRemainingSeconds,
          status: a.status
        }))
      });
    }
  });

  // 4. Disconnect handling
  socket.on('disconnect', () => {
    if (socket.currentAuctionId) {
      const auction = auctions[socket.currentAuctionId];
      if (auction) {
        auction.viewers.delete(socket.id);
        io.to(auction.id).emit('user:joined', {
          username: socket.username,
          totalViewers: auction.viewers.size
        });
      }
    }
  });
}

module.exports = {
  auctions,
  initAuctions,
  registerAuctionHandlers
};
