import DownloadsContent from "@/components/DownloadsContent";
import React from "react";

export default function DownloadsPage() {
  return (
    <main className="flex-1 p-6">
      <div className="mx-auto max-w-5xl">
        <h1 className="mb-6 text-2xl font-bold">Downloads</h1>
        <DownloadsContent />
      </div>
    </main>
  );
}
