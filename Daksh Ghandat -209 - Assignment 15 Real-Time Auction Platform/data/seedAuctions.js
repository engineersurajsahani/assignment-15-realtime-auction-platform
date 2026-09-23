const seedAuctions = require("./auctions.seed.json");

const buildInitialAuctions = () => {
  const auctions = {};
  for (const seed of seedAuctions) {
    auctions[seed.id] = {
      id: seed.id,
      title: seed.title,
      description: seed.description,
      image: seed.image,
      startingPrice: seed.startingPrice,
      currentBid: seed.startingPrice,
      highestBidder: null,
      minIncrement: seed.minIncrement,
      timeRemainingSeconds: seed.durationSeconds,
      totalDurationSeconds: seed.durationSeconds,
      status: "active",
      bidHistory: [],
      timerInterval: null,
    };
  }
  return auctions;
};

module.exports = { seedAuctions, buildInitialAuctions };