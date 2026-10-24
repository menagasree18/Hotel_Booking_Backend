const express = require("express");
const cors = require("cors");
const authRoutes = require("./routes/authRoutes");
const hotelRoutes = require("./routes/hotelRoutes");
const roomRoutes = require("./routes/roomRoutes");
const bookingRoutes = require("./routes/bookingRoutes");
const wishlistRoutes = require("./routes/wishlistRoutes");
const { notFound, errorHandler } = require("./middleware/errors");

const app = express();

app.use(cors());
app.use(express.json({ limit: "1mb" }));
app.use(express.urlencoded({ extended: true }));

app.get("/", (req, res) => {
  res.json({ success: true, message: "Hotel Booking API is running.", docs: "See README.md for API routes." });
});
app.get("/api/health", (req, res) => {
  res.json({ success: true, message: "API is healthy." });
});
app.use("/api/auth", authRoutes);
app.use("/api/hotels", hotelRoutes);
app.use("/api/rooms", roomRoutes);
app.use("/api/bookings", bookingRoutes);
app.use("/api/wishlist", wishlistRoutes);

app.use(notFound);
app.use(errorHandler);

module.exports = app;
