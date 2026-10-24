const Hotel = require("../models/Hotel");
const Room = require("../models/Room");
const Booking = require("../models/Booking");
const asyncHandler = require("../utils/asyncHandler");
const { bookingDates } = require("../utils/validation");

const listRooms = asyncHandler(async (req, res) => {
  const { hotel, type, category, minPrice, maxPrice, guests, destination, location, search, checkIn, checkOut } = req.query;
  const roomCategory = type || category;

  const hotelConditions = [];
  const destTerm = destination && String(destination).trim();
  const locTerm = location && String(location).trim();

  if (destTerm && locTerm) {
    const destRegex = new RegExp(destTerm, "i");
    const locRegex = new RegExp(locTerm, "i");
    hotelConditions.push({ $or: [{ location: destRegex }, { address: destRegex }, { name: destRegex }] });
    hotelConditions.push({ $or: [{ location: locRegex }, { address: locRegex }] });
  } else if (destTerm) {
    const destRegex = new RegExp(destTerm, "i");
    hotelConditions.push({ $or: [{ location: destRegex }, { address: destRegex }, { name: destRegex }] });
  } else if (locTerm) {
    const locRegex = new RegExp(locTerm, "i");
    hotelConditions.push({ $or: [{ location: locRegex }, { address: locRegex }, { name: locRegex }] });
  }

  if (search && String(search).trim()) {
    const sRegex = new RegExp(String(search).trim(), "i");
    hotelConditions.push({ $or: [{ name: sRegex }, { location: sRegex }, { address: sRegex }, { description: sRegex }] });
  }

  let matchingHotelIds = null;
  if (hotelConditions.length > 0) {
    const hotelFilter = hotelConditions.length > 1 ? { $and: hotelConditions } : hotelConditions[0];
    const matchingHotels = await Hotel.find(hotelFilter).select("_id");
    matchingHotelIds = matchingHotels.map((h) => h._id);
  }

  const filter = { available: true };
  if (hotel) {
    filter.hotel = hotel;
  } else if (matchingHotelIds !== null) {
    filter.hotel = { $in: matchingHotelIds };
  }

  if (roomCategory && String(roomCategory).trim() && String(roomCategory).trim().toLowerCase() !== "all") {
    filter.type = { $regex: `^${String(roomCategory).trim()}$`, $options: "i" };
  }

  const hasMinPrice = minPrice !== undefined && minPrice !== "" && minPrice !== null;
  const hasMaxPrice = maxPrice !== undefined && maxPrice !== "" && maxPrice !== null;
  if (hasMinPrice || hasMaxPrice) {
    filter.pricePerNight = {};
    if (hasMinPrice) filter.pricePerNight.$gte = Number(minPrice);
    if (hasMaxPrice) filter.pricePerNight.$lte = Number(maxPrice);
  }

  if (guests && Number(guests) > 0) {
    filter.capacity = { $gte: Number(guests) };
  }

  if (checkIn && checkOut) {
    const dates = bookingDates(checkIn, checkOut);
    filter.reservations = {
      $not: {
        $elemMatch: {
          checkIn: { $lt: dates.checkOut },
          checkOut: { $gt: dates.checkIn }
        }
      }
    };
  }

  const roomProjection = req.user?.role === "admin" ? "-reservations" : "-reservations -roomNumber";
  const rooms = await Room.find(filter)
    .select(roomProjection)
    .populate("hotel", "name location address rating ratingCount image imageUrl description earlyBirdDiscount earlyBirdDays tags");

  const validRooms = rooms.filter((r) => r.hotel && r.hotel.name);

  validRooms.sort((a, b) => {
    const hA = (a.hotel?.name || "").trim().toLowerCase();
    const hB = (b.hotel?.name || "").trim().toLowerCase();
    const hCmp = hA.localeCompare(hB, undefined, { sensitivity: "base" });
    if (hCmp !== 0) return hCmp;
    const idA = String(a.hotel?._id || a.hotel || "");
    const idB = String(b.hotel?._id || b.hotel || "");
    const idCmp = idA.localeCompare(idB);
    if (idCmp !== 0) return idCmp;
    return String(a.roomNumber || "").localeCompare(String(b.roomNumber || ""), undefined, { numeric: true, sensitivity: "base" });
  });

  res.json({ success: true, count: validRooms.length, data: { rooms: validRooms } });
});

const getRoom = asyncHandler(async (req, res) => {
  const room = await Room.findOne({ _id: req.params.id, available: true })
    .select(req.user?.role === "admin" ? "-reservations" : "-reservations -roomNumber")
    .populate("hotel", "name location image earlyBirdDiscount earlyBirdDays tags");
  if (!room) return res.status(404).json({ success: false, code: "ROOM_NOT_FOUND", message: "Room not found." });
  res.json({ success: true, data: { room } });
});

const createRoom = asyncHandler(async (req, res) => {
  const hotel = await Hotel.findById(req.body.hotel);
  if (!hotel) return res.status(404).json({ success: false, code: "HOTEL_NOT_FOUND", message: "Hotel not found." });
  const room = await Room.create(req.body);
  res.status(201).json({ success: true, data: { room } });
});

const updateRoom = asyncHandler(async (req, res) => {
  const updates = { ...req.body };
  delete updates.reservations;
  const room = await Room.findByIdAndUpdate(req.params.id, updates, { new: true, runValidators: true });
  if (!room) return res.status(404).json({ success: false, code: "ROOM_NOT_FOUND", message: "Room not found." });
  res.json({ success: true, data: { room } });
});

const deleteRoom = asyncHandler(async (req, res) => {
  const room = await Room.findById(req.params.id);
  if (!room) return res.status(404).json({ success: false, code: "ROOM_NOT_FOUND", message: "Room not found." });
  if (room.reservations.length || await Booking.exists({ room: room._id, status: { $ne: "cancelled" } })) {
    return res.status(409).json({ success: false, code: "ROOM_HAS_BOOKINGS", message: "Cancel active bookings before deleting this room." });
  }
  await room.deleteOne();
  res.json({ success: true, message: "Room deleted." });
});

module.exports = { listRooms, getRoom, createRoom, updateRoom, deleteRoom };
