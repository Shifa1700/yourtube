import mongoose from "mongoose";

const watchProgressSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "user", required: true },
    videoId: { type: mongoose.Schema.Types.ObjectId, ref: "videofiles", required: true },
    currentTime: { type: Number, default: 0, min: 0 },
    duration: { type: Number, default: 0, min: 0 },
    completed: { type: Boolean, default: false },
    lastWatchedAt: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

watchProgressSchema.index({ userId: 1, videoId: 1 }, { unique: true });

export default mongoose.model("watchprogress", watchProgressSchema);
