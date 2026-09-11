import mongoose from "mongoose";
const userschema = mongoose.Schema({
  email: { type: String, required: true },
  firebaseUid: { type: String, unique: true, sparse: true },
  name: { type: String },
  channelname: { type: String },
  description: { type: String },
  image: { type: String },
  themePreference: {
    type: String,
    enum: ["light", "dark"],
    default: null,
  },
  plan: {
    type: String,
    enum: ["Free", "Bronze", "Silver", "Gold"],
    default: "Free",
  },
  subscriptionExpiresAt: { type: Date, default: null },
  joinedon: { type: Date, default: Date.now },
});

export default mongoose.model("user", userschema);
