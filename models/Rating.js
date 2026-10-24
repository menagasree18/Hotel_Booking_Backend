const mongoose = require("mongoose");

const ratingSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  hotel: { type: mongoose.Schema.Types.ObjectId, ref: "Hotel", required: true },
  stars: { type: Number, required: true, min: 1, max: 5 },
  review: { type: String, trim: true, maxlength: 1000, default: "" },
  adminReply: { type: String, trim: true, maxlength: 1000, default: "" },
  adminRepliedAt: { type: Date },
  adminRepliedBy: {
    id: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    name: { type: String, trim: true }
  },
  createdAt: { type: Date, default: Date.now }
});

ratingSchema.index({ user: 1, hotel: 1 }, { unique: true });

module.exports = mongoose.model("Rating", ratingSchema);
