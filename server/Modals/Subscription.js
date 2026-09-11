import mongoose from "mongoose";

const subscriptionschema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "user", required: true },
    plan: {
      type: String,
      enum: ["Free", "Bronze", "Silver", "Gold"],
      default: "Free",
    },
    status: {
      type: String,
      enum: ["active", "expired", "cancelled", "pending"],
      default: "active",
    },
    billingPeriod: {
      type: String,
      enum: ["monthly", "quarterly", "yearly"],
      default: "monthly",
    },
    startsAt: { type: Date, default: Date.now },
    expiresAt: { type: Date },
    nextRenewalAt: { type: Date },
    razorpayOrderId: String,
    razorpayPaymentId: String,
    razorpaySignature: String,
    amount: Number,
    currency: { type: String, default: "INR" },
    invoiceNumber: String,
  },
  { timestamps: true }
);

export default mongoose.model("subscription", subscriptionschema);
