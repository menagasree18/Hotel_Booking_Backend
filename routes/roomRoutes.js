const express = require("express");
const { listRooms, getRoom, createRoom, updateRoom, deleteRoom } = require("../controllers/roomController");
const { protect, optionalProtect, adminOnly } = require("../middleware/authMiddleware");

const router = express.Router();

router.route("/").get(optionalProtect, listRooms).post(protect, adminOnly, createRoom);
router.route("/:id").get(optionalProtect, getRoom).put(protect, adminOnly, updateRoom).patch(protect, adminOnly, updateRoom).delete(protect, adminOnly, deleteRoom);

module.exports = router;
