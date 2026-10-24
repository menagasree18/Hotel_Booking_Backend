require("dotenv").config();
const app = require("./app");
const connectDB = require("./config/db");

const port = Number(process.env.PORT) || 5000;

connectDB()
  .then(() => {
    app.listen(port, () => console.log(`Hotel Booking API listening on port ${port}`));
  })
  .catch((error) => {
    console.error("Could not connect to MongoDB:", error.message);
    process.exit(1);
  });
