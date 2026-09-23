const mongoose = require("mongoose");

const auctionSchema = new mongoose.Schema(
  {
    auctionId: { type: String, required: true, unique: true },
    title: { type: String, required: true },
    description: { type: String, default: "" },
    image: { type: String, default: "" },
    startingPrice: { type: Number, required: true },
    minIncrement: { type: Number, required: true },
    durationSeconds: { type: Number, required: true },
    status: {
      type: String,
      enum: ["upcoming", "active", "ended"],
      default: "updated",
    },
    currentBid: { type: Number, default: 0 },
    winner: { type: String, default: null },
    finalPrice: { type: Number, default: null },
  },
  {
    timestamps: { createdAt: true, updatedAt: true },
    versionKey: false,
  }
);

const Auction = mongoose.model("Auction", auctionSchema);

module.exports = Auction;