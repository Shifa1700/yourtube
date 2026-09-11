import express from "express";
import { getProgress, saveProgress } from "../controllers/watchProgress.js";
import { requireFirebaseUser } from "../middleware/firebaseAuth.js";

const routes = express.Router();
routes.get("/:videoId", requireFirebaseUser, getProgress);
routes.put("/:videoId", requireFirebaseUser, saveProgress);
export default routes;
