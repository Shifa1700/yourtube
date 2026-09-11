import mongoose from "mongoose";

const loginAttemptSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "user" },
    email: String,
    ipAddress: String,
    browser: String,
    operatingSystem: String,
    deviceType: { type: String, enum: ["Desktop", "Mobile", "Tablet", "Unknown"] },
    deviceModel: String,
    city: String,
    state: String,
    country: String,
    latitude: Number,
    longitude: Number,
    status: { type: String, enum: ["pending-otp", "success", "failed"], required: true },
    otpVerifiedAt: Date,
    trustedDeviceExpiresAt: Date,
    createdAt: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

export default mongoose.model("loginattempt", loginAttemptSchema);
