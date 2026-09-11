"use client";

import Link from "next/link";
import { Download, FileVideo, Lock } from "lucide-react";
import { useEffect, useState } from "react";
import { format } from "date-fns";
import { useUser } from "@/lib/AuthContext";
import axiosInstance from "@/lib/axiosinstance";

type DownloadRecord = {
  _id: string;
  videoId: { _id: string; videotitle: string; filesize?: number };
  thumbnail?: string;
  downloadedAt: string;
  status: "completed" | "failed" | "in-progress";
  filesize?: number;
  plan: string;
  remainingQuota: number;
};

const formatSize = (bytes?: number) => {
  if (!bytes) return "Unknown size";
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

export default function DownloadsContent() {
  const { user } = useUser();
  const [downloads, setDownloads] = useState<DownloadRecord[]>([]);

  useEffect(() => {
    if (!user) return;

    axiosInstance
      .get(`/download/${user._id}`)
      .then((response) => setDownloads(response.data))
      .catch((error) => console.error("Unable to load downloads:", error));
  }, [user]);

  if (!user) {
    return (
      <div className="rounded-lg border p-10 text-center">
        <Lock className="mx-auto mb-4 h-12 w-12 text-gray-400" />
        <h2 className="text-xl font-semibold">Sign in to view downloads</h2>
        <p className="mt-2 text-gray-600">
          Downloaded videos are available only in your profile.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold">Your downloads</h2>
          <p className="text-sm text-gray-600">
            Download history and quota status
          </p>
        </div>
        <div className="rounded-md bg-gray-100 px-3 py-2 text-sm">
          Quota is managed by your subscription
        </div>
      </div>

      {downloads.length === 0 ? (
        <div className="rounded-lg border p-10 text-center">
          <Download className="mx-auto mb-4 h-12 w-12 text-gray-400" />
          <h3 className="font-semibold">No downloads yet</h3>
          <p className="mt-2 text-sm text-gray-600">
            Videos you download will appear here with their status and quota
            details.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {downloads.map((item) => (
            <div
              key={item._id}
              className="flex gap-4 rounded-lg border p-3"
            >
              <div className="flex h-24 w-40 shrink-0 items-center justify-center overflow-hidden rounded bg-gray-100">
                {item.thumbnail ? (
                  <img
                    src={item.thumbnail}
                    alt=""
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <FileVideo className="h-8 w-8 text-gray-400" />
                )}
              </div>
              <div className="min-w-0 flex-1">
                <Link
                  href={`/watch/${item.videoId._id}`}
                  className="font-medium hover:text-blue-600"
                >
                  {item.videoId.videotitle}
                </Link>
                <p className="mt-1 text-sm text-gray-600">
                  {format(new Date(item.downloadedAt), "PPp")}
                </p>
                <p className="mt-1 text-xs text-gray-500">
                  {formatSize(item.videoId.filesize)} · Plan: {item.plan} · Remaining
                  quota: {item.remainingQuota}
                </p>
              </div>
              <span
                className={`self-start rounded px-2 py-1 text-xs ${
                  item.status === "completed"
                    ? "bg-green-100 text-green-700"
                    : item.status === "failed"
                      ? "bg-red-100 text-red-700"
                      : "bg-yellow-100 text-yellow-700"
                }`}
              >
                {item.status}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
