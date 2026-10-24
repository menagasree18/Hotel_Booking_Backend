function notFound(req, res) {
  res.status(404).json({
    success: false,
    code: "NOT_FOUND",
    message: `No route found for ${req.method} ${req.originalUrl}.`
  });
}

function errorHandler(error, req, res, next) {
  if (res.headersSent) return next(error);

  let status = error.statusCode || error.status || 500;
  let code = error.code || "SERVER_ERROR";
  let message = error.message || "An unexpected server error occurred.";

  if (error.name === "ValidationError") {
    status = 400;
    code = "VALIDATION_ERROR";
    message = Object.values(error.errors).map((item) => item.message).join(", ");
  } else if (error.name === "CastError") {
    status = 400;
    code = "INVALID_ID";
    message = "A supplied identifier or value is invalid.";
  } else if (error.code === 11000) {
    status = 409;
    code = "DUPLICATE_VALUE";
    message = "A record with that value already exists.";
  }

  res.status(status).json({
    success: false,
    code,
    message,
    ...(error.details ? { details: error.details } : {})
  });
}

module.exports = { notFound, errorHandler };
