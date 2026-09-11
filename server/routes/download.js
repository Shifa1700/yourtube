import express from "express";
import { downloadVideo, getDownloads } from "../controllers/download.js";

const routes = express.Router();
routes.get("/:userId", getDownloads);
routes.post("/", downloadVideo);
export default routes;
