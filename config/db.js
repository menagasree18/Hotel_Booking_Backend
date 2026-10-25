const mongoose = require("mongoose");

async function connectDB() {
const mongoURI = process.env.MONGODB_URI;

if (!mongoURI) {
throw new Error("MONGODB_URI is missing in backend .env file");
}

await mongoose.connect(mongoURI);

console.log("MongoDB Atlas connected successfully!");
console.log("Database:", mongoose.connection.name);
}

module.exports = connectDB;
