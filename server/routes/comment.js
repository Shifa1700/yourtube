import express from "express";
import {
  deletecomment,
  editcomment,
  getallcomment,
  postcomment,
  reactToComment,
  reportcomment,
  translatecomment,
} from "../controllers/comment.js";


const routes = express.Router();
routes.get("/:videoid", getallcomment);
routes.post("/postcomment", postcomment);
routes.delete("/deletecomment/:id", deletecomment);
routes.post("/editcomment/:id", editcomment);
routes.post("/:id/reaction", reactToComment);
routes.post("/report", reportcomment);
routes.post("/translate", translatecomment);
export default routes;
