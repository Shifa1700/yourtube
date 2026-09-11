import mongoose from "mongoose";

const reportSchema = new mongoose.Schema(
  {
    commentId: { type: mongoose.Schema.Types.ObjectId, ref: "comment", required: true },
    reporterId: { type: mongoose.Schema.Types.ObjectId, ref: "user", required: true },
    reason: {
      type: String,
      enum: ["spam", "harassment", "offensive", "malicious-link", "other"],
      required: true,
    },
    details: String,
    status: { type: String, enum: ["open", "reviewed", "dismissed"], default: "open" },
  },
  { timestamps: true }
);

reportSchema.index({ commentId: 1, reporterId: 1 }, { unique: true });

export default mongoose.model("commentreport", reportSchema);
