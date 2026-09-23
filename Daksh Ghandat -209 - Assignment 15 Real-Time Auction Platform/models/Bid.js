const mongoose = require("mongoose");

const bidSchema = new mongoose.Schema(
  {
    auctionId: { type: String, required: true, index: true },
    bidder: { type: String, required: true },
    amount: { type: Number, required: true },
    timestamp: { type: String, default: "" },
  },
  {
    timestamps: { createdAt: true, updatedAt: false },
    versionKey: false,
  }
);

const Bid = mongoose.model("Bid", bidSchema);

module.exports = Bid;