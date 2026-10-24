const mongoose = require("mongoose");

const bookingSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    hotel: { type: mongoose.Schema.Types.ObjectId, ref: "Hotel", required: true },
    room: { type: mongoose.Schema.Types.ObjectId, ref: "Room", required: true, index: true },
    checkIn: { type: Date, required: true },
    checkOut: { type: Date, required: true },
    guests: { type: Number, required: true, min: 1, default: 1 },
    originalAmount: { type: Number, min: 0 },
    discountPercentage: { type: Number, default: 0, min: 0, max: 100 },
    discountAmount: { type: Number, default: 0, min: 0 },
    isEarlyBirdApplied: { type: Boolean, default: false },
    earlyBirdDays: { type: Number, default: 0 },
    totalAmount: { type: Number, required: true, min: 0 },
    status: {
      type: String,
      enum: ["pending", "confirmed", "cancelled", "completed"],
      default: "pending"
    },
    paymentStatus: { type: String, enum: ["pending", "paid", "pay_at_hotel"], default: "pending" },
    paymentMethod: { type: String, enum: ["upi", "card", "netbanking", "wallet", "payathotel"] },
    refundStatus: {
      type: String,
      enum: ["refund_initiated", "processing", "refunded", "pending", "failed", "no_refund", "not_applicable"]
    },
    refundAmount: { type: Number, min: 0 },
    refundInitiatedAt: { type: Date },
    refundedAt: { type: Date },
    cancelledAt: { type: Date },
    cancellationReason: { type: String, trim: true, maxlength: 500 },
    cancellationCategory: { type: String, trim: true },
    cancellationNotes: { type: String, trim: true, maxlength: 1000 },
    cancelledBy: { type: String, enum: ["admin", "user"] },
    cancelledByAdmin: {
      id: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
      name: { type: String, trim: true },
      email: { type: String, trim: true }
    },
    bankName: { type: String, enum: ["SBI", "HDFC", "ICICI", "Axis", "Kotak", "Indian Bank"] },
    walletName: { type: String, enum: ["Paytm", "PhonePe", "Amazon Pay", "Mobikwik"] },
    guestName: { type: String, trim: true, maxlength: 100 },
    guestPhone: { type: String, match: /^[6-9]\d{9}$/ },
    arrivalTime: { type: String, enum: ["12 PM – 2 PM", "2 PM – 4 PM", "4 PM – 6 PM", "6 PM – 8 PM", "After 8 PM"] },
    paidAt: { type: Date }
  },
  { timestamps: true }
);

module.exports = mongoose.model("Booking", bookingSchema);
