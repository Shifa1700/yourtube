"use client";

import {
  Captions,
  Maximize,
  Minimize,
  Pause,
  PictureInPicture,
  Play,
  Settings,
  Volume2,
  VolumeX,
} from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import axiosInstance from "@/lib/axiosinstance";
import { auth } from "@/lib/firebase";
import { getBackendAssetUrl } from "@/lib/backendUrl";

interface VideoPlayerProps {
  video: {
    _id: string;
    videotitle: string;
    filepath: string;
    captionsUrl?: string;
  };
}

const speeds = [0.5, 1, 1.25, 1.5, 2];

const formatTime = (seconds: number) => {
  if (!Number.isFinite(seconds)) return "0:00";
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = Math.floor(seconds % 60)
    .toString()
    .padStart(2, "0");
  return `${minutes}:${remainingSeconds}`;
};

export default function VideoPlayer({ video }: VideoPlayerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const hideTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const storageKey = `video-progress:${video._id}`;
  const [isPlaying, setIsPlaying] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [volume, setVolume] = useState(1);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [buffered, setBuffered] = useState(0);
  const [speed, setSpeed] = useState(1);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isTheater, setIsTheater] = useState(false);
  const [showControls, setShowControls] = useState(true);
  const [showSpeedMenu, setShowSpeedMenu] = useState(false);
  const [captionsEnabled, setCaptionsEnabled] = useState(false);
  const lastSyncedTimeRef = useRef(0);

  const syncProgress = useCallback(async (completed = false) => {
    const element = videoRef.current;
    if (!element || !auth.currentUser || !Number.isFinite(element.duration)) return;
    if (!completed && Math.abs(element.currentTime - lastSyncedTimeRef.current) < 5) return;
    const token = await auth.currentUser.getIdToken();
    await axiosInstance.put(
      `/watch-progress/${video._id}`,
      {
        currentTime: element.currentTime,
        duration: element.duration,
        completed,
      },
      { headers: { Authorization: `Bearer ${token}` } }
    );
    lastSyncedTimeRef.current = element.currentTime;
  }, [video._id]);

  const revealControls = useCallback(() => {
    setShowControls(true);
    if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
    if (isPlaying) {
      hideTimerRef.current = setTimeout(() => setShowControls(false), 3000);
    }
  }, [isPlaying]);

  const togglePlay = useCallback(() => {
    const element = videoRef.current;
    if (!element) return;
    if (element.paused) {
      document.querySelectorAll("video").forEach((other) => {
        if (other !== element) other.pause();
      });
      void element.play();
    } else {
      element.pause();
    }
    revealControls();
  }, [revealControls]);

  const seek = (amount: number) => {
    const element = videoRef.current;
    if (!element) return;
    element.currentTime = Math.min(
      Math.max(element.currentTime + amount, 0),
      element.duration || 0
    );
    revealControls();
  };

  const toggleFullscreen = async () => {
    if (!containerRef.current) return;
    if (document.fullscreenElement) {
      await document.exitFullscreen();
    } else {
      await containerRef.current.requestFullscreen();
    }
  };

  const togglePictureInPicture = async () => {
    const element = videoRef.current;
    if (!element || !document.pictureInPictureEnabled) return;
    if (document.pictureInPictureElement) {
      await document.exitPictureInPicture();
    } else {
      await element.requestPictureInPicture();
    }
  };

  useEffect(() => {
    const element = videoRef.current;
    if (!element) return;

    const restorePosition = async () => {
      const saved = Number(localStorage.getItem(storageKey));
      let resumeTime = saved;
      if (auth.currentUser) {
        try {
          const token = await auth.currentUser.getIdToken();
          const response = await axiosInstance.get(`/watch-progress/${video._id}`, {
            headers: { Authorization: `Bearer ${token}` },
          });
          resumeTime = Number(response.data?.currentTime) || saved;
        } catch (error) {
          console.error("Unable to load server watch progress:", error);
        }
      }
      if (resumeTime > 0 && resumeTime < element.duration - 5) {
        element.currentTime = resumeTime;
      }
    };
    const updateProgress = () => {
      setCurrentTime(element.currentTime);
      if (element.buffered.length) {
        setBuffered(element.buffered.end(element.buffered.length - 1));
      }
      localStorage.setItem(storageKey, String(element.currentTime));
    };
    const onPlay = () => setIsPlaying(true);
    const onPause = () => {
      setIsPlaying(false);
      void syncProgress();
    };
    const onEnded = () => {
      setIsPlaying(false);
      localStorage.removeItem(storageKey);
      void syncProgress(true);
    };
    const onFullscreen = () =>
      setIsFullscreen(Boolean(document.fullscreenElement));

    element.addEventListener("loadedmetadata", restorePosition);
    element.addEventListener("timeupdate", updateProgress);
    element.addEventListener("progress", updateProgress);
    element.addEventListener("play", onPlay);
    element.addEventListener("pause", onPause);
    element.addEventListener("ended", onEnded);
    document.addEventListener("fullscreenchange", onFullscreen);

    return () => {
      element.removeEventListener("loadedmetadata", restorePosition);
      element.removeEventListener("timeupdate", updateProgress);
      element.removeEventListener("progress", updateProgress);
      element.removeEventListener("play", onPlay);
      element.removeEventListener("pause", onPause);
      element.removeEventListener("ended", onEnded);
      document.removeEventListener("fullscreenchange", onFullscreen);
    };
  }, [storageKey, syncProgress, video._id]);

  useEffect(() => {
    const interval = window.setInterval(() => void syncProgress(), 10000);
    return () => window.clearInterval(interval);
  }, [syncProgress]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement;
      if (["INPUT", "TEXTAREA", "BUTTON"].includes(target.tagName)) return;
      switch (event.key.toLowerCase()) {
        case " ":
        case "k":
          event.preventDefault();
          togglePlay();
          break;
        case "arrowleft":
          event.preventDefault();
          seek(event.shiftKey ? -30 : -10);
          break;
        case "arrowright":
          event.preventDefault();
          seek(event.shiftKey ? 30 : 10);
          break;
        case "arrowup":
          event.preventDefault();
          setVolume((value) => Math.min(value + 0.1, 1));
          break;
        case "arrowdown":
          event.preventDefault();
          setVolume((value) => Math.max(value - 0.1, 0));
          break;
        case "m":
          setIsMuted((value) => !value);
          break;
        case "f":
          void toggleFullscreen();
          break;
        case "t":
          setIsTheater((value) => !value);
          break;
        case "p":
          void togglePictureInPicture();
          break;
        case "c":
          setCaptionsEnabled((value) => !value);
          break;
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [togglePlay]);

  useEffect(() => {
    const element = videoRef.current;
    if (!element) return;
    element.volume = volume;
    element.muted = isMuted || volume === 0;
  }, [isMuted, volume]);

  useEffect(() => {
    const element = videoRef.current;
    if (!element) return;
    element.playbackRate = speed;
  }, [speed]);

  return (
    <div
      ref={containerRef}
      onMouseMove={revealControls}
      className={`group relative overflow-hidden rounded-lg bg-black ${
        isTheater ? "fixed inset-4 z-50 md:inset-8" : "aspect-video"
      }`}
    >
      <video
        ref={videoRef}
        className="h-full w-full"
        poster="/placeholder.svg?height=480&width=854"
        onClick={togglePlay}
        onLoadedMetadata={(event) => setDuration(event.currentTarget.duration)}
        onVolumeChange={(event) => {
          setVolume(event.currentTarget.volume);
          setIsMuted(event.currentTarget.muted);
        }}
      >
        <source
          src={getBackendAssetUrl(video.filepath)}
          type="video/mp4"
        />
        {video.captionsUrl && (
          <track
            kind="subtitles"
            src={video.captionsUrl}
            srcLang="en"
            label="English"
            default={captionsEnabled}
          />
        )}
        Your browser does not support the video tag.
      </video>

      <div
        className={`absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/90 to-transparent p-3 pt-12 transition-opacity ${
          showControls ? "opacity-100" : "pointer-events-none opacity-0"
        }`}
      >
        <div className="relative mb-2 h-1.5 rounded bg-white/30">
          <div
            className="absolute h-full rounded bg-white/40"
            style={{ width: `${duration ? (buffered / duration) * 100 : 0}%` }}
          />
          <input
            aria-label="Video progress"
            type="range"
            min={0}
            max={duration || 0}
            step={0.1}
            value={currentTime}
            onChange={(event) => {
              const nextTime = Number(event.target.value);
              if (videoRef.current) videoRef.current.currentTime = nextTime;
              setCurrentTime(nextTime);
            }}
            className="absolute inset-0 h-1.5 w-full cursor-pointer opacity-0"
          />
          <div
            className="h-full rounded bg-red-600"
            style={{ width: `${duration ? (currentTime / duration) * 100 : 0}%` }}
          />
        </div>

        <div className="flex items-center gap-2 text-white">
          <button aria-label={isPlaying ? "Pause" : "Play"} onClick={togglePlay}>
            {isPlaying ? <Pause size={20} /> : <Play size={20} />}
          </button>
          <button aria-label="Seek backward 10 seconds" onClick={() => seek(-10)}>
            -10
          </button>
          <button aria-label="Seek forward 10 seconds" onClick={() => seek(10)}>
            +10
          </button>
          <button
            aria-label={isMuted ? "Unmute" : "Mute"}
            onClick={() => setIsMuted((value) => !value)}
          >
            {isMuted || volume === 0 ? <VolumeX size={20} /> : <Volume2 size={20} />}
          </button>
          <input
            aria-label="Volume"
            type="range"
            min={0}
            max={1}
            step={0.05}
            value={isMuted ? 0 : volume}
            onChange={(event) => setVolume(Number(event.target.value))}
            className="w-20"
          />
          <span className="text-xs">
            {formatTime(currentTime)} / {formatTime(duration)}
          </span>
          <div className="ml-auto flex items-center gap-3">
            <button aria-label="Toggle captions" onClick={() => setCaptionsEnabled((value) => !value)}>
              <Captions size={19} />
            </button>
            <div className="relative">
              <button aria-label="Playback speed" onClick={() => setShowSpeedMenu((value) => !value)}>
                <Settings size={19} />
              </button>
              {showSpeedMenu && (
                <div className="absolute bottom-8 right-0 rounded bg-black p-2 text-xs">
                  {speeds.map((value) => (
                    <button
                      key={value}
                      className="block w-16 px-2 py-1 text-left hover:bg-white/20"
                      onClick={() => {
                        setSpeed(value);
                        setShowSpeedMenu(false);
                      }}
                    >
                      {value}x
                    </button>
                  ))}
                </div>
              )}
            </div>
            <button aria-label="Picture in Picture" onClick={() => void togglePictureInPicture()}>
              <PictureInPicture size={19} />
            </button>
            <button aria-label="Theater mode" onClick={() => setIsTheater((value) => !value)}>
              {isTheater ? <Minimize size={19} /> : <Maximize size={19} />}
            </button>
            <button aria-label="Fullscreen" onClick={() => void toggleFullscreen()}>
              {isFullscreen ? <Minimize size={19} /> : <Maximize size={19} />}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
