import express from "express";
import {
  getSecurityHistory,
  recordLogin,
  verifyLoginOtp,
} from "../controllers/security.js";
import { requireFirebaseUser } from "../middleware/firebaseAuth.js";

const routes = express.Router();
routes.post("/login", requireFirebaseUser, recordLogin);
routes.post("/verify-otp", verifyLoginOtp);
routes.get("/", requireFirebaseUser, getSecurityHistory);
export default routes;
