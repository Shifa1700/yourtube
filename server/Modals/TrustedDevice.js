import mongoose from "mongoose";

const trustedDeviceSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "user", required: true },
    fingerprint: { type: String, required: true },
    browser: String,
    operatingSystem: String,
    deviceType: String,
    ipAddress: String,
    expiresAt: { type: Date, required: true },
    lastSeenAt: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

trustedDeviceSchema.index({ userId: 1, fingerprint: 1 }, { unique: true });

export default mongoose.model("trusteddevice", trustedDeviceSchema);
