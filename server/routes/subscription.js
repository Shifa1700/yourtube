import express from "express";
import {
  createOrder,
  getPlans,
  getSubscription,
  verifyPayment,
} from "../controllers/subscription.js";
import { requireFirebaseUser } from "../middleware/firebaseAuth.js";

const routes = express.Router();
routes.get("/plans", getPlans);
routes.get("/me", requireFirebaseUser, getSubscription);
routes.post("/order", requireFirebaseUser, createOrder);
routes.post("/verify", requireFirebaseUser, verifyPayment);
export default routes;
