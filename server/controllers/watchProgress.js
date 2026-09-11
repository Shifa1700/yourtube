import mongoose from "mongoose";
import WatchProgress from "../Modals/WatchProgress.js";
import users from "../Modals/Auth.js";

const getUser = (firebaseUid) => users.findOne({ firebaseUid }).select("_id");

export const getProgress = async (req, res) => {
  const { videoId } = req.params;
  if (!mongoose.Types.ObjectId.isValid(videoId)) {
    return res.status(400).json({ message: "Invalid video ID" });
  }
  const user = await getUser(req.firebaseUser.uid);
  if (!user) return res.status(404).json({ message: "User unavailable" });
  const progress = await WatchProgress.findOne({ userId: user._id, videoId });
  return res.status(200).json(progress || { currentTime: 0, completed: false });
};

export const saveProgress = async (req, res) => {
  const { videoId } = req.params;
  const { currentTime, duration, completed = false } = req.body;
  if (!mongoose.Types.ObjectId.isValid(videoId)) {
    return res.status(400).json({ message: "Invalid video ID" });
  }
  if (
    !Number.isFinite(currentTime) ||
    !Number.isFinite(duration) ||
    currentTime < 0 ||
    duration < 0
  ) {
    return res.status(400).json({ message: "Invalid progress values" });
  }
  const user = await getUser(req.firebaseUser.uid);
  if (!user) return res.status(404).json({ message: "User unavailable" });
  const progress = await WatchProgress.findOneAndUpdate(
    { userId: user._id, videoId },
    {
      userId: user._id,
      videoId,
      currentTime: Math.min(currentTime, duration || currentTime),
      duration,
      completed: Boolean(completed) || (duration > 0 && currentTime / duration >= 0.95),
      lastWatchedAt: new Date(),
    },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );
  return res.status(200).json(progress);
};
