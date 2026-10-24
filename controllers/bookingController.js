const mongoose = require("mongoose");
const Booking = require("../models/Booking");
const Room = require("../models/Room");
const Hotel = require("../models/Hotel");
const asyncHandler = require("../utils/asyncHandler");
const { bookingDates } = require("../utils/validation");

const populateBooking = (query, includeRoomNumber = true) => query
  .populate("hotel", "name location address image earlyBirdDiscount earlyBirdDays")
  .populate("room", `${includeRoomNumber ? "roomNumber " : ""}type pricePerNight`)
  .populate("user", "name email");

const completeMaturedRefunds = (filter = {}) => Booking.updateMany(
  {
    ...filter,
    status: "cancelled",
    paymentStatus: "paid",
    refundStatus: "refund_initiated",
    refundInitiatedAt: { $lt: new Date(Date.now() - 2 * 60 * 1000) }
  },
  { $set: { refundStatus: "refunded", refundedAt: new Date() } }
);

const createBooking = asyncHandler(async (req, res) => {
  if (req.user?.role === "admin") {
    return res.status(403).json({ success: false, code: "FORBIDDEN", message: "Admins cannot make bookings" });
  }
  const { room: roomId = req.body.roomId, guests = 1 } = req.body;
  if (!mongoose.isValidObjectId(roomId)) {
    return res.status(400).json({ success: false, code: "VALIDATION_ERROR", message: "A valid room ID is required." });
  }
  const dates = bookingDates(req.body.checkIn, req.body.checkOut);
  const guestCount = Number(guests);
  if (!Number.isInteger(guestCount) || guestCount < 1) {
    return res.status(400).json({ success: false, code: "VALIDATION_ERROR", message: "guests must be a positive whole number." });
  }

  const room = await Room.findOne({
    _id: roomId,
    available: true,
    capacity: { $gte: guestCount },
    reservations: { $not: { $elemMatch: { checkIn: { $lt: dates.checkOut }, checkOut: { $gt: dates.checkIn } } } }
  });
  if (!room) {
    return res.status(409).json({ success: false, code: "ROOM_UNAVAILABLE", message: "This room is unavailable for the selected dates or guest count." });
  }

  const nights = Math.round((dates.checkOut - dates.checkIn) / 86400000);
  const baseTotal = nights * room.pricePerNight;

  // Retrieve hotel to check Early Bird deal configuration
  const hotel = await Hotel.findById(room.hotel);
  let discountPercentage = 0;
  let discountAmount = 0;
  let isEarlyBirdApplied = false;
  let earlyBirdDaysApplied = 0;

  const earlyBirdDiscount = Number(hotel?.earlyBirdDiscount || 0);
  const minDaysRequired = Number(hotel?.earlyBirdDays || 7);

  if (earlyBirdDiscount > 0) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const checkInDate = new Date(dates.checkIn);
    checkInDate.setHours(0, 0, 0, 0);
    const daysInAdvance = Math.ceil((checkInDate - today) / (1000 * 60 * 60 * 24));

    if (daysInAdvance >= minDaysRequired) {
      discountPercentage = earlyBirdDiscount;
      discountAmount = Math.round((baseTotal * discountPercentage) / 100);
      isEarlyBirdApplied = true;
      earlyBirdDaysApplied = minDaysRequired;
    }
  }

  const finalTotalAmount = Math.max(0, baseTotal - discountAmount);
  const bookingId = new mongoose.Types.ObjectId();
  const reservedRoom = await Room.findOneAndUpdate(
    {
      _id: room._id,
      available: true,
      capacity: { $gte: guestCount },
      reservations: { $not: { $elemMatch: { checkIn: { $lt: dates.checkOut }, checkOut: { $gt: dates.checkIn } } } }
    },
    { $push: { reservations: { bookingId, checkIn: dates.checkIn, checkOut: dates.checkOut } } },
    { new: true }
  );
  if (!reservedRoom) {
    return res.status(409).json({ success: false, code: "ROOM_UNAVAILABLE", message: "This room was just booked for the selected dates." });
  }

  try {
    const booking = await Booking.create({
      _id: bookingId,
      user: req.user._id,
      hotel: room.hotel,
      room: room._id,
      checkIn: dates.checkIn,
      checkOut: dates.checkOut,
      guests: guestCount,
      originalAmount: baseTotal,
      discountPercentage,
      discountAmount,
      isEarlyBirdApplied,
      earlyBirdDays: earlyBirdDaysApplied,
      totalAmount: finalTotalAmount,
      status: "pending",
      paymentStatus: "pending"
    });
    res.status(201).json({ success: true, data: { booking } });
  } catch (error) {
    await Room.updateOne({ _id: room._id }, { $pull: { reservations: { bookingId } } });
    throw error;
  }
});

const payBooking = asyncHandler(async (req, res) => {
  if (req.user?.role === "admin") {
    return res.status(403).json({ success: false, code: "FORBIDDEN", message: "Admins cannot make bookings" });
  }
  const { id } = req.params;
  const body = req.body || {};
  const paymentMethod = body.paymentMethod;
  const allowedMethods = ["upi", "card", "netbanking", "wallet", "payathotel"];
  if (!allowedMethods.includes(paymentMethod)) {
    return res.status(400).json({ success: false, code: "VALIDATION_ERROR", message: `paymentMethod must be one of: ${allowedMethods.join(", ")}.` });
  }

  const methodFields = {
    upi: [],
    card: [],
    netbanking: ["bankName"],
    wallet: ["walletName"],
    payathotel: ["guestName", "guestPhone", "arrivalTime"]
  };
  const allowedFields = ["paymentMethod", ...methodFields[paymentMethod]];
  if (Object.keys(body).some((field) => !allowedFields.includes(field))) {
    return res.status(400).json({ success: false, code: "VALIDATION_ERROR", message: "Only payment method and permitted booking details may be submitted." });
  }

  const allowedBanks = ["SBI", "HDFC", "ICICI", "Axis", "Kotak", "Indian Bank"];
  const allowedWallets = ["Paytm", "PhonePe", "Amazon Pay", "Mobikwik"];
  const arrivalTimes = ["12 PM – 2 PM", "2 PM – 4 PM", "4 PM – 6 PM", "6 PM – 8 PM", "After 8 PM"];
  if (paymentMethod === "netbanking" && !allowedBanks.includes(body.bankName)) {
    return res.status(400).json({ success: false, code: "VALIDATION_ERROR", message: "Select a valid bank." });
  }
  if (paymentMethod === "wallet" && !allowedWallets.includes(body.walletName)) {
    return res.status(400).json({ success: false, code: "VALIDATION_ERROR", message: "Select a valid wallet." });
  }
  if (paymentMethod === "payathotel") {
    if (typeof body.guestName !== "string" || !body.guestName.trim() || body.guestName.trim().length > 100) {
      return res.status(400).json({ success: false, code: "VALIDATION_ERROR", message: "Enter a valid guest name." });
    }
    if (typeof body.guestPhone !== "string" || !/^[6-9]\d{9}$/.test(body.guestPhone)) {
      return res.status(400).json({ success: false, code: "VALIDATION_ERROR", message: "Enter a valid 10-digit Indian mobile number." });
    }
    if (!arrivalTimes.includes(body.arrivalTime)) {
      return res.status(400).json({ success: false, code: "VALIDATION_ERROR", message: "Select a valid expected arrival time." });
    }
  }

  const payAtHotel = paymentMethod === "payathotel";
  const paymentDetails = {};
  if (paymentMethod === "netbanking") paymentDetails.bankName = body.bankName;
  if (paymentMethod === "wallet") paymentDetails.walletName = body.walletName;
  if (payAtHotel) {
    paymentDetails.guestName = body.guestName.trim();
    paymentDetails.guestPhone = body.guestPhone;
    paymentDetails.arrivalTime = body.arrivalTime;
  }
  const booking = await Booking.findOneAndUpdate(
    { _id: id, user: req.user._id, status: "pending" },
    {
      $set: {
        status: "confirmed",
        paymentStatus: payAtHotel ? "pay_at_hotel" : "paid",
        paymentMethod,
        ...paymentDetails,
        ...(payAtHotel ? {} : { paidAt: new Date() })
      }
    },
    { new: true, runValidators: true }
  );
  if (booking) return res.json({ success: true, data: { booking } });

  const ownedBooking = await Booking.findOne({ _id: id, user: req.user._id });
  if (!ownedBooking) return res.status(404).json({ success: false, code: "BOOKING_NOT_FOUND", message: "Booking not found." });
  return res.status(409).json({ success: false, code: "BOOKING_NOT_PENDING", message: "This booking is no longer pending payment." });
});

const listMyBookings = asyncHandler(async (req, res) => {
  await completeMaturedRefunds({ user: req.user._id });
  const bookings = await populateBooking(Booking.find({ user: req.user._id }).sort({ createdAt: -1 }), false);
  await Promise.all(bookings
    .filter((booking) => booking.status === "confirmed" && booking.paymentStatus === "paid" && booking.paymentMethod !== "payathotel" && booking.room)
    .map((booking) => booking.populate("room", "roomNumber type pricePerNight")));
  res.json({ success: true, count: bookings.length, data: { bookings } });
});

const USER_CANCELLATION_REASONS = [
  "Change of Plans",
  "Found Another Property",
  "Price Is Too High",
  "Booking Made by Mistake",
  "Other"
];

const calculateRefund = (booking, now = new Date()) => {
  const isPaid = booking?.paymentStatus === "paid";
  const isPayAtHotel = booking?.paymentStatus === "pay_at_hotel" || booking?.paymentMethod === "payathotel";
  const isPending = booking?.paymentStatus === "pending" || booking?.status === "pending";

  if (!isPaid || isPayAtHotel || isPending) {
    return {
      refundStatus: "not_applicable",
      refundAmount: 0,
      eligible: false,
      message: isPayAtHotel
        ? "Pay at Hotel booking. No payment was collected, so no refund is needed."
        : "No payment was collected for this reservation. No refund is applicable."
    };
  }

  const checkInDate = new Date(booking.checkIn);
  const checkInTime = checkInDate.getTime();
  const currentTime = now instanceof Date ? now.getTime() : new Date(now).getTime();

  if (Number.isNaN(checkInTime)) {
    return {
      refundStatus: "no_refund",
      refundAmount: 0,
      eligible: false,
      message: "Invalid check-in date."
    };
  }

  const hoursUntilCheckIn = (checkInTime - currentTime) / (1000 * 60 * 60);

  if (hoursUntilCheckIn >= 24) {
    return {
      refundStatus: "refund_initiated",
      refundAmount: Number(booking.totalAmount || 0),
      eligible: true,
      hoursUntilCheckIn,
      message: "Cancelled at least 24 hours before check-in. Eligible for full refund."
    };
  }

  return {
    refundStatus: "no_refund",
    refundAmount: 0,
    eligible: false,
    hoursUntilCheckIn,
    message: "Cancelled within 24 hours of check-in. In accordance with the policy, this booking is non-refundable."
  };
};

const getCancelPreview = asyncHandler(async (req, res) => {
  const query = req.user?.role === "admin"
    ? { _id: req.params.id }
    : { _id: req.params.id, user: req.user._id };

  const booking = await Booking.findOne(query);
  if (!booking) {
    return res.status(404).json({ success: false, code: "BOOKING_NOT_FOUND", message: "Booking not found." });
  }

  const now = new Date();
  const refundPreview = calculateRefund(booking, now);

  res.json({
    success: true,
    data: {
      bookingId: booking._id,
      status: booking.status,
      paymentStatus: booking.paymentStatus,
      paymentMethod: booking.paymentMethod,
      totalAmount: booking.totalAmount,
      checkIn: booking.checkIn,
      checkOut: booking.checkOut,
      refundStatus: refundPreview.refundStatus,
      refundAmount: refundPreview.refundAmount,
      eligible: refundPreview.eligible,
      message: refundPreview.message,
      hoursUntilCheckIn: refundPreview.hoursUntilCheckIn
    }
  });
});

const cancelMyBooking = asyncHandler(async (req, res) => {
  if (req.user?.role === "admin") {
    return res.status(403).json({ success: false, code: "FORBIDDEN", message: "Admins cannot make bookings" });
  }
  const booking = await Booking.findOne({ _id: req.params.id, user: req.user._id });
  if (!booking) return res.status(404).json({ success: false, code: "BOOKING_NOT_FOUND", message: "Booking not found." });
  const statusLower = String(booking.status || "").trim().toLowerCase();
  if (statusLower === "cancelled") {
    return res.status(409).json({ success: false, code: "BOOKING_ALREADY_CANCELLED", message: "This booking is already cancelled." });
  }
  if (!["pending", "confirmed"].includes(statusLower)) {
    return res.status(409).json({ success: false, code: "BOOKING_CANNOT_BE_CANCELLED", message: "Only pending or confirmed bookings can be cancelled." });
  }
  const now = new Date();
  let checkInDeadline = new Date(booking.checkIn);
  if (checkInDeadline.getUTCHours() === 0 && checkInDeadline.getUTCMinutes() === 0 && checkInDeadline.getUTCSeconds() === 0) {
    const dateStr = checkInDeadline.toISOString().slice(0, 10);
    const [y, m, d] = dateStr.split("-").map(Number);
    checkInDeadline = new Date(Date.UTC(y, m - 1, d, 23, 59, 59, 999));
  }
  if (now > checkInDeadline) {
    return res.status(409).json({ success: false, code: "BOOKING_CANNOT_BE_CANCELLED", message: "A booking cannot be cancelled after the check-in date has passed." });
  }

  // Parse user cancellation category, reason and optional explanation
  const selectedCat = typeof req.body.cancellationCategory === "string" ? req.body.cancellationCategory.trim() : "";
  const rawReason = typeof req.body.cancellationReason === "string" ? req.body.cancellationReason.trim() : "";
  const rawExplanation = typeof req.body.explanation === "string"
    ? req.body.explanation.trim()
    : typeof req.body.cancellationNotes === "string"
      ? req.body.cancellationNotes.trim()
      : "";

  let category = selectedCat || (USER_CANCELLATION_REASONS.includes(rawReason) ? rawReason : "Other");
  if (!USER_CANCELLATION_REASONS.includes(category)) {
    category = "Other";
  }

  let finalReason = rawReason;
  if (!finalReason || USER_CANCELLATION_REASONS.includes(finalReason)) {
    if (category === "Other") {
      finalReason = rawExplanation ? `Other: ${rawExplanation}` : "Other";
    } else {
      finalReason = rawExplanation ? `${category} (${rawExplanation})` : category;
    }
  }

  booking.status = "cancelled";
  booking.cancelledAt = now;
  booking.cancelledBy = "user";
  booking.cancellationCategory = category;
  booking.cancellationReason = finalReason;
  booking.cancellationNotes = rawExplanation || "";

  // Apply unified refund rule
  const refundResult = calculateRefund(booking, now);
  booking.refundStatus = refundResult.refundStatus;
  booking.refundAmount = refundResult.refundAmount;
  if (refundResult.refundStatus === "refund_initiated") {
    booking.refundInitiatedAt = now;
  }

  await booking.save();
  await Room.updateOne({ _id: booking.room }, { $pull: { reservations: { bookingId: booking._id } } });
  res.json({ success: true, data: { booking } });
});

const listAllBookings = asyncHandler(async (req, res) => {
  await completeMaturedRefunds();
  const filter = {};
  if (req.query.status) filter.status = req.query.status;
  const bookings = await populateBooking(Booking.find(filter).sort({ createdAt: -1 }));
  const totalRevenue = bookings
    .filter((b) => b.status !== "cancelled")
    .reduce((sum, b) => sum + (Number(b.totalAmount) || 0), 0);
  res.json({ success: true, count: bookings.length, data: { bookings, totalRevenue } });
});

const updateBookingStatus = asyncHandler(async (req, res) => {
  const allowed = ["pending", "confirmed", "cancelled", "completed"];
  if (!allowed.includes(req.body.status)) {
    return res.status(400).json({ success: false, code: "VALIDATION_ERROR", message: `status must be one of: ${allowed.join(", ")}.` });
  }
  const booking = await Booking.findById(req.params.id);
  if (!booking) return res.status(404).json({ success: false, code: "BOOKING_NOT_FOUND", message: "Booking not found." });
  if (booking.status === "cancelled" && req.body.status !== "cancelled") {
    return res.status(409).json({ success: false, code: "BOOKING_CANNOT_BE_REACTIVATED", message: "A cancelled booking cannot be reactivated; create a new booking instead." });
  }

  if (req.body.status === "cancelled") {
    const reason = typeof req.body.cancellationReason === "string" ? req.body.cancellationReason.trim() : "";
    const category = typeof req.body.cancellationCategory === "string" ? req.body.cancellationCategory.trim() : "";
    const notes = typeof req.body.cancellationNotes === "string" ? req.body.cancellationNotes.trim() : "";

    const predefinedCategories = [
      "Hotel unavailable",
      "Maintenance or operational issue",
      "Overbooking",
      "Incorrect room or pricing information",
      "Other"
    ];

    if (!category && !reason) {
      return res.status(400).json({
        success: false,
        code: "CANCELLATION_REASON_REQUIRED",
        message: "Please select or enter a cancellation reason."
      });
    }

    const selectedCategory = category || (predefinedCategories.includes(reason) ? reason : "Other");

    if (selectedCategory === "Other" && !notes && (!reason || reason === "Other")) {
      return res.status(400).json({
        success: false,
        code: "CANCELLATION_EXPLANATION_REQUIRED",
        message: "Please provide a custom explanation when selecting Other."
      });
    }

    let finalReason = reason;
    if (!finalReason || finalReason === "Other") {
      finalReason = selectedCategory === "Other" ? notes : selectedCategory;
    }

    const now = new Date();
    booking.status = "cancelled";
    booking.cancelledAt = now;
    booking.cancellationCategory = selectedCategory;
    booking.cancellationReason = finalReason;
    booking.cancellationNotes = notes || (selectedCategory === "Other" ? finalReason : "");
    booking.cancelledBy = "admin";
    booking.cancelledByAdmin = {
      id: req.user._id,
      name: req.user.name || "Administrator",
      email: req.user.email
    };

    if (booking.paymentStatus === "paid") {
      const validRefundStatuses = ["refund_initiated", "processing", "refunded", "pending", "failed", "no_refund"];
      if (req.body.refundStatus && validRefundStatuses.includes(req.body.refundStatus)) {
        booking.refundStatus = req.body.refundStatus;
        booking.refundAmount = Number(
          req.body.refundAmount !== undefined
            ? req.body.refundAmount
            : req.body.refundStatus === "no_refund"
              ? 0
              : booking.totalAmount
        );
      } else {
        const refundResult = calculateRefund(booking, now);
        booking.refundStatus = refundResult.refundStatus;
        booking.refundAmount = refundResult.refundAmount;
      }
      if (booking.refundStatus === "refund_initiated" || booking.refundStatus === "processing") {
        booking.refundInitiatedAt = now;
      }
      if (booking.refundStatus === "refunded") {
        booking.refundedAt = now;
      }
    } else {
      const refundResult = calculateRefund(booking, now);
      booking.refundStatus = refundResult.refundStatus;
      booking.refundAmount = refundResult.refundAmount;
    }

    await booking.save();
    await Room.updateOne({ _id: booking.room }, { $pull: { reservations: { bookingId: booking._id } } });
    return res.json({ success: true, data: { booking } });
  }

  booking.status = req.body.status;
  await booking.save();
  res.json({ success: true, data: { booking } });
});

const deleteBooking = asyncHandler(async (req, res) => {
  const booking = await Booking.findById(req.params.id);
  if (!booking) return res.status(404).json({ success: false, code: "BOOKING_NOT_FOUND", message: "Booking not found." });
  await Room.updateOne({ _id: booking.room }, { $pull: { reservations: { bookingId: booking._id } } });
  await booking.deleteOne();
  res.json({ success: true, message: "Booking deleted." });
});

module.exports = {
  createBooking,
  payBooking,
  listMyBookings,
  cancelMyBooking,
  getCancelPreview,
  calculateRefund,
  listAllBookings,
  updateBookingStatus,
  deleteBooking
};
