const { v4: uuidv4 } = require("uuid");
const { buildInitialAuctions } = require("../data/seedAuctions");
const { persistBid, hydrateBidHistory } = require("../data/auditStore");
const { stopCountdown, startCountdown } = require("./timerManager");

const auctions = buildInitialAuctions();

const MIN_SNIPE_SECONDS = 15;
const SNIPE_EXTEND_SECONDS = 20;
const MAX_HISTORY = 50;

const wallets = new Map();
const socketNames = new Map();

const sanitizeUsername = (raw) => (raw || "").toString().trim().slice(0, 24);

const simulateWallet = (username) => {
  let hash = 0;
  for (const char of username) {
    hash = (hash * 31 + char.charCodeAt(0)) >>> 0;
  }
  const balance = 70000 + (hash % 230000);
  return Math.round(balance / 100) * 100;
};

const getViewerCount = (io, auctionId) => {
  const room = io.sockets.adapter.rooms.get(auctionId);
  return room ? room.size : 0;
};

const broadcastViewerCount = (io, auctionId, username = null) => {
  io.to(auctionId).emit("user:joined", {
    username,
    totalViewers: getViewerCount(io, auctionId),
  });
};

const handleBidPlacement = async (io, socket, auction, bidAmount, username) => {
  if (auction.status !== "active" || auction.timeRemainingSeconds <= 0) {
    return socket.emit("bid:rejected", { reason: "Auction is closed" });
  }

  if (auction.highestBidder && auction.highestBidder.socketId === socket.id) {
    return socket.emit("bid:rejected", { reason: "You are already the highest bidder" });
  }

  const minimumRequired = auction.currentBid + auction.minIncrement;
  if (typeof bidAmount !== "number" || !Number.isFinite(bidAmount)) {
    return socket.emit("bid:rejected", { reason: `Enter a valid number. Minimum bid is ₹${minimumRequired}` });
  }
  if (bidAmount < minimumRequired) {
    return socket.emit("bid:rejected", {
      reason: `Bid too low. Minimum valid bid is ₹${minimumRequired.toLocaleString("en-IN")}`,
    });
  }

  const wallet = wallets.get(socket.id) || 0;
  if (bidAmount > wallet) {
    return socket.emit("bid:rejected", {
      reason: `Insufficient wallet balance. You have ₹${wallet.toLocaleString("en-IN")}`,
    });
  }

  const previousBidder = auction.highestBidder;

  auction.currentBid = bidAmount;
  auction.highestBidder = { socketId: socket.id, username };
  wallets.set(socket.id, wallet - bidAmount);

  const entry = {
    id: `bid_${uuidv4().slice(0, 8)}`,
    bidder: username,
    amount: bidAmount,
    timestamp: new Date().toLocaleTimeString("en-GB", {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    }),
  };
  auction.bidHistory.unshift(entry);
  if (auction.bidHistory.length > MAX_HISTORY) auction.bidHistory.pop();
  persistBid(auction.id, entry);

  if (auction.timeRemainingSeconds < MIN_SNIPE_SECONDS) {
    auction.timeRemainingSeconds = SNIPE_EXTEND_SECONDS;
    io.to(auction.id).emit("auction:extended", {
      timeRemaining: SNIPE_EXTEND_SECONDS,
      message: `Anti-snipe triggered: +${SNIPE_EXTEND_SECONDS} seconds added!`,
    });
  }

  io.to(auction.id).emit("bid:success", {
    newBid: auction.currentBid,
    highestBidder: username,
    minIncrement: auction.minIncrement,
    timeRemaining: auction.timeRemainingSeconds,
    bidHistory: auction.bidHistory,
  });

  socket.emit("bid:placed", {
    amount: bidAmount,
    walletBalance: wallets.get(socket.id),
  });

  if (previousBidder && previousBidder.socketId !== socket.id) {
    io.to(previousBidder.socketId).emit("bid:outbid", {
      message: `You have been outbid by ${username} at ₹${bidAmount.toLocaleString("en-IN")}!`,
    });
  }
};

const setupAuctionSockets = (io, socket) => {
  const joinAuction = async (payload) => {
    const auctionId = (payload && payload.auctionId || "").toString().trim();
    const username = sanitizeUsername(payload && payload.username);
    if (!auctionId || !auctions[auctionId]) {
      return socket.emit("auction:error", { message: "Auction does not exist" });
    }
    if (!username) {
      return socket.emit("auction:error", { message: "Username is required" });
    }

    for (const room of socket.rooms) {
      if (room !== socket.id) socket.leave(room);
    }

    socket.join(auctionId);
    const auction = auctions[auctionId];

    socketNames.set(socket.id, username);
    if (!wallets.has(socket.id)) {
      wallets.set(socket.id, simulateWallet(username));
    }

    await hydrateBidHistory(auction);

    socket.emit("auction:init", {
      socketId: socket.id,
      item: {
        id: auction.id,
        title: auction.title,
        description: auction.description,
        image: auction.image,
        startingPrice: auction.startingPrice,
        minIncrement: auction.minIncrement,
        currentBid: auction.currentBid,
        highestBidder: auction.highestBidder ? auction.highestBidder.username : null,
        status: auction.status,
      },
      bidHistory: auction.bidHistory,
      timeRemaining: auction.timeRemainingSeconds,
      walletBalance: wallets.get(socket.id),
    });

    broadcastViewerCount(io, auctionId);

    if (auction.status === "active" && !auction.timerInterval) {
      startCountdown(io, auction);
    }
  };

  const placeBid = (payload) => {
    const auctionId = (payload && payload.auctionId || "").toString().trim();
    const auction = auctions[auctionId];
    if (!auction) {
      return socket.emit("bid:rejected", { reason: "Auction does not exist" });
    }
    const participant = socketNames.get(socket.id);
    const username = participant || sanitizeUsername(payload && payload.username);
    handleBidPlacement(io, socket, auction, Number(payload && payload.amount), username);
  };

  socket.on("auction:join", joinAuction);
  socket.on("bid:place", placeBid);

  socket.on("disconnect", () => {
    for (const auctionId of socket.rooms) {
      if (auctionId !== socket.id && auctions[auctionId]) {
broadcastViewerCount(io, auctionId, username);
      }
    }
    wallets.delete(socket.id);
    socketNames.delete(socket.id);
  });
};

module.exports = { setupAuctionSockets, handleBidPlacement, auctions, wallets };