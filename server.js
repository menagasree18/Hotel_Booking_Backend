require("node:dns").setServers(["8.8.8.8", "8.8.4.4"]);
require("dotenv").config();


const app = require("./app");
const connectDB = require("./config/db");

const PORT = process.env.PORT || 5000;

async function startServer() {
  try {
    await connectDB();

    app.listen(PORT, () => {
      console.log(`Hotel Booking API running on port ${PORT}`);
    });
  } catch (error) {
    console.error("MongoDB Atlas connection failed:", error);
    process.exit(1);
  }
}

startServer();