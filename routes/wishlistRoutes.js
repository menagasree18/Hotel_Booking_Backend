const express = require("express");
const {
  getWishlist,
  toggleWishlist,
  addToWishlist,
  removeFromWishlist
} = require("../controllers/wishlistController");
const { protect } = require("../middleware/authMiddleware");

const router = express.Router();

router.use(protect);
router.get("/", getWishlist);
router.post("/toggle/:hotelId", toggleWishlist);
router.post("/:hotelId", addToWishlist);
router.delete("/:hotelId", removeFromWishlist);

module.exports = router;
