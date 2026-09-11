import crypto from "crypto";
import mongoose from "mongoose";
import Subscription from "../Modals/Subscription.js";
import users from "../Modals/Auth.js";
import Razorpay from "razorpay";

export const PLAN_DEFINITIONS = {
  Free: { monthly: 0, dailyDownloads: 1, quality: "720p", premium: false },
  Bronze: { monthly: 99, dailyDownloads: 3, quality: "1080p", premium: true },
  Silver: { monthly: 199, dailyDownloads: 5, quality: "1440p", premium: true },
  Gold: { monthly: 399, dailyDownloads: 10, quality: "2160p", premium: true },
};

const periodMonths = { monthly: 1, quarterly: 3, yearly: 12 };

export const getPlans = (_req, res) => {
  return res.status(200).json(PLAN_DEFINITIONS);
};

export const getSubscription = async (req, res) => {
  const user = await users.findOne({ firebaseUid: req.firebaseUser.uid }).select("plan subscriptionExpiresAt");
  if (!user) return res.status(404).json({ message: "User unavailable" });

  if (user.subscriptionExpiresAt && user.subscriptionExpiresAt <= new Date()) {
    user.plan = "Free";
    user.subscriptionExpiresAt = null;
    await user.save();
  }

  const subscription = await Subscription.findOne({ userId: user._id }).sort({ createdAt: -1 });
  return res.status(200).json({
    plan: user.plan,
    expiresAt: user.subscriptionExpiresAt,
    subscription,
    plans: PLAN_DEFINITIONS,
  });
};

export const createOrder = async (req, res) => {
  const { plan = "Bronze", billingPeriod = "monthly" } = req.body;
  if (!PLAN_DEFINITIONS[plan]) {
    return res.status(400).json({ message: "Invalid subscription request" });
  }
  if (plan === "Free" || !periodMonths[billingPeriod]) {
    return res.status(400).json({ message: "A paid billing period is required" });
  }
  if (!process.env.RAZORPAY_KEY_ID || !process.env.RAZORPAY_KEY_SECRET) {
    return res.status(503).json({
      message: "Razorpay is not configured. Add RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET to server/.env.",
    });
  }
  const user = await users.findOne({ firebaseUid: req.firebaseUser.uid });
  if (!user) return res.status(404).json({ message: "User unavailable" });
  const amount = PLAN_DEFINITIONS[plan].monthly * (periodMonths[billingPeriod] || 1) * 100;
  const razorpay = new Razorpay({
    key_id: process.env.RAZORPAY_KEY_ID,
    key_secret: process.env.RAZORPAY_KEY_SECRET,
  });
  const order = await razorpay.orders.create({
    amount,
    currency: "INR",
    receipt: `yt_${user._id}_${Date.now()}`,
    notes: { userId: String(user._id), plan, billingPeriod },
  });
  await Subscription.create({
    userId: user._id,
    plan,
    billingPeriod,
    status: "pending",
    amount: amount / 100,
    currency: "INR",
    razorpayOrderId: order.id,
  });
  return res.status(201).json({
    orderId: order.id,
    amount: order.amount,
    currency: order.currency,
    keyId: process.env.RAZORPAY_KEY_ID,
    plan,
    billingPeriod,
  });
};

export const verifyPayment = async (req, res) => {
  const {
    plan,
    billingPeriod = "monthly",
    razorpayOrderId,
    razorpayPaymentId,
    razorpaySignature,
    razorpay_order_id,
    razorpay_payment_id,
    razorpay_signature,
  } = req.body;
  const normalizedOrderId = razorpayOrderId || razorpay_order_id;
  const normalizedPaymentId = razorpayPaymentId || razorpay_payment_id;
  const normalizedSignature = razorpaySignature || razorpay_signature;
  console.info("Payment verification received", {
    plan,
    billingPeriod,
    razorpayOrderId: normalizedOrderId,
    hasPaymentId: Boolean(normalizedPaymentId),
    hasSignature: Boolean(normalizedSignature),
  });
  if (!PLAN_DEFINITIONS[plan]) {
    return res.status(400).json({ message: "Invalid payment request" });
  }
  if (!process.env.RAZORPAY_KEY_SECRET) {
    return res.status(503).json({ message: "Razorpay is not configured" });
  }
  if (!normalizedOrderId || !normalizedPaymentId || !normalizedSignature) {
    return res.status(400).json({ message: "Incomplete payment verification data" });
  }
  const expected = crypto
    .createHmac("sha256", process.env.RAZORPAY_KEY_SECRET)
    .update(`${normalizedOrderId}|${normalizedPaymentId}`)
    .digest("hex");
  if (expected !== normalizedSignature) {
    console.error("Payment signature mismatch", { razorpayOrderId: normalizedOrderId });
    return res.status(400).json({ message: "Payment signature verification failed" });
  }

  const user = await users.findOne({ firebaseUid: req.firebaseUser.uid });
  if (!user) return res.status(404).json({ message: "User unavailable" });
  const pending = await Subscription.findOne({
    userId: user._id,
    razorpayOrderId: normalizedOrderId,
    status: "pending",
  });
  if (!pending) {
    console.error("Pending payment order not found", {
      razorpayOrderId: normalizedOrderId,
      userId: user._id,
    });
    return res.status(400).json({ message: "Payment order not found" });
  }
  if (pending.plan !== plan || pending.billingPeriod !== billingPeriod) {
    return res.status(400).json({ message: "Payment details do not match the order" });
  }
  const startsAt = new Date();
  const expiresAt = new Date(startsAt);
  expiresAt.setMonth(expiresAt.getMonth() + (periodMonths[billingPeriod] || 1));
  const invoiceNumber = `YT-${Date.now()}`;
  pending.status = "active";
  pending.startsAt = startsAt;
  pending.expiresAt = expiresAt;
  pending.nextRenewalAt = expiresAt;
  pending.razorpayPaymentId = normalizedPaymentId;
  pending.razorpaySignature = normalizedSignature;
  pending.amount = PLAN_DEFINITIONS[plan].monthly * (periodMonths[billingPeriod] || 1);
  pending.invoiceNumber = invoiceNumber;
  const subscription = await pending.save();
  await users.findByIdAndUpdate(user._id, {
    plan,
    subscriptionExpiresAt: expiresAt,
  });
  return res.status(201).json({ subscription });
};
