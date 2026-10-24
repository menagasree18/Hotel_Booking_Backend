require("dotenv").config();
const bcrypt = require("bcrypt");
const connectDB = require("./config/db");
const User = require("./models/User");
const Hotel = require("./models/Hotel");
const Room = require("./models/Room");

const hotels = [
  { name: "Vivanta Thiruvananthapuram", location: "Thiruvananthapuram, Kerala", address: "MG Road, Thiruvananthapuram, Kerala", description: "A welcoming city stay, thoughtfully placed for discovering Kerala's capital.", rating: 4.8, amenities: ["Free Wi-Fi", "Restaurant", "Pool", "Gym"], image: "https://images.unsplash.com/photo-1566073771259-6a8506099945?auto=format&fit=crop&w=1400&q=85" },
  { name: "Vivanta Mumbai", location: "Mumbai", address: "South Mumbai, Maharashtra", description: "A relaxed city escape close to the waterfront and Mumbai's lively neighbourhoods.", rating: 4.6, amenities: ["Free Wi-Fi", "Restaurant", "Pool", "Breakfast"], image: "https://images.unsplash.com/photo-1571896349842-33c89424de2d?auto=format&fit=crop&w=1400&q=85" },
  { name: "Vivanta Chennai", location: "Chennai", address: "Anna Salai, Chennai, Tamil Nadu", description: "A comfortable base for exploring Chennai's coast, culture, and cuisine.", rating: 4.5, amenities: ["Free Wi-Fi", "Parking", "Restaurant", "Pool"], image: "https://images.unsplash.com/photo-1542314831-068cd1dbfeeb?auto=format&fit=crop&w=1400&q=85" },
  { name: "Vivanta Kochi", location: "Kochi, Kerala", address: "Marine Drive, Kochi, Kerala", description: "Modern rooms in a waterside neighbourhood with easy access to Fort Kochi.", rating: 4.4, amenities: ["Free Wi-Fi", "Business center", "Gym", "Restaurant"], image: "https://images.unsplash.com/photo-1564501049412-61c2a3083791?auto=format&fit=crop&w=1400&q=85" },
  { name: "Vivanta Munnar", location: "Munnar, Kerala", address: "Tea Country, Munnar, Kerala", description: "A peaceful hillside stay surrounded by the green landscapes of Munnar.", rating: 4.7, amenities: ["Free Wi-Fi", "Garden", "Breakfast", "Parking"], image: "https://images.unsplash.com/photo-1578683010236-d716f9a3f461?auto=format&fit=crop&w=1400&q=85" }
];

async function seed() {
  await connectDB();

  const oldSamples = await Hotel.find({ name: { $in: ["Grand Palace Hotel", "Seaside Resort", "Mountain View Lodge", "City Lights Hotel", "Garden Retreat"] } }).select("_id");
  if (oldSamples.length) {
    await Room.deleteMany({ hotel: { $in: oldSamples.map((hotel) => hotel._id) } });
    await Hotel.deleteMany({ _id: { $in: oldSamples.map((hotel) => hotel._id) } });
  }

  const previousAdmin = await User.findOne({ email: "admin@test.com", role: "admin" });
  if (previousAdmin) {
    previousAdmin.email = "adminjohn@gmail.com";
    previousAdmin.name = "Hotel Administrator";
    previousAdmin.password = "adminjohn123456";
    await previousAdmin.save();
  }

  await User.findOneAndUpdate(
    { email: "adminjohn@gmail.com" },
    { $set: { name: "Hotel Administrator", password: await bcrypt.hash("adminjohn123456", 10), role: "admin" } },
    { upsert: true, new: true, runValidators: true, setDefaultsOnInsert: true }
  );
  await User.findOneAndUpdate(
    { email: "user@test.com" },
    { $set: { name: "Sample Guest", password: await bcrypt.hash("user123", 10), role: "user" } },
    { upsert: true, new: true, runValidators: true, setDefaultsOnInsert: true }
  );

  for (const hotelData of hotels) {
    const hotel = await Hotel.findOneAndUpdate(
      { name: hotelData.name, location: hotelData.location },
      { $set: hotelData },
      { upsert: true, new: true, runValidators: true, setDefaultsOnInsert: true }
    );
    const roomTypes = [
      { roomNumber: "101", type: "Single", description: "A comfortable room with a queen bed.", pricePerNight: 6500, capacity: 2, amenities: ["Wi-Fi", "Air conditioning"] },
      { roomNumber: "201", type: "Double", description: "A spacious room with an upgraded view.", pricePerNight: 9500, capacity: 3, amenities: ["Wi-Fi", "Air conditioning", "Mini fridge"] },
      { roomNumber: "301", type: "Suite", description: "A roomy suite with a separate sitting area.", pricePerNight: 14500, capacity: 4, amenities: ["Wi-Fi", "Air conditioning", "Mini fridge", "Living area"] }
    ];
    for (const roomData of roomTypes) {
      await Room.findOneAndUpdate(
        { hotel: hotel._id, roomNumber: roomData.roomNumber },
        { $set: { ...roomData, hotel: hotel._id, available: true } },
        { upsert: true, new: true, runValidators: true, setDefaultsOnInsert: true }
      );
    }
  }

  console.log("Seed complete.");
  console.log("Admin login: adminjohn@gmail.com / adminjohn123456");
  console.log("Sample user: user@test.com / user123");
  process.exit(0);
}

seed().catch((error) => {
  console.error("Seed failed:", error);
  process.exit(1);
});
