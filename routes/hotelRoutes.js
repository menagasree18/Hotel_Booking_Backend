const express = require("express");
const {
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
} = require("../controllers/hotelController");
const { protect, adminOnly } = require("../middleware/authMiddleware");

const router = express.Router();

router.route("/").get(listHotels).post(protect, adminOnly, createHotel);
router.get("/admin/reviews", protect, adminOnly, listAllReviews);
router.route("/admin/reviews/:id/reply")
  .post(protect, adminOnly, replyToReview)
  .patch(protect, adminOnly, replyToReview)
  .delete(protect, adminOnly, deleteReviewReply);
router.get("/destinations", getDestinations);
router.get("/:id/my-rating", protect, getMyRating);
router.post("/:id/rate", protect, rateHotel);
router.get("/:id/reviews", listHotelReviews);
router.route("/:id").get(getHotel).put(protect, adminOnly, updateHotel).patch(protect, adminOnly, updateHotel).delete(protect, adminOnly, deleteHotel);

module.exports = router;
