import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import bodyParser from "body-parser";
import mongoose from "mongoose";
import { createServer } from "http";
import { Server } from "socket.io";
import userroutes from "./routes/auth.js";
import videoroutes from "./routes/video.js";
import likeroutes from "./routes/like.js";
import watchlaterroutes from "./routes/watchlater.js";
import historyrroutes from "./routes/history.js";
import commentroutes from "./routes/comment.js";
import subscriptionroutes from "./routes/subscription.js";
import downloadroutes from "./routes/download.js";
import securityroutes from "./routes/security.js";
import watchProgressRoutes from "./routes/watchProgress.js";
dotenv.config();
const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: { origin: true },
});
const rooms = new Map();

io.on("connection", (socket) => {
  socket.on("join-call", ({ roomId, userName }) => {
    if (!roomId || !userName) return;
    const participants = rooms.get(roomId) || new Map();
    if (participants.size >= 2) {
      socket.emit("call-error", "This one-to-one room is full.");
      return;
    }

    socket.join(roomId);
    participants.set(socket.id, { userName });
    rooms.set(roomId, participants);
    socket.data.roomId = roomId;
    socket.data.userName = userName;
    socket.emit("call-joined", {
      participantCount: participants.size,
      isInitiator: participants.size === 1,
    });
    socket.to(roomId).emit("participant-joined", {
      socketId: socket.id,
      userName,
    });
  });

  socket.on("signal", ({ roomId, targetSocketId, signal }) => {
    if (socket.data.roomId !== roomId || !targetSocketId || !signal) return;
    io.to(targetSocketId).emit("signal", {
      senderSocketId: socket.id,
      signal,
    });

  });

  socket.on("call-chat", ({ roomId, message }) => {
    if (socket.data.roomId !== roomId || typeof message !== "string") return;
    const text = message.trim().slice(0, 500);
    if (!text) return;
    io.to(roomId).emit("call-chat", {
      socketId: socket.id,
      userName: socket.data.userName,
      message: text,
      sentAt: new Date().toISOString(),
    });
  });

  socket.on("leave-call", () => {
    const roomId = socket.data.roomId;
    if (!roomId) return;
    socket.to(roomId).emit("participant-left", socket.id);
    const participants = rooms.get(roomId);
    participants?.delete(socket.id);
    if (participants?.size === 0) rooms.delete(roomId);
    socket.leave(roomId);
    socket.data.roomId = undefined;
  });

  socket.on("disconnect", () => {
    const roomId = socket.data.roomId;
    if (!roomId) return;
    socket.to(roomId).emit("participant-left", socket.id);
    const participants = rooms.get(roomId);
    participants?.delete(socket.id);
    if (participants?.size === 0) rooms.delete(roomId);
  });
});
import path from "path";
import { fileURLToPath } from "url";
app.use(cors());
app.use(express.json({ limit: "30mb", extended: true }));
app.use(express.urlencoded({ limit: "30mb", extended: true }));
const uploadsDirectory = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "uploads",
);
app.use("/uploads", express.static(uploadsDirectory));
app.get("/", (req, res) => {
  res.send("You tube backend is working");
});
app.use(bodyParser.json());
app.use("/user", userroutes);
app.use("/video", videoroutes);
app.use("/like", likeroutes);
app.use("/watch", watchlaterroutes);
app.use("/history", historyrroutes);
app.use("/comment", commentroutes);
app.use("/subscription", subscriptionroutes);
app.use("/download", downloadroutes);
app.use("/security", securityroutes);
app.use("/watch-progress", watchProgressRoutes);
const PORT = process.env.PORT || 5000;

httpServer.listen(PORT, () => {
  console.log(`server running on port ${PORT}`);
});

const DBURL = process.env.DB_URL;
if (!DBURL) {
  console.error("DB_URL is not configured. Add it to server/.env before starting.");
  process.exit(1);
}

mongoose
  .connect(DBURL)
  .then(() => {
    console.log("Mongodb connected");
  })
  .catch((error) => {
    console.error("MongoDB connection failed:", error.message);
    process.exit(1);
  });
