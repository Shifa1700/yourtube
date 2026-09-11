"use client";

import { useEffect, useRef, useState } from "react";
import { io, Socket } from "socket.io-client";
import { Camera, CameraOff, Mic, MicOff, PhoneOff, ScreenShare, Send } from "lucide-react";
import { Button } from "@/components/ui/button";

type Signal = { type: string; sdp?: string; candidate?: RTCIceCandidateInit };
type ChatMessage = { socketId: string; userName: string; message: string; sentAt: string };

export default function VideoCall() {
  const [roomId, setRoomId] = useState("");
  const [name, setName] = useState("");
  const [joined, setJoined] = useState(false);
  const [error, setError] = useState("");
  const [muted, setMuted] = useState(false);
  const [cameraOff, setCameraOff] = useState(false);
  const [connectionState, setConnectionState] = useState("connecting");
  const [chatInput, setChatInput] = useState("");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const localVideo = useRef<HTMLVideoElement>(null);
  const remoteVideo = useRef<HTMLVideoElement>(null);
  const socketRef = useRef<Socket | null>(null);
  const peerRef = useRef<RTCPeerConnection | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const backendUrl =
    process.env.NEXT_PUBLIC_BACKEND_URL ||
    process.env.BACKEND_URL ||
    "http://localhost:5000";
  const iceServers: RTCIceServer[] = [
    { urls: "stun:stun.l.google.com:19302" },
    ...(process.env.NEXT_PUBLIC_TURN_URL
      ? [
          {
            urls: process.env.NEXT_PUBLIC_TURN_URL,
            username: process.env.NEXT_PUBLIC_TURN_USERNAME,
            credential: process.env.NEXT_PUBLIC_TURN_CREDENTIAL,
          },
        ]
      : []),
  ];

  const sendSignal = (targetSocketId: string, signal: Signal) => {
    socketRef.current?.emit("signal", { roomId, targetSocketId, signal });
  };

  const createPeer = (targetSocketId: string) => {
    const peer = new RTCPeerConnection({
      iceServers,
    });
    peerRef.current = peer;
    streamRef.current?.getTracks().forEach((track) => {
      peer.addTrack(track, streamRef.current as MediaStream);
    });
    peer.ontrack = (event) => {
      if (remoteVideo.current) remoteVideo.current.srcObject = event.streams[0];
    };
    peer.onicecandidate = (event) => {
      if (event.candidate) sendSignal(targetSocketId, { type: "candidate", candidate: event.candidate });
    };
    peer.onconnectionstatechange = () => {
      setConnectionState(peer.connectionState);
    };
    return peer;
  };

  const join = async () => {
    if (!roomId.trim() || !name.trim()) {
      setError("Enter your name and a room ID.");
      return;
    }
    setError("");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
      streamRef.current = stream;
      if (localVideo.current) localVideo.current.srcObject = stream;
      const socket = io(backendUrl);
      socketRef.current = socket;
      socket.on("connect", () => setConnectionState("connected"));
      socket.on("disconnect", () => setConnectionState("reconnecting"));
      socket.on("connect_error", () => setConnectionState("reconnecting"));
      socket.on("call-error", (message: string) => setError(message));
      socket.on("call-joined", ({ isInitiator }: { isInitiator: boolean }) => {
        setJoined(true);
        if (isInitiator) return;
      });
      socket.on("participant-joined", async ({ socketId }: { socketId: string }) => {
        const peer = createPeer(socketId);
        const offer = await peer.createOffer();
        await peer.setLocalDescription(offer);
        sendSignal(socketId, offer);
      });
      socket.on("signal", async ({ senderSocketId, signal }: { senderSocketId: string; signal: Signal }) => {
        const peer = peerRef.current || createPeer(senderSocketId);
        if (signal.type === "offer") {
          await peer.setRemoteDescription(signal as RTCSessionDescriptionInit);
          const answer = await peer.createAnswer();
          await peer.setLocalDescription(answer);
          sendSignal(senderSocketId, answer);
        } else if (signal.type === "answer") {
          await peer.setRemoteDescription(signal as RTCSessionDescriptionInit);
        } else if (signal.type === "candidate" && signal.candidate) {
          await peer.addIceCandidate(signal.candidate);
        }
      });
      socket.on("participant-left", () => {
        if (remoteVideo.current) remoteVideo.current.srcObject = null;
        peerRef.current?.close();
        peerRef.current = null;
      });
      socket.on("call-chat", (message: ChatMessage) => {
        setMessages((current) => [...current, message].slice(-100));
      });
      socket.emit("join-call", { roomId: roomId.trim(), userName: name.trim() });
    } catch {
      setError("Camera or microphone permission was denied, or media is unavailable.");
    }
  };

  const leave = () => {
    socketRef.current?.emit("leave-call");
    socketRef.current?.disconnect();
    peerRef.current?.close();
    streamRef.current?.getTracks().forEach((track) => track.stop());
    if (localVideo.current) localVideo.current.srcObject = null;
    if (remoteVideo.current) remoteVideo.current.srcObject = null;
    setJoined(false);
  };

  const toggleTrack = (kind: "audio" | "video") => {
    const track = streamRef.current?.getTracks().find((item) => item.kind === kind);
    if (!track) return;
    track.enabled = !track.enabled;
    if (kind === "audio") setMuted(!track.enabled);
    else setCameraOff(!track.enabled);
  };

  const shareScreen = async () => {
    if (!peerRef.current || !navigator.mediaDevices.getDisplayMedia) return;
    const screen = await navigator.mediaDevices.getDisplayMedia({ video: true });
    const sender = peerRef.current.getSenders().find((item) => item.track?.kind === "video");
    if (sender) await sender.replaceTrack(screen.getVideoTracks()[0]);
    screen.getVideoTracks()[0].onended = () => {
      const camera = streamRef.current?.getVideoTracks()[0];
      if (camera && sender) void sender.replaceTrack(camera);
    };
  };

  const sendChat = () => {
    const message = chatInput.trim();
    if (!message) return;
    socketRef.current?.emit("call-chat", { roomId, message });
    setChatInput("");
  };

  useEffect(() => () => leave(), []);

  if (!joined) {
    return (
      <div className="mx-auto max-w-md space-y-4 rounded-lg border p-6">
        <h1 className="text-2xl font-semibold">Join a video call</h1>
        <input className="w-full rounded border p-2" placeholder="Your name" value={name} onChange={(event) => setName(event.target.value)} />
        <input className="w-full rounded border p-2" placeholder="Room ID" value={roomId} onChange={(event) => setRoomId(event.target.value)} />
        <Button onClick={() => void join()}>Join call</Button>
        {error && <p className="text-sm text-red-600">{error}</p>}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <video ref={localVideo} autoPlay muted playsInline className="aspect-video w-full rounded-lg bg-black" />
        <video ref={remoteVideo} autoPlay playsInline className="aspect-video w-full rounded-lg bg-black" />
      </div>
      <div className="flex justify-center gap-2">
        <Button variant="outline" onClick={() => toggleTrack("audio")}>{muted ? <MicOff /> : <Mic />} </Button>
        <Button variant="outline" onClick={() => toggleTrack("video")}>{cameraOff ? <CameraOff /> : <Camera />} </Button>
        <Button variant="outline" onClick={() => void shareScreen()}><ScreenShare /></Button>
        <Button variant="destructive" onClick={leave}><PhoneOff /> Leave</Button>
      </div>
      <p className="text-center text-sm text-muted-foreground">
        Connection: {connectionState}
      </p>
      <section className="mx-auto max-w-lg rounded-lg border p-3">
        <h2 className="mb-2 font-semibold">Call chat</h2>
        <div className="mb-3 max-h-40 space-y-1 overflow-y-auto text-sm">
          {messages.map((message) => (
            <p key={`${message.socketId}-${message.sentAt}`}>
              <strong>{message.userName}:</strong> {message.message}
            </p>
          ))}
        </div>
        <div className="flex gap-2">
          <input
            className="min-w-0 flex-1 rounded border p-2"
            value={chatInput}
            maxLength={500}
            placeholder="Type a message"
            onChange={(event) => setChatInput(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") sendChat();
            }}
          />
          <Button aria-label="Send chat message" onClick={sendChat}>
            <Send size={16} />
          </Button>
        </div>
      </section>
      {error && <p className="text-center text-sm text-red-600">{error}</p>}
    </div>
  );
}
