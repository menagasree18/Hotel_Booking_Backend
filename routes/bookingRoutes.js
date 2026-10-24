const express = require("express");
const {
  createBooking,
  payBooking,
  listMyBookings,
  cancelMyBooking,
  getCancelPreview,
  listAllBookings,
  updateBookingStatus,
  deleteBooking
} = require("../controllers/bookingController");
const { protect, adminOnly } = require("../middleware/authMiddleware");

const router = express.Router();

router.use(protect);
router.get("/", listMyBookings);
router.get("/my", listMyBookings);
router.get("/admin/all", adminOnly, listAllBookings);
router.post("/", createBooking);
router.put("/:id/pay", payBooking);
router.get("/:id/cancel-preview", getCancelPreview);
router.patch("/:id/cancel", cancelMyBooking);
router.patch("/admin/:id", adminOnly, updateBookingStatus);
router.delete("/admin/:id", adminOnly, deleteBooking);

module.exports = router;
