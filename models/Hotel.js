const mongoose = require("mongoose");

const hotelSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 150 },
    description: { type: String, trim: true, default: "", maxlength: 3000 },
    location: { type: String, required: true, trim: true, maxlength: 200 },
    country: { type: String, trim: true, default: "" },
    address: { type: String, trim: true, default: "" },
    subLocation: { type: String, trim: true, default: "" },
    propertyType: {
      type: String,
      trim: true,
      enum: ["Hotel", "Resort", "Villa", "Cottage", "Apartment", "Homestay", "Guest House"]
    },
    starCategory: { type: Number, default: 4, min: 1, max: 5 },
    earlyBirdDiscount: { type: Number, default: 0, min: 0, max: 100 },
    earlyBirdDays: { type: Number, default: 7, min: 0 },
    rating: { type: Number, default: 0, min: 0, max: 5 },
    ratingCount: { type: Number, default: 0, min: 0 },
    amenities: [{ type: String, trim: true }],
    bookingPreferences: [{ type: String, trim: true }],
    houseRules: [{ type: String, trim: true }],
    tags: [{ type: String, trim: true }],
    image: { type: String, trim: true, default: "" }
  },
  { timestamps: true }
);

hotelSchema.index({ name: "text", location: "text", description: "text" });

module.exports = mongoose.model("Hotel", hotelSchema);
