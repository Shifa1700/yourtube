import comment from "../Modals/comment.js";
import CommentReport from "../Modals/CommentReport.js";
import mongoose from "mongoose";

const recentPosts = new Map();
const blockedTerms = ["spamword", "malware", "phishing"];
const editWindowMs = 15 * 60 * 1000;

const validateBody = (body) => {
  const normalized = body.trim();
  if (!normalized || normalized.length > 2000) return "Comment must be 1-2000 characters";
  if (/https?:\/\/|www\./i.test(normalized)) return "Links are not allowed in comments";
  if (blockedTerms.some((term) => normalized.toLowerCase().includes(term))) {
    return "Comment contains blocked language";
  }
  if (/([!?.,])\1{5,}|(.)\2{8,}/u.test(normalized)) {
    return "Repeated characters are not allowed";
  }
  return null;
};

const rateLimitKey = (userId) => String(userId);

export const postcomment = async (req, res) => {
  const { commentbody, userid, videoid, parentCommentId = null, language = "auto" } = req.body;
  const validationError = validateBody(commentbody || "");
  if (validationError) return res.status(400).json({ message: validationError });
  if (!mongoose.Types.ObjectId.isValid(userid) || !mongoose.Types.ObjectId.isValid(videoid)) {
    return res.status(400).json({ message: "Invalid user or video" });
  }

  const now = Date.now();
  const previous = recentPosts.get(rateLimitKey(userid)) || [];
  const activePosts = previous.filter((timestamp) => now - timestamp < 60_000);
  if (activePosts.length >= 5) {
    return res.status(429).json({ message: "Posting too frequently. Try again later." });
  }
  const duplicate = await comment.findOne({ userid, videoid, commentbody: commentbody.trim(), isDeleted: false });
  if (duplicate) return res.status(409).json({ message: "Duplicate comment" });

  recentPosts.set(rateLimitKey(userid), [...activePosts, now]);
  const created = await comment.create({
    ...req.body,
    commentbody: commentbody.trim(),
    parentCommentId,
    language,
  });
  return res.status(201).json(created);
};

export const getallcomment = async (req, res) => {
  const { videoid } = req.params;
  const sort = ["newest", "oldest", "most-liked"].includes(req.query.sort)
    ? req.query.sort
    : "newest";
  const sortValue = sort === "oldest" ? { commentedon: 1 } : sort === "most-liked" ? { likes: -1 } : { commentedon: -1 };
  const comments = await comment
    .find({ videoid, moderationStatus: "visible" })
    .sort(sortValue)
    .lean();
  const visibleComments = comments.map((item) =>
    item.isDeleted
      ? { ...item, commentbody: "[deleted by author]" }
      : item
  );
  return res.status(200).json(visibleComments);
};

export const editcomment = async (req, res) => {
  const { id } = req.params;
  const { userid, commentbody } = req.body;
  const validationError = validateBody(commentbody || "");
  if (validationError) return res.status(400).json({ message: validationError });
  if (!mongoose.Types.ObjectId.isValid(id) || !mongoose.Types.ObjectId.isValid(userid)) {
    return res.status(400).json({ message: "Invalid comment or user" });
  }
  const existing = await comment.findById(id);
  if (!existing) return res.status(404).json({ message: "Comment unavailable" });
  if (existing.userid.toString() !== userid) return res.status(403).json({ message: "Not your comment" });
  if (Date.now() - existing.createdAt.getTime() > editWindowMs) {
    return res.status(403).json({ message: "Edit window expired" });
  }
  existing.editHistory.push({ body: existing.commentbody, editedAt: new Date() });
  existing.commentbody = commentbody.trim();
  existing.editedAt = new Date();
  await existing.save();
  return res.status(200).json(existing);
};

export const deletecomment = async (req, res) => {
  const { id } = req.params;
  const { userid } = req.body;
  if (!mongoose.Types.ObjectId.isValid(id) || !mongoose.Types.ObjectId.isValid(userid)) {
    return res.status(400).json({ message: "Invalid comment or user" });
  }
  const existing = await comment.findById(id);
  if (!existing) return res.status(404).json({ message: "Comment unavailable" });
  if (existing.userid.toString() !== userid) return res.status(403).json({ message: "Not your comment" });
  existing.isDeleted = true;
  existing.commentbody = "";
  await existing.save();
  return res.status(200).json({ comment: true });
};

export const reactToComment = async (req, res) => {
  const { id } = req.params;
  const { userid, reaction } = req.body;
  if (!mongoose.Types.ObjectId.isValid(id) || !mongoose.Types.ObjectId.isValid(userid) || !["like", "dislike", "none"].includes(reaction)) {
    return res.status(400).json({ message: "Invalid reaction" });
  }
  const existing = await comment.findById(id);
  if (!existing) return res.status(404).json({ message: "Comment unavailable" });
  existing.likedBy.pull(userid);
  existing.dislikedBy.pull(userid);
  if (reaction === "like") existing.likedBy.push(userid);
  if (reaction === "dislike") existing.dislikedBy.push(userid);
  existing.likes = existing.likedBy.length;
  existing.dislikes = existing.dislikedBy.length;
  await existing.save();
  return res.status(200).json({ likes: existing.likes, dislikes: existing.dislikes });
};

export const reportcomment = async (req, res) => {
  const { commentId, reporterId, reason, details } = req.body;
  try {
    const report = await CommentReport.create({ commentId, reporterId, reason, details });
    await comment.findByIdAndUpdate(commentId, { moderationStatus: "flagged" });
    return res.status(201).json(report);
  } catch (error) {
    if (error.code === 11000) return res.status(409).json({ message: "You already reported this comment" });
    throw error;
  }
};

export const translatecomment = async (req, res) => {
  const { text, targetLanguage } = req.body;
  if (!text || !targetLanguage) return res.status(400).json({ message: "Text and target language are required" });
  if (!process.env.TRANSLATION_API_URL) {
    return res.status(200).json({ translatedText: text, translated: false, message: "Translation provider is not configured" });
  }
  return res.status(501).json({ message: "Translation adapter is not configured" });
};
