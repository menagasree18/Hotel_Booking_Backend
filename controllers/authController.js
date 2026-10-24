const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const User = require("../models/User");
const asyncHandler = require("../utils/asyncHandler");
const { requiredString } = require("../utils/validation");

function makeToken(user) {
  return jwt.sign(
    { id: user._id, role: user.role },
    process.env.JWT_SECRET || "development-only-secret",
    { expiresIn: process.env.JWT_EXPIRES_IN || "7d" }
  );
}

function publicUser(user) {
  return { id: user._id, name: user.name, email: user.email, role: user.role };
}

const register = asyncHandler(async (req, res) => {
  const name = requiredString(req.body.name, "name");
  const email = requiredString(req.body.email, "email").toLowerCase();
  const password = requiredString(req.body.password, "password");
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return res.status(400).json({ success: false, code: "VALIDATION_ERROR", message: "Enter a valid email address." });
  }
  if (password.length < 6) {
    return res.status(400).json({ success: false, code: "VALIDATION_ERROR", message: "Password must be at least 6 characters." });
  }
  const user = await User.create({ name, email, password });
  res.status(201).json({ success: true, data: { user: publicUser(user), token: makeToken(user) } });
});

const login = asyncHandler(async (req, res) => {
  const email = requiredString(req.body.email, "email").toLowerCase();
  const password = requiredString(req.body.password, "password");
  const user = await User.findOne({ email }).select("+password");
  if (!user || !(await bcrypt.compare(password, user.password))) {
    return res.status(401).json({ success: false, code: "INVALID_CREDENTIALS", message: "Email or password is incorrect." });
  }
  res.json({ success: true, data: { user: publicUser(user), token: makeToken(user) } });
});

const me = asyncHandler(async (req, res) => {
  res.json({ success: true, data: { user: publicUser(req.user) } });
});

module.exports = { register, login, me };
