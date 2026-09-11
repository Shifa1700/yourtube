import crypto from "crypto";
import mongoose from "mongoose";
import users from "../Modals/Auth.js";
import LoginAttempt from "../Modals/LoginAttempt.js";
import OtpChallenge from "../Modals/OtpChallenge.js";
import TrustedDevice from "../Modals/TrustedDevice.js";
import { parseDevice } from "../utils/device.js";

const trustedDays = 30;

const hashCode = (code) =>
  crypto.createHash("sha256").update(code).digest("hex");

export const recordLogin = async (req, res) => {
  const { fingerprint } = req.body;
  const { email, name, picture: image, uid: firebaseUid } = req.firebaseUser;
  if (!email) return res.status(400).json({ message: "Verified email is required" });

  let user = await users.findOne({ firebaseUid });
  if (!user) user = await users.findOne({ email });
  if (!user) user = await users.create({ email, name, image, firebaseUid });
  else if (user.firebaseUid !== firebaseUid) {
    user.firebaseUid = firebaseUid;
    await user.save();
  }

  const device = parseDevice(req.get("user-agent"));
  const ipAddress = req.headers["x-forwarded-for"]?.split(",")[0]?.trim() || req.ip;
  const existingDevice = await TrustedDevice.findOne({
    userId: user._id,
    fingerprint: fingerprint || device.fingerprint,
    expiresAt: { $gt: new Date() },
  });
  const locationChanged = false;
  const requiresOtp = !existingDevice || locationChanged;
  const attempt = await LoginAttempt.create({
    userId: user._id,
    email,
    ipAddress,
    ...device,
    status: requiresOtp ? "pending-otp" : "success",
    trustedDeviceExpiresAt: existingDevice?.expiresAt,
  });

  if (!requiresOtp) return res.status(200).json({ result: user, requiresOtp: false });

  const code = String(crypto.randomInt(100000, 1000000));
  await OtpChallenge.create({
    userId: user._id,
    loginAttemptId: attempt._id,
    codeHash: hashCode(code),
    expiresAt: new Date(Date.now() + 10 * 60 * 1000),
  });
  console.info(`Development OTP for ${email}: ${code}`);
  return res.status(202).json({
    requiresOtp: true,
    attemptId: attempt._id,
    message: "OTP verification is required for this device.",
  });
};

export const verifyLoginOtp = async (req, res) => {
  const { attemptId, code, trustDevice = true } = req.body;
  if (!mongoose.Types.ObjectId.isValid(attemptId) || !/^\d{6}$/.test(code || "")) {
    return res.status(400).json({ message: "Invalid OTP request" });
  }
  const attempt = await LoginAttempt.findById(attemptId);
  const challenge = await OtpChallenge.findOne({ loginAttemptId: attemptId });
  if (!attempt || !challenge || challenge.expiresAt <= new Date()) {
    return res.status(400).json({ message: "OTP expired or unavailable" });
  }
  if (challenge.attempts >= 5) {
    return res.status(429).json({ message: "Too many OTP attempts" });
  }
  challenge.attempts += 1;
  if (hashCode(code) !== challenge.codeHash) {
    await challenge.save();
    await LoginAttempt.findByIdAndUpdate(attemptId, { status: "failed" });
    return res.status(401).json({ message: "Invalid OTP" });
  }
  const expiresAt = new Date(Date.now() + trustedDays * 24 * 60 * 60 * 1000);
  challenge.verifiedAt = new Date();
  await challenge.save();
  await LoginAttempt.findByIdAndUpdate(attemptId, {
    status: "success",
    otpVerifiedAt: new Date(),
    trustedDeviceExpiresAt: trustDevice ? expiresAt : null,
  });
  if (trustDevice) {
    await TrustedDevice.findOneAndUpdate(
      { userId: attempt.userId, fingerprint: parseDevice(req.get("user-agent")).fingerprint },
      {
        userId: attempt.userId,
        fingerprint: parseDevice(req.get("user-agent")).fingerprint,
        ...parseDevice(req.get("user-agent")),
        ipAddress: req.ip,
        expiresAt,
        lastSeenAt: new Date(),
      },
      { upsert: true, new: true }
    );
  }
  const user = await users.findById(attempt.userId);
  return res.status(200).json({ result: user, requiresOtp: false });
};

export const getSecurityHistory = async (req, res) => {
  const user = await users.findOne({ firebaseUid: req.firebaseUser.uid }).select("_id");
  if (!user) return res.status(404).json({ message: "User not found" });
  const [attempts, devices] = await Promise.all([
    LoginAttempt.find({ userId: user._id }).sort({ createdAt: -1 }).limit(50),
    TrustedDevice.find({ userId: user._id, expiresAt: { $gt: new Date() } }).sort({ lastSeenAt: -1 }),
  ]);
  return res.status(200).json({ attempts, devices });
};
