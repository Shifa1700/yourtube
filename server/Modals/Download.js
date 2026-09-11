import mongoose from "mongoose";

const downloadschema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "user", required: true },
    videoId: { type: mongoose.Schema.Types.ObjectId, ref: "videofiles", required: true },
    downloadedAt: { type: Date, default: Date.now },
    dayKey: { type: String, required: true },
    status: {
      type: String,
      enum: ["started", "completed", "failed"],
      default: "started",
    },
    plan: { type: String, required: true },
    remainingQuota: { type: Number, required: true },
    ipAddress: String,
    userAgent: String,
  },
  { timestamps: true }
);

downloadschema.index({ userId: 1, videoId: 1, dayKey: 1 }, { unique: true });

export default mongoose.model("download", downloadschema);
