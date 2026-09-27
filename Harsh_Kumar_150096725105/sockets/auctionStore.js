const auctions = {
  "AUC_VINTAGE_99": {
    id: "AUC_VINTAGE_99",
    title: "1967 Vintage Fender Stratocaster",
    description: "Original condition rare electric guitar",
    startingPrice: 50000,
    currentBid: 50000,
    highestBidder: null,
    minIncrement: 2000,
    timeRemainingSeconds: 60,
    status: "active",
    bidHistory: [],
    timerInterval: null,
    viewers: new Set()
  }
};

function getAuctionSafe(id) {
  const auc = auctions[id];
  if (!auc) return null;
  const safeAuc = { ...auc };
  delete safeAuc.timerInterval;
  delete safeAuc.viewers;
  return safeAuc;
}

module.exports = {
  auctions,
  getAuctionSafe
};
