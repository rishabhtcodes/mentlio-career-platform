"use client";

import { useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { toast } from "sonner";
import { useUserData } from "@/context/UserDataProvider";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { uploadToImageKit } from "@/lib/media/imagekit-upload";

export default function VideoUpload() {
  const supabase = createClient();
  const { mentor } = useUserData();
  const [progress, setProgress] = useState(0);
  const [status, setStatus] = useState<
    "idle" | "uploading" | "success" | "error"
  >("idle");
  const [errorText, setErrorText] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleUpload = async () => {
    const file = fileInputRef.current?.files?.[0];
    if (!file) {
      toast.error("Please select a video file.");
      return;
    }
    if (!mentor?.id) {
      toast.error("Mentor profile is still loading. Try again in a moment.");
      return;
    }

    try {
      setStatus("uploading");
      setProgress(0);
      setErrorText("");

      const videoUrl = await uploadToImageKit(file, "/videos", (pct) => setProgress(pct));

      const { error } = await supabase
        .from("mentors")
        .update({ video_url: videoUrl })
        .eq("id", mentor.id);

      if (error) throw error;

      toast.success("Video uploaded successfully!");
      setStatus("success");
    } catch (err: any) {
      console.error("Upload error:", err);
      setErrorText(err?.message || "Upload failed. Please try again.");
      toast.error(err?.message || "Video upload failed.");
      setStatus("error");
    }
  };

  return (
    <div>
      <div className="grid w-full max-w-sm items-center gap-3">
        <Label htmlFor="mentor-video-upload">Upload Video</Label>
        <Input
          id="mentor-video-upload"
          type="file"
          accept="video/*"
          onChange={handleUpload}
          ref={fileInputRef}
        />
      </div>
      {status === "uploading" && <div className="mt-2">Progress: {Math.round(progress)}%</div>}
      {status === "success" && (
        <div className="mt-2 text-sm text-green-700">
          Upload complete! The video is now on your mentor profile.
        </div>
      )}
      {status === "error" && (
        <div className="text-sm text-red-600 mt-2">{errorText || "Error occurred. Try again."}</div>
      )}
    </div>
  );
}
