const { v4: uuidv4 } = require("uuid");
const { startAuctionTimer, stopAuctionTimer } = require("./timerManager");

const initialAuctionsData = {
  "AUC_VINTAGE_99": {
    id: "AUC_VINTAGE_99",
    title: "1967 Vintage Fender Stratocaster",
    category: "Vintage Instruments",
    description: "Original condition rare electric guitar in Sunburst finish, all original hardware, pickups, and hard shell case included.",
    startingPrice: 50000,
    currentBid: 50000,
    highestBidder: null,
    minIncrement: 2000,
    timeRemainingSeconds: 60,
    initialTime: 60,
    status: "active",
    bidHistory: [],
    timerInterval: null
  },
  "AUC_ROLEX_77": {
    id: "AUC_ROLEX_77",
    title: "1972 Rolex Daytona 'Paul Newman'",
    category: "Horology & Luxury",
    description: "Exceedingly rare stainless steel chronograph watch with iconic exotic dial, original box & papers.",
    startingPrice: 150000,
    currentBid: 150000,
    highestBidder: null,
    minIncrement: 5000,
    timeRemainingSeconds: 90,
    initialTime: 90,
    status: "active",
    bidHistory: [],
    timerInterval: null
  },
  "AUC_ART_42": {
    id: "AUC_ART_42",
    title: "Banksy Signed Original Canvas Print",
    category: "Modern Art",
    description: "Authenticated stencil print on canvas, hand-signed and numbered by the artist with Pest Control COA.",
    startingPrice: 80000,
    currentBid: 80000,
    highestBidder: null,
    minIncrement: 3000,
    timeRemainingSeconds: 75,
    initialTime: 75,
    status: "active",
    bidHistory: [],
    timerInterval: null
  }
};

const auctions = {};
const socketUserMap = new Map();

function getCleanAuctionObject(auction) {
  return {
    id: auction.id,
    title: auction.title,
    category: auction.category,
    description: auction.description,
    startingPrice: auction.startingPrice,
    currentBid: auction.currentBid,
    highestBidder: auction.highestBidder ? auction.highestBidder.username : null,
    highestBidderSocketId: auction.highestBidder ? auction.highestBidder.socketId : null,
    minIncrement: auction.minIncrement,
    timeRemainingSeconds: auction.timeRemainingSeconds,
    status: auction.status,
    bidHistory: auction.bidHistory
  };
}

function getRoomViewersCount(io, auctionId) {
  const room = io.sockets.adapter.rooms.get(auctionId);
  return room ? room.size : 0;
}

function initializeAuctionEngine(io) {
  Object.keys(initialAuctionsData).forEach((id) => {
    auctions[id] = { ...initialAuctionsData[id], bidHistory: [] };
  });

  Object.values(auctions).forEach((auction) => {
    startAuctionTimer(io, auction);
  });

  io.on("connection", (socket) => {
    console.log(`Client Connected: ${socket.id}`);

    socket.on("auction:list", () => {
      const catalog = Object.values(auctions).map(getCleanAuctionObject);
      socket.emit("auction:catalog", catalog);
    });

    socket.on("auction:join", ({ auctionId, username }) => {
      const auction = auctions[auctionId];
      if (!auction) {
        return socket.emit("bid:rejected", { reason: `Auction ${auctionId} not found` });
      }

      const previousState = socketUserMap.get(socket.id);
      if (previousState && previousState.auctionId) {
        socket.leave(previousState.auctionId);
        const prevCount = getRoomViewersCount(io, previousState.auctionId);
        io.to(previousState.auctionId).emit("user:left", {
          username: previousState.username,
          totalViewers: prevCount
        });
      }

      socket.join(auctionId);
      socketUserMap.set(socket.id, { username, auctionId });

      const totalViewers = getRoomViewersCount(io, auctionId);

      socket.emit("auction:init", {
        item: getCleanAuctionObject(auction),
        bidHistory: auction.bidHistory,
        timeRemaining: auction.timeRemainingSeconds,
        totalViewers
      });

      io.to(auctionId).emit("user:joined", {
        username,
        totalViewers
      });
    });

    socket.on("bid:place", ({ auctionId, amount }) => {
      const userState = socketUserMap.get(socket.id);
      const username = userState ? userState.username : "Anonymous";
      const auction = auctions[auctionId];

      if (!auction) {
        return socket.emit("bid:rejected", { reason: "Invalid auction ID" });
      }

      handleBidPlacement(io, socket, auction, Number(amount), username);
    });

    socket.on("auction:reset", ({ auctionId }) => {
      const auction = auctions[auctionId];
      if (!auction) return;

      stopAuctionTimer(auction);

      const template = initialAuctionsData[auctionId];
      auction.currentBid = template.startingPrice;
      auction.highestBidder = null;
      auction.timeRemainingSeconds = template.initialTime;
      auction.status = "active";
      auction.bidHistory = [];

      startAuctionTimer(io, auction);

      const totalViewers = getRoomViewersCount(io, auctionId);

      io.to(auctionId).emit("auction:init", {
        item: getCleanAuctionObject(auction),
        bidHistory: auction.bidHistory,
        timeRemaining: auction.timeRemainingSeconds,
        totalViewers
      });

      io.to(auctionId).emit("auction:reset_event", {
        message: `Auction for "${auction.title}" has been reset.`
      });
    });

    socket.on("disconnect", () => {
      console.log(`Client Disconnected: ${socket.id}`);
      const userState = socketUserMap.get(socket.id);
      if (userState) {
        const { username, auctionId } = userState;
        socketUserMap.delete(socket.id);

        if (auctionId) {
          const totalViewers = getRoomViewersCount(io, auctionId);
          io.to(auctionId).emit("user:left", {
            username,
            totalViewers
          });
        }
      }
    });
  });
}

function handleBidPlacement(io, socket, auction, bidAmount, username) {
  if (auction.status !== "active" || auction.timeRemainingSeconds <= 0) {
    return socket.emit("bid:rejected", { reason: "Auction is closed" });
  }

  if (auction.highestBidder && auction.highestBidder.socketId === socket.id) {
    return socket.emit("bid:rejected", { reason: "You are already the highest bidder" });
  }

  const minimumRequired = auction.currentBid + auction.minIncrement;
  if (bidAmount < minimumRequired) {
    return socket.emit("bid:rejected", {
      reason: `Bid too low. Minimum valid bid is ₹${minimumRequired.toLocaleString('en-IN')}`
    });
  }

  const previousBidder = auction.highestBidder;

  auction.currentBid = bidAmount;
  auction.highestBidder = { socketId: socket.id, username };
  const newBidEntry = {
    id: uuidv4(),
    bidder: username,
    amount: bidAmount,
    timestamp: new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
  };
  auction.bidHistory.unshift(newBidEntry);

  let timerExtended = false;
  if (auction.timeRemainingSeconds < 15) {
    auction.timeRemainingSeconds = 20;
    timerExtended = true;
  }

  io.to(auction.id).emit("bid:success", {
    newBid: bidAmount,
    currentBid: auction.currentBid,
    highestBidder: username,
    bidHistory: auction.bidHistory,
    timeRemaining: auction.timeRemainingSeconds
  });

  if (timerExtended) {
    io.to(auction.id).emit("auction:extended", {
      timeRemaining: 20,
      message: "Anti-snipe triggered: +20 seconds added!"
    });
  }

  if (previousBidder && previousBidder.socketId !== socket.id) {
    io.to(previousBidder.socketId).emit("bid:outbid", {
      message: `You have been outbid by ${username} at ₹${bidAmount.toLocaleString('en-IN')}!`,
      amount: bidAmount,
      auctionId: auction.id
    });
  }
}

module.exports = {
  initializeAuctionEngine,
  auctions
};
