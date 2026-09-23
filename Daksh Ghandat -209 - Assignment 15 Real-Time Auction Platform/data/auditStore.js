const Bid = require("../models/Bid");
const Auction = require("../models/Auction");

const MAX_HISTORY = 50;

async function persistBid(auctionId, bidObj) {
  try {
    await Bid.create({
      auctionId,
      bidder: bidObj.bidder,
      amount: bidObj.amount,
      timestamp: bidObj.timestamp,
    });
  } catch (error) {
    console.error(`Failed to persist bid to MongoDB: ${error.message}`);
  }
}

async function persistAuctionResult(auction) {
  try {
    await Auction.findOneAndUpdate(
      { auctionId: auction.id },
      {
        auctionId: auction.id,
        title: auction.title,
        description: auction.description,
        image: auction.image,
        startingPrice: auction.startingPrice,
        minIncrement: auction.minIncrement,
        durationSeconds: auction.totalDurationSeconds,
        status: auction.status,
        currentBid: auction.currentBid,
        winner: auction.highestBidder ? auction.highestBidder.username : null,
        finalPrice: auction.currentBid,
      },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );
  } catch (error) {
    console.error(`Failed to persist auction result: ${error.message}`);
  }
}

async function hydrateBidHistory(auction) {
  if (auction.bidHistory.length > 0) return auction.bidHistory;
  if (Auction.db.readyState !== 1) return auction.bidHistory;
  try {
    const docs = await Bid.find({ auctionId: auction.id })
      .sort({ _id: -1 })
      .limit(MAX_HISTORY);
    if (docs.length > 0) {
      auction.bidHistory = docs.map((d) => ({
        id: d._id.toString(),
        bidder: d.bidder,
        amount: d.amount,
        timestamp: d.timestamp,
      }));
      auction.currentBid = docs[0].amount;
    }
    return auction.bidHistory;
  } catch (error) {
    console.error(`Failed to hydrate bid history for "${auction.id}": ${error.message}`);
    return auction.bidHistory;
  }
}

module.exports = { persistBid, persistAuctionResult, hydrateBidHistory, MAX_HISTORY };