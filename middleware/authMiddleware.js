const jwt = require("jsonwebtoken");
const User = require("../models/User");

async function protect(req, res, next) {
  const authorization = req.headers.authorization || "";
  const [scheme, token] = authorization.split(" ");

  if (scheme !== "Bearer" || !token) {
    return res.status(401).json({ success: false, code: "AUTH_REQUIRED", message: "A bearer token is required." });
  }

  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET || "development-only-secret");
    const user = await User.findById(payload.id || payload.userId).select("_id name email role");
    if (!user) {
      return res.status(401).json({ success: false, code: "INVALID_TOKEN", message: "The token user no longer exists." });
    }
    req.user = user;
    next();
  } catch (error) {
    if (error.name !== "JsonWebTokenError" && error.name !== "TokenExpiredError" && error.name !== "NotBeforeError") {
      return next(error);
    }
    return res.status(401).json({ success: false, code: "INVALID_TOKEN", message: "The token is invalid or expired." });
  }
}

function optionalProtect(req, res, next) {
  if (!req.headers.authorization) return next();
  return protect(req, res, next);
}

function adminOnly(req, res, next) {
  if (!req.user || req.user.role !== "admin") {
    return res.status(403).json({ success: false, code: "FORBIDDEN", message: "Administrator access is required." });
  }
  next();
}

module.exports = { protect, optionalProtect, adminOnly };
