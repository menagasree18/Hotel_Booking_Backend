const Hotel = require("../models/Hotel");
const Rating = require("../models/Rating");
const Booking = require("../models/Booking");
const Room = require("../models/Room");
const mongoose = require("mongoose");
const asyncHandler = require("../utils/asyncHandler");
const { bookingDates } = require("../utils/validation");

const listHotels = asyncHandler(async (req, res) => {
  const { location, destination, search, checkIn, checkOut, guests, minPrice, maxPrice, type, category } = req.query;
  const roomCategory = type || category;

  const hotelConditions = [];

  const destTerm = destination && String(destination).trim();
  const locTerm = location && String(location).trim();

  if (destTerm) {
    const escaped = destTerm.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const fullRegex = new RegExp(escaped, "i");
    const words = destTerm.split(/[,\s]+/).map((w) => w.trim()).filter(Boolean);

    const wordConditions = words.map((w) => {
      const wRegex = new RegExp(w.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");
      return { $or: [{ location: wRegex }, { country: wRegex }, { subLocation: wRegex }, { address: wRegex }, { name: wRegex }] };
    });

    hotelConditions.push({
      $or: [
        { location: fullRegex },
        { country: fullRegex },
        { subLocation: fullRegex },
        { address: fullRegex },
        { name: fullRegex },
        ...(words.length > 1 ? [{ $and: wordConditions }] : [])
      ]
    });
  } else if (locTerm) {
    const locRegex = new RegExp(locTerm.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");
    hotelConditions.push({
      $or: [{ location: locRegex }, { country: locRegex }, { subLocation: locRegex }, { address: locRegex }, { name: locRegex }]
    });
  }

  if (search && String(search).trim()) {
    const sRegex = new RegExp(String(search).trim(), "i");
    hotelConditions.push({
      $or: [
        { name: sRegex },
        { location: sRegex },
        { address: sRegex },
        { description: sRegex }
      ]
    });
  }

  // Sidebar Filter: Property Type (Villa, Apartment, Hotel, Resort, Homestay, Guest House, Cottage)
  const propTypeParam = req.query.propertyType;
  if (propTypeParam) {
    const types = (Array.isArray(propTypeParam) ? propTypeParam : String(propTypeParam).split(","))
      .map((t) => t.trim())
      .filter(Boolean);
    if (types.length) {
      const typeRegexes = types.map((t) => new RegExp(`^${t.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`, "i"));
      hotelConditions.push({ propertyType: { $in: typeRegexes } });
    }
  }

  // Sidebar Filter: Star Category (3 Star, 4 Star, 5 Star)
  const starParam = req.query.starCategory || req.query.stars;
  if (starParam) {
    const stars = (Array.isArray(starParam) ? starParam : String(starParam).split(","))
      .map((s) => Number(String(s).trim()))
      .filter((n) => Number.isFinite(n) && n > 0);
    if (stars.length) {
      hotelConditions.push({ starCategory: { $in: stars } });
    }
  }

  // Sidebar Filter: Guest Rating (e.g. 4.5+, 4.0+, 3.5+, 3.0+)
  const ratingParam = req.query.minRating || req.query.rating;
  if (ratingParam !== undefined && ratingParam !== "" && ratingParam !== null) {
    const minR = Number(ratingParam);
    if (Number.isFinite(minR) && minR > 0) {
      hotelConditions.push({ rating: { $gte: minR } });
    }
  }

  // Sidebar Filter: Amenities (Swimming Pool, Gym, Wi-Fi, Breakfast Included, Parking, Air Conditioning)
  const amenitiesParam = req.query.amenities;
  if (amenitiesParam) {
    const amenList = (Array.isArray(amenitiesParam) ? amenitiesParam : String(amenitiesParam).split(","))
      .map((s) => s.trim())
      .filter(Boolean);
    if (amenList.length) {
      amenList.forEach((amenity) => {
        const aRegex = new RegExp(amenity.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");
        hotelConditions.push({ amenities: aRegex });
      });
    }
  }

  // Sidebar Filter: Booking Preferences (Free Cancellation, Instant Booking, Entire Villa/Apartment)
  const prefParam = req.query.bookingPreferences;
  if (prefParam) {
    const prefs = (Array.isArray(prefParam) ? prefParam : String(prefParam).split(","))
      .map((s) => s.trim())
      .filter(Boolean);
    if (prefs.length) {
      prefs.forEach((pref) => {
        const pRegex = new RegExp(pref.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");
        hotelConditions.push({ bookingPreferences: pRegex });
      });
    }
  }

  // Sidebar Filter: House Rules (Pets Allowed, Smoking Allowed, Self Check-In Available)
  const rulesParam = req.query.houseRules;
  if (rulesParam) {
    const rules = (Array.isArray(rulesParam) ? rulesParam : String(rulesParam).split(","))
      .map((s) => s.trim())
      .filter(Boolean);
    if (rules.length) {
      rules.forEach((rule) => {
        const rRegex = new RegExp(rule.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");
        hotelConditions.push({ houseRules: rRegex });
      });
    }
  }

  // Sidebar Filter: For You (Early Bird Deals, 5 Star, Self Check-In Available, Beachfront Properties)
  const forYouParam = req.query.forYou || req.query.tags;
  if (forYouParam) {
    const forYouList = (Array.isArray(forYouParam) ? forYouParam : String(forYouParam).split(","))
      .map((s) => s.trim())
      .filter(Boolean);
    if (forYouList.length) {
      forYouList.forEach((item) => {
        const itemLower = item.toLowerCase();
        if (itemLower.includes("5 star")) {
          hotelConditions.push({ $or: [{ starCategory: 5 }, { rating: { $gte: 4.8 } }] });
        } else if (itemLower.includes("beachfront")) {
          hotelConditions.push({
            $or: [
              { tags: new RegExp("Beachfront", "i") },
              { amenities: new RegExp("Beachfront", "i") },
              { amenities: new RegExp("Beach Access", "i") },
              { description: new RegExp("Beachfront", "i") }
            ]
          });
        } else if (itemLower.includes("early bird")) {
          let daysInAdvance = null;
          if (checkIn) {
            try {
              const today = new Date();
              today.setHours(0, 0, 0, 0);
              const cIn = new Date(checkIn);
              cIn.setHours(0, 0, 0, 0);
              daysInAdvance = Math.ceil((cIn - today) / (1000 * 60 * 60 * 24));
            } catch (e) {}
          }
          if (daysInAdvance !== null && daysInAdvance >= 0) {
            hotelConditions.push({
              earlyBirdDiscount: { $gt: 0 },
              earlyBirdDays: { $lte: daysInAdvance }
            });
          } else {
            hotelConditions.push({
              $or: [
                { earlyBirdDiscount: { $gt: 0 } },
                { tags: new RegExp("Early Bird", "i") }
              ]
            });
          }
        } else if (itemLower.includes("self check-in") || itemLower.includes("self checkin")) {
          hotelConditions.push({
            $or: [
              { tags: new RegExp("Self Check-In", "i") },
              { houseRules: new RegExp("Self Check-In", "i") }
            ]
          });
        } else {
          const tRegex = new RegExp(item.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");
          hotelConditions.push({ tags: tRegex });
        }
      });
    }
  }

  // Sidebar Filter: Top Locations
  const subLocParam = req.query.subLocation || req.query.topLocation;
  if (subLocParam && String(subLocParam).trim()) {
    const subRegex = new RegExp(String(subLocParam).trim().replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");
    hotelConditions.push({
      $or: [{ subLocation: subRegex }, { address: subRegex }]
    });
  }

  const hotelFilter = hotelConditions.length > 1
    ? { $and: hotelConditions }
    : hotelConditions.length === 1
      ? hotelConditions[0]
      : {};

  let hotels = await Hotel.find(hotelFilter).sort({ createdAt: -1 });

  const hasMinPrice = minPrice !== undefined && minPrice !== "" && minPrice !== null;
  const hasMaxPrice = maxPrice !== undefined && maxPrice !== "" && maxPrice !== null;

  if (hasMinPrice && (!Number.isFinite(Number(minPrice)) || Number(minPrice) < 0)) {
    return res.status(400).json({ success: false, code: "VALIDATION_ERROR", message: "minPrice must be a valid non-negative amount." });
  }
  if (hasMaxPrice && (!Number.isFinite(Number(maxPrice)) || Number(maxPrice) <= 0)) {
    return res.status(400).json({ success: false, code: "VALIDATION_ERROR", message: "maxPrice must be a positive amount." });
  }
  if (hasMinPrice && hasMaxPrice && Number(minPrice) > Number(maxPrice)) {
    return res.status(400).json({ success: false, code: "VALIDATION_ERROR", message: "minPrice cannot exceed maxPrice." });
  }
  if ((checkIn || checkOut) && (!checkIn || !checkOut)) {
    return res.status(400).json({ success: false, code: "VALIDATION_ERROR", message: "Provide both checkIn and checkOut dates." });
  }

  const hotelIds = hotels.map((h) => h._id);

  const roomFilter = {
    hotel: { $in: hotelIds },
    available: true
  };

  if (roomCategory && String(roomCategory).trim() && String(roomCategory).trim().toLowerCase() !== "all") {
    roomFilter.type = { $regex: `^${String(roomCategory).trim()}$`, $options: "i" };
  }

  if (guests && Number(guests) > 0) {
    roomFilter.capacity = { $gte: Number(guests) };
  }

  const priceFilter = {};
  if (hasMinPrice) priceFilter.$gte = Number(minPrice);
  if (hasMaxPrice) priceFilter.$lte = Number(maxPrice);
  if (Object.keys(priceFilter).length) {
    roomFilter.pricePerNight = priceFilter;
  }

  if (checkIn && checkOut) {
    const dates = bookingDates(checkIn, checkOut);
    roomFilter.reservations = {
      $not: {
        $elemMatch: {
          checkIn: { $lt: dates.checkOut },
          checkOut: { $gt: dates.checkIn }
        }
      }
    };
  }

  const matchingRooms = await Room.find(roomFilter)
    .select(req.user?.role === "admin" ? "-reservations" : "-reservations -roomNumber")
    .populate("hotel", "name location subLocation address rating ratingCount propertyType starCategory amenities bookingPreferences houseRules tags image imageUrl description earlyBirdDiscount earlyBirdDays")
    .sort({ pricePerNight: 1 });

  const roomsByHotel = new Map();
  matchingRooms.forEach((room) => {
    const key = String(room.hotel?._id || room.hotel);
    if (!roomsByHotel.has(key)) {
      roomsByHotel.set(key, []);
    }
    roomsByHotel.get(key).push(room);
  });

  let enrichedHotels = hotels
    .filter((hotel) => roomsByHotel.has(String(hotel._id)))
    .map((hotel) => {
      const hotelRooms = roomsByHotel.get(String(hotel._id)) || [];
      const minRoomPrice = Math.min(...hotelRooms.map((r) => r.pricePerNight));
      return {
        ...hotel.toObject(),
        startingPrice: minRoomPrice,
        matchingRoomsCount: hotelRooms.length,
        rooms: hotelRooms,
        earlyBirdDiscount: Number(hotel.earlyBirdDiscount || 0),
        earlyBirdDays: Number(hotel.earlyBirdDays || 7)
      };
    });

  const sort = req.query.sort;
  if (sort === "price_asc") {
    enrichedHotels.sort((a, b) => a.startingPrice - b.startingPrice);
  } else if (sort === "price_desc") {
    enrichedHotels.sort((a, b) => b.startingPrice - a.startingPrice);
  } else if (sort === "rating_desc") {
    enrichedHotels.sort((a, b) => (b.rating || 0) - (a.rating || 0));
  } else {
    // Default sorting: higher rating and popularity first
    enrichedHotels.sort((a, b) => (b.rating || 0) - (a.rating || 0));
  }

  res.json({
    success: true,
    count: enrichedHotels.length,
    data: {
      hotels: enrichedHotels,
      rooms: matchingRooms,
      totalRooms: matchingRooms.length
    }
  });
});

const getHotel = asyncHandler(async (req, res) => {
  const hotel = await Hotel.findById(req.params.id);
  if (!hotel) return res.status(404).json({ success: false, code: "HOTEL_NOT_FOUND", message: "Hotel not found." });

  const { checkIn, checkOut, guests, minPrice, maxPrice } = req.query;

  const allRooms = await Room.find({ hotel: hotel._id, available: true })
    .select("-reservations -roomNumber")
    .sort({ pricePerNight: 1 });

  const roomFilter = { hotel: hotel._id, available: true };

  const hasMinPrice = minPrice !== undefined && minPrice !== "" && minPrice !== null;
  const hasMaxPrice = maxPrice !== undefined && maxPrice !== "" && maxPrice !== null;

  if (hasMinPrice && Number.isFinite(Number(minPrice)) && Number(minPrice) >= 0) {
    roomFilter.pricePerNight = roomFilter.pricePerNight || {};
    roomFilter.pricePerNight.$gte = Number(minPrice);
  }
  if (hasMaxPrice && Number.isFinite(Number(maxPrice)) && Number(maxPrice) > 0) {
    roomFilter.pricePerNight = roomFilter.pricePerNight || {};
    roomFilter.pricePerNight.$lte = Number(maxPrice);
  }
  if (guests && Number(guests) > 0) {
    roomFilter.capacity = { $gte: Number(guests) };
  }
  if (checkIn && checkOut) {
    try {
      const dates = bookingDates(checkIn, checkOut);
      roomFilter.reservations = {
        $not: {
          $elemMatch: {
            checkIn: { $lt: dates.checkOut },
            checkOut: { $gt: dates.checkIn }
          }
        }
      };
    } catch (e) {
      // ignore invalid dates
    }
  }

  const matchingRooms = await Room.find(roomFilter)
    .select("-reservations -roomNumber")
    .sort({ pricePerNight: 1 });

  res.json({
    success: true,
    data: {
      hotel,
      rooms: matchingRooms,
      allRooms
    }
  });
});

const getMyRating = asyncHandler(async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.id)) {
    return res.status(400).json({ success: false, code: "VALIDATION_ERROR", message: "A valid hotel ID is required." });
  }
  const hotel = await Hotel.findById(req.params.id).select("_id");
  if (!hotel) return res.status(404).json({ success: false, code: "HOTEL_NOT_FOUND", message: "Hotel not found." });
  const [rating, roomIds] = await Promise.all([
    Rating.findOne({ user: req.user._id, hotel: hotel._id }).select("stars review"),
    Room.distinct("_id", { hotel: hotel._id })
  ]);
  const canRate = req.user.role === "user" && Boolean(await Booking.exists({
    user: req.user._id,
    room: { $in: roomIds },
    status: { $in: ["confirmed", "completed"] }
  }));
  res.json({ success: true, data: { rating, canRate } });
});

const rateHotel = asyncHandler(async (req, res) => {
  if (req.user.role !== "user") {
    return res.status(403).json({ success: false, code: "FORBIDDEN", message: "Only guests can rate hotels." });
  }
  if (!mongoose.isValidObjectId(req.params.id)) {
    return res.status(400).json({ success: false, code: "VALIDATION_ERROR", message: "A valid hotel ID is required." });
  }
  const stars = req.body.stars;
  const review = typeof req.body.review === "string" ? req.body.review.trim() : "";
  if (typeof stars !== "number" || !Number.isInteger(stars) || stars < 1 || stars > 5) {
    return res.status(400).json({ success: false, code: "VALIDATION_ERROR", message: "stars must be a whole number from 1 to 5." });
  }
  if (typeof req.body.review !== "undefined" && (typeof req.body.review !== "string" || review.length > 1000)) {
    return res.status(400).json({ success: false, code: "VALIDATION_ERROR", message: "Review must be 1000 characters or fewer." });
  }
  const hotel = await Hotel.findById(req.params.id).select("_id");
  if (!hotel) return res.status(404).json({ success: false, code: "HOTEL_NOT_FOUND", message: "Hotel not found." });

  const roomIds = await Room.distinct("_id", { hotel: hotel._id });
  const hasConfirmedBooking = await Booking.exists({
    user: req.user._id,
    room: { $in: roomIds },
    status: { $in: ["confirmed", "completed"] }
  });
  if (!hasConfirmedBooking) {
    return res.status(403).json({ success: false, code: "BOOKING_REQUIRED", message: "Book this hotel to rate it" });
  }

  await Rating.findOneAndUpdate(
    { user: req.user._id, hotel: hotel._id },
    { $set: { stars, review }, $setOnInsert: { user: req.user._id, hotel: hotel._id } },
    { upsert: true, new: true, runValidators: true, setDefaultsOnInsert: true }
  );
  const [average] = await Rating.aggregate([
    { $match: { hotel: hotel._id } },
    { $group: { _id: "$hotel", average: { $avg: "$stars" }, count: { $sum: 1 } } }
  ]);
  const updatedHotel = await Hotel.findByIdAndUpdate(
    hotel._id,
    { $set: { rating: Math.round(average.average * 10) / 10, ratingCount: average.count } },
    { new: true, runValidators: true }
  ).select("rating ratingCount");
  const rating = await Rating.findOne({ user: req.user._id, hotel: hotel._id }).select("stars review");
  res.json({ success: true, data: { rating, hotel: updatedHotel } });
});

const listHotelReviews = asyncHandler(async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.id)) {
    return res.status(400).json({ success: false, code: "VALIDATION_ERROR", message: "A valid hotel ID is required." });
  }
  const hotel = await Hotel.findById(req.params.id).select("_id");
  if (!hotel) return res.status(404).json({ success: false, code: "HOTEL_NOT_FOUND", message: "Hotel not found." });
  const reviews = await Rating.find({ hotel: hotel._id, review: { $type: "string", $ne: "" } })
    .sort({ createdAt: -1 })
    .populate("user", "name")
    .select("stars review createdAt user adminReply adminRepliedAt adminRepliedBy");
  res.json({ success: true, count: reviews.length, data: { reviews } });
});

const listAllReviews = asyncHandler(async (req, res) => {
  const reviews = await Rating.find({ review: { $type: "string", $ne: "" } })
    .sort({ createdAt: -1 })
    .populate("user", "name email")
    .populate("hotel", "name location")
    .select("stars review createdAt user hotel adminReply adminRepliedAt adminRepliedBy");
  res.json({ success: true, count: reviews.length, data: { reviews } });
});

const replyToReview = asyncHandler(async (req, res) => {
  if (req.user?.role !== "admin") {
    return res.status(403).json({ success: false, code: "FORBIDDEN", message: "Only administrators can reply to reviews." });
  }
  if (!mongoose.isValidObjectId(req.params.id)) {
    return res.status(400).json({ success: false, code: "VALIDATION_ERROR", message: "A valid review ID is required." });
  }
  const rating = await Rating.findById(req.params.id);
  if (!rating) {
    return res.status(404).json({ success: false, code: "REVIEW_NOT_FOUND", message: "Review not found." });
  }

  const rawReply = typeof req.body.reply === "string"
    ? req.body.reply.trim()
    : typeof req.body.adminReply === "string"
      ? req.body.adminReply.trim()
      : "";

  if (!rawReply) {
    return res.status(400).json({ success: false, code: "VALIDATION_ERROR", message: "Reply text is required." });
  }
  if (rawReply.length > 1000) {
    return res.status(400).json({ success: false, code: "VALIDATION_ERROR", message: "Reply must be 1000 characters or fewer." });
  }

  rating.adminReply = rawReply;
  rating.adminRepliedAt = new Date();
  rating.adminRepliedBy = {
    id: req.user._id,
    name: req.user.name || "Hotel Administrator"
  };

  await rating.save();
  const populated = await Rating.findById(rating._id)
    .populate("user", "name email")
    .populate("hotel", "name location");
  res.json({ success: true, data: { rating: populated } });
});

const deleteReviewReply = asyncHandler(async (req, res) => {
  if (req.user?.role !== "admin") {
    return res.status(403).json({ success: false, code: "FORBIDDEN", message: "Only administrators can manage review replies." });
  }
  if (!mongoose.isValidObjectId(req.params.id)) {
    return res.status(400).json({ success: false, code: "VALIDATION_ERROR", message: "A valid review ID is required." });
  }
  const rating = await Rating.findById(req.params.id);
  if (!rating) {
    return res.status(404).json({ success: false, code: "REVIEW_NOT_FOUND", message: "Review not found." });
  }
  rating.adminReply = "";
  rating.adminRepliedAt = null;
  rating.adminRepliedBy = undefined;
  await rating.save();
  const populated = await Rating.findById(rating._id)
    .populate("user", "name email")
    .populate("hotel", "name location");
  res.json({ success: true, message: "Reply removed.", data: { rating: populated } });
});

const normalizeLocation = (loc) => {
  if (!loc) return "";
  let str = String(loc).trim();
  // Normalize commas and extra spaces
  str = str.replace(/\s*,\s*/g, ", ").trim();
  // Capitalize each word properly (Title Case)
  return str
    .split(/\s+/)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(" ");
};

const createHotel = asyncHandler(async (req, res) => {
  const { rating, ratingCount, ...hotelDetails } = req.body;
  if (hotelDetails.location) {
    hotelDetails.location = normalizeLocation(hotelDetails.location);
  }
  if (hotelDetails.earlyBirdDiscount !== undefined) {
    hotelDetails.earlyBirdDiscount = Number(hotelDetails.earlyBirdDiscount) || 0;
    hotelDetails.earlyBirdDays = Number(hotelDetails.earlyBirdDays) || 7;
    let tags = Array.isArray(hotelDetails.tags) ? [...hotelDetails.tags] : [];
    if (hotelDetails.earlyBirdDiscount > 0 && !tags.some((t) => t.toLowerCase().includes("early bird"))) {
      tags.push("Early Bird Deals");
    } else if (hotelDetails.earlyBirdDiscount <= 0) {
      tags = tags.filter((t) => !t.toLowerCase().includes("early bird"));
    }
    hotelDetails.tags = tags;
  }
  const hotel = await Hotel.create(hotelDetails);
  res.status(201).json({ success: true, data: { hotel } });
});

const updateHotel = asyncHandler(async (req, res) => {
  const { rating, ratingCount, ...hotelDetails } = req.body;
  if (hotelDetails.location) {
    hotelDetails.location = normalizeLocation(hotelDetails.location);
  }
  if (hotelDetails.earlyBirdDiscount !== undefined) {
    hotelDetails.earlyBirdDiscount = Number(hotelDetails.earlyBirdDiscount) || 0;
    hotelDetails.earlyBirdDays = Number(hotelDetails.earlyBirdDays) || 7;
    const existing = await Hotel.findById(req.params.id);
    let tags = Array.isArray(hotelDetails.tags)
      ? [...hotelDetails.tags]
      : Array.isArray(existing?.tags)
        ? [...existing.tags]
        : [];
    if (hotelDetails.earlyBirdDiscount > 0 && !tags.some((t) => t.toLowerCase().includes("early bird"))) {
      tags.push("Early Bird Deals");
    } else if (hotelDetails.earlyBirdDiscount <= 0) {
      tags = tags.filter((t) => !t.toLowerCase().includes("early bird"));
    }
    hotelDetails.tags = tags;
  }
  const hotel = await Hotel.findByIdAndUpdate(req.params.id, hotelDetails, {
    new: true,
    runValidators: true,
    omitUndefined: true
  });
  if (!hotel) return res.status(404).json({ success: false, code: "HOTEL_NOT_FOUND", message: "Hotel not found." });
  res.json({ success: true, data: { hotel } });
});

const deleteHotel = asyncHandler(async (req, res) => {
  const hotel = await Hotel.findById(req.params.id);
  if (!hotel) return res.status(404).json({ success: false, code: "HOTEL_NOT_FOUND", message: "Hotel not found." });
  const rooms = await Room.find({ hotel: hotel._id }).select("_id");
  const roomIds = rooms.map((room) => room._id);
  const Booking = require("../models/Booking");
  const activeBooking = await Booking.exists({ room: { $in: roomIds }, status: { $ne: "cancelled" } });
  if (activeBooking) {
    return res.status(409).json({ success: false, code: "HOTEL_HAS_BOOKINGS", message: "Cancel active bookings before deleting this hotel." });
  }
  await Room.deleteMany({ hotel: hotel._id });
  await hotel.deleteOne();
  res.json({ success: true, message: "Hotel and its rooms were deleted." });
});

const getDestinations = asyncHandler(async (req, res) => {
  res.set("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate");
  res.set("Pragma", "no-cache");
  res.set("Expires", "0");

  const hotels = await Hotel.find({}).select("location country").lean();
  const destMap = new Map();

  hotels.forEach((hotel) => {
    const parts = [];
    if (hotel.location && typeof hotel.location === "string") {
      hotel.location.split(",").forEach((p) => {
        const trimmed = p.trim();
        if (trimmed) parts.push(trimmed);
      });
    }
    if (hotel.country && typeof hotel.country === "string") {
      const trimmedCountry = hotel.country.trim();
      if (trimmedCountry) parts.push(trimmedCountry);
    }

    parts.forEach((item) => {
      const key = item.toLowerCase();
      if (!destMap.has(key)) {
        const formatted = item === item.toLowerCase()
          ? item.split(/\s+/).map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(" ")
          : item;
        destMap.set(key, formatted);
      }
    });
  });

  const destinations = Array.from(destMap.values()).sort((a, b) =>
    a.localeCompare(b, undefined, { sensitivity: "base" })
  );

  res.json({ success: true, data: { destinations } });
});

module.exports = {
  listHotels,
  getDestinations,
  getHotel,
  getMyRating,
  rateHotel,
  listHotelReviews,
  listAllReviews,
  replyToReview,
  deleteReviewReply,
  createHotel,
  updateHotel,
  deleteHotel
};
