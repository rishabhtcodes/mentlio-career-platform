/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import Image from "next/image";
import { useUserData } from "@/context/UserDataProvider";
import { uploadToImageKit } from "@/lib/media/imagekit-upload";
import { toast } from "sonner";

export default function MentorAvatar() {
  const { mentor } = useUserData();
  const supabase = createClient();
  const [uploading, setUploading] = useState(false);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(mentor?.avatar || null);

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!mentor?.id) {
      toast.error("Mentor profile is still loading. Try again in a moment.");
      return;
    }

    setUploading(true);
    try {
      const publicUrl = await uploadToImageKit(file, "/avatars");

      setAvatarUrl(publicUrl);

      const { error: dbError } = await supabase
        .from("mentors")
        .update({ avatar: publicUrl })
        .eq("id", mentor.id);

      if (dbError) throw dbError;

      toast.success("Avatar updated successfully!");
    } catch (err: any) {
      console.error("Avatar upload error:", err);
      toast.error(err?.message || "Avatar upload failed.");
      e.target.value = "";
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="flex flex-col items-center gap-4">
      <Image
        src={avatarUrl || "/user.png"}
        alt="Avatar"
        width={100}
        height={100}
        className="w-32 h-32 rounded-full object-cover"
      />
      <label htmlFor="mentor-avatar-upload" className="cursor-pointer px-4 py-2 bg-blue-600 text-white rounded">
        {uploading ? "Uploading..." : "Upload Avatar"}
        <input
          id="mentor-avatar-upload"
          type="file"
          hidden
          accept="image/*"
          onChange={handleUpload}
        />
      </label>
    </div>
  );
}
