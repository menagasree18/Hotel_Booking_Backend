const mongoose = require("mongoose");
 
const reservationSchema = new mongoose.Schema(
  {
    bookingId: { type: mongoose.Schema.Types.ObjectId, required: true },
    checkIn: { type: Date, required: true },
    checkOut: { type: Date, required: true }
  },
  { _id: false }
);

const roomSchema = new mongoose.Schema(
  {
    hotel: { type: mongoose.Schema.Types.ObjectId, ref: "Hotel", required: true, index: true },
    roomNumber: { type: String, required: true, trim: true },
    type: { type: String, required: true, enum: ["Single", "Double", "Suite"] },
    description: { type: String, trim: true, default: "", maxlength: 1000 },
    pricePerNight: { type: Number, required: true, min: 0.01 },
    capacity: { type: Number, required: true, min: 1, default: 2 },
    amenities: [{ type: String, trim: true }],
    available: { type: Boolean, default: true },
    reservations: { type: [reservationSchema], default: [] }
  },
  { timestamps: true }
);

roomSchema.index({ hotel: 1, roomNumber: 1 }, { unique: true });

module.exports = mongoose.model("Room", roomSchema);
