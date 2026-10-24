function requiredString(value, fieldName) {
  if (typeof value !== "string" || !value.trim()) {
    const error = new Error(`${fieldName} is required and must be text.`);
    error.statusCode = 400;
    error.code = "VALIDATION_ERROR";
    throw error;
  }
  return value.trim();
}

function parseDate(value, fieldName) {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    const error = new Error(`${fieldName} must be a date in YYYY-MM-DD format.`);
    error.statusCode = 400;
    error.code = "VALIDATION_ERROR";
    throw error;
  }
  const date = new Date(`${value}T00:00:00.000Z`);
  if (Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== value) {
    const error = new Error(`${fieldName} is not a valid calendar date.`);
    error.statusCode = 400;
    error.code = "VALIDATION_ERROR";
    throw error;
  }
  return date;
}

function bookingDates(checkInValue, checkOutValue) {
  const checkIn = parseDate(checkInValue, "checkIn");
  const checkOut = parseDate(checkOutValue, "checkOut");
  if (checkOut <= checkIn) {
    const error = new Error("checkOut must be later than checkIn.");
    error.statusCode = 400;
    error.code = "VALIDATION_ERROR";
    throw error;
  }
  return { checkIn, checkOut };
}

module.exports = { requiredString, parseDate, bookingDates };
