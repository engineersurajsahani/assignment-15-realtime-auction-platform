

const auctions = {
  AUC_VINTAGE_99: {
    id: 'AUC_VINTAGE_99',
    title: '1967 Vintage Fender Stratocaster',
    description: 'Original condition rare electric guitar',
    image: '🎸',
    startingPrice: 50000,
    currentBid: 50000,
    highestBidder: null,
    minIncrement: 2000,
    timeRemainingSeconds: 60,
    status: 'active',
    bidHistory: [],
    viewers: new Set(),
  },
  AUC_WATCH_07: {
    id: 'AUC_WATCH_07',
    title: 'Rolex Submariner (1978)',
    description: 'Classic diver watch, recently serviced',
    image: '⌚',
    startingPrice: 300000,
    currentBid: 300000,
    highestBidder: null,
    minIncrement: 10000,
    timeRemainingSeconds: 60,
    status: 'active',
    bidHistory: [],
    viewers: new Set(),
  },
  AUC_ART_23: {
    id: 'AUC_ART_23',
    title: 'Untitled Canvas — M. Rao (2019)',
    description: 'Contemporary abstract oil on canvas, 36x48in',
    image: '🖼️',
    startingPrice: 15000,
    currentBid: 15000,
    highestBidder: null,
    minIncrement: 1000,
    timeRemainingSeconds: 60,
    status: 'active',
    bidHistory: [],
    viewers: new Set(),
  },
};

function getAuction(auctionId) {
  return auctions[auctionId] || null;
}

function listAuctions() {
  return Object.values(auctions).map(serializeAuction);
}

function serializeAuction(auction) {
  const { viewers, ...rest } = auction;
  return { ...rest, totalViewers: viewers.size };
}

module.exports = { auctions, getAuction, listAuctions, serializeAuction };
