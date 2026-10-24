const mongoose = require("mongoose");
const User = require("../models/User");
const Hotel = require("../models/Hotel");
const Room = require("../models/Room");
const asyncHandler = require("../utils/asyncHandler");

const getWishlist = asyncHandler(async (req, res) => {
  if (req.user?.role === "admin") {
    return res.status(403).json({ success: false, code: "FORBIDDEN", message: "Admins cannot have a wishlist" });
  }

  const user = await User.findById(req.user._id).populate({
    path: "wishlist",
    select: "name location subLocation address rating ratingCount propertyType starCategory amenities image imageUrl description startingPrice earlyBirdDiscount earlyBirdDays tags bookingPreferences houseRules"
  });

  const hotels = (user?.wishlist || []).filter(Boolean);

  // Compute live starting prices and room counts
  const hotelIds = hotels.map((h) => h._id);
  const rooms = await Room.find({ hotel: { $in: hotelIds }, available: true }).select("hotel pricePerNight");

  const hotelRoomsMap = {};
  rooms.forEach((r) => {
    const hid = r.hotel.toString();
    if (!hotelRoomsMap[hid]) hotelRoomsMap[hid] = [];
    hotelRoomsMap[hid].push(r.pricePerNight);
  });

  const enriched = hotels.map((h) => {
    const obj = h.toObject ? h.toObject() : { ...h };
    const roomPrices = hotelRoomsMap[h._id.toString()] || [];
    const minPrice = roomPrices.length > 0 ? Math.min(...roomPrices) : (obj.startingPrice || 0);
    obj.startingPrice = minPrice;
    obj.matchingRoomsCount = roomPrices.length;
    return obj;
  });

  res.json({
    success: true,
    count: enriched.length,
    data: { wishlist: enriched, wishlistIds: enriched.map((h) => h._id.toString()) }
  });
});

const toggleWishlist = asyncHandler(async (req, res) => {
  if (req.user?.role === "admin") {
    return res.status(403).json({ success: false, code: "FORBIDDEN", message: "Admins cannot have a wishlist" });
  }
  const { hotelId } = req.params;
  if (!mongoose.isValidObjectId(hotelId)) {
    return res.status(400).json({ success: false, code: "VALIDATION_ERROR", message: "A valid hotel ID is required." });
  }

  const hotel = await Hotel.findById(hotelId).select("_id name");
  if (!hotel) {
    return res.status(404).json({ success: false, code: "HOTEL_NOT_FOUND", message: "Hotel not found." });
  }

  const user = await User.findById(req.user._id);
  const isWishlisted = (user.wishlist || []).some((id) => id.toString() === hotelId.toString());

  if (isWishlisted) {
    user.wishlist = (user.wishlist || []).filter((id) => id.toString() !== hotelId.toString());
    await user.save();
    return res.json({
      success: true,
      inWishlist: false,
      message: `Removed ${hotel.name} from your wishlist.`,
      data: { wishlistIds: user.wishlist.map((id) => id.toString()) }
    });
  } else {
    user.wishlist = user.wishlist || [];
    user.wishlist.push(hotel._id);
    await user.save();
    return res.json({
      success: true,
      inWishlist: true,
      message: `Added ${hotel.name} to your wishlist.`,
      data: { wishlistIds: user.wishlist.map((id) => id.toString()) }
    });
  }
});

const addToWishlist = asyncHandler(async (req, res) => {
  if (req.user?.role === "admin") {
    return res.status(403).json({ success: false, code: "FORBIDDEN", message: "Admins cannot have a wishlist" });
  }
  const { hotelId } = req.params;
  if (!mongoose.isValidObjectId(hotelId)) {
    return res.status(400).json({ success: false, code: "VALIDATION_ERROR", message: "A valid hotel ID is required." });
  }
  const hotel = await Hotel.findById(hotelId).select("_id name");
  if (!hotel) {
    return res.status(404).json({ success: false, code: "HOTEL_NOT_FOUND", message: "Hotel not found." });
  }

  const user = await User.findByIdAndUpdate(
    req.user._id,
    { $addToSet: { wishlist: hotel._id } },
    { new: true }
  );

  res.json({
    success: true,
    inWishlist: true,
    message: `Added ${hotel.name} to your wishlist.`,
    data: { wishlistIds: (user.wishlist || []).map((id) => id.toString()) }
  });
});

const removeFromWishlist = asyncHandler(async (req, res) => {
  if (req.user?.role === "admin") {
    return res.status(403).json({ success: false, code: "FORBIDDEN", message: "Admins cannot have a wishlist" });
  }
  const { hotelId } = req.params;
  if (!mongoose.isValidObjectId(hotelId)) {
    return res.status(400).json({ success: false, code: "VALIDATION_ERROR", message: "A valid hotel ID is required." });
  }

  const user = await User.findByIdAndUpdate(
    req.user._id,
    { $pull: { wishlist: hotelId } },
    { new: true }
  );

  res.json({
    success: true,
    inWishlist: false,
    message: "Removed from your wishlist.",
    data: { wishlistIds: (user.wishlist || []).map((id) => id.toString()) }
  });
});

module.exports = {
  getWishlist,
  toggleWishlist,
  addToWishlist,
  removeFromWishlist
};
