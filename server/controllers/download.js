import mongoose from "mongoose";
import path from "path";
import users from "../Modals/Auth.js";
import video from "../Modals/video.js";
import Download from "../Modals/Download.js";
import { PLAN_DEFINITIONS } from "./subscription.js";

const dayKey = () => new Date().toISOString().slice(0, 10);

export const getDownloads = async (req, res) => {
  const { userId } = req.params;
  if (!mongoose.Types.ObjectId.isValid(userId)) {
    return res.status(400).json({ message: "Invalid user ID" });
  }
  const records = await Download.find({ userId })
    .populate("videoId", "videotitle filepath filesize")
    .sort({ downloadedAt: -1 });
  return res.status(200).json(records);
};

export const downloadVideo = async (req, res) => {
  const { userId, videoId } = req.body;
  if (!mongoose.Types.ObjectId.isValid(userId) || !mongoose.Types.ObjectId.isValid(videoId)) {
    return res.status(400).json({ message: "Invalid download request" });
  }
  const [user, selectedVideo] = await Promise.all([
    users.findById(userId).select("plan subscriptionExpiresAt"),
    video.findById(videoId),
  ]);
  if (!user || !selectedVideo) return res.status(404).json({ message: "User or video unavailable" });

  if (user.subscriptionExpiresAt && user.subscriptionExpiresAt <= new Date()) {
    user.plan = "Free";
    user.subscriptionExpiresAt = null;
    await user.save();
  }

  const plan = PLAN_DEFINITIONS[user.plan] ? user.plan : "Free";
  const key = dayKey();
  const existing = await Download.findOne({ userId, videoId, dayKey: key });
  const used = await Download.countDocuments({ userId, dayKey: key, status: { $in: ["started", "completed"] } });
  if (!existing && used >= PLAN_DEFINITIONS[plan].dailyDownloads) {
    return res.status(429).json({ message: "Daily download quota exceeded", remainingQuota: 0 });
  }

  const remainingQuota = Math.max(
    PLAN_DEFINITIONS[plan].dailyDownloads - used - (existing ? 0 : 1),
    0
  );
  const record =
    existing ||
    (await Download.create({
      userId,
      videoId,
      dayKey: key,
      plan,
      remainingQuota,
      ipAddress: req.ip,
      userAgent: req.get("user-agent"),
    }));

  const filePath = path.resolve(process.cwd(), selectedVideo.filepath);
  return res.download(filePath, selectedVideo.filename, async (error) => {
    await Download.findByIdAndUpdate(record._id, { status: error ? "failed" : "completed" });
  });
};
