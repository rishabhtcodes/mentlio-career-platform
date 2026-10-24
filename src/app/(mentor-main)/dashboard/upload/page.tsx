"use client";
import React from "react";
import { useUserData } from "@/context/UserDataProvider";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import VideoUpload from "../../_components/VideoUpload";

const UploadPage = () => {
  const { mentor } = useUserData();

  return (
    <div className="flex flex-col gap-6 px-4 pb-20 bg-gray-50 min-h-screen">
      <h1 className="font-sora text-2xl font-semibold py-6">Upload Intro Video</h1>

      <Card className="max-w-xl">
        <CardHeader>
          <CardTitle className="text-base font-medium">Video file</CardTitle>
        </CardHeader>
        <CardContent>
          <VideoUpload />
          <p className="text-xs text-muted-foreground mt-3">
            The uploaded link is saved on your mentor profile and shown to students on the
            mentor connect page.
          </p>
        </CardContent>
      </Card>

      {mentor?.video_url ? (
        <Card className="max-w-xl">
          <CardHeader>
            <CardTitle className="text-base font-medium">Current profile video</CardTitle>
          </CardHeader>
          <CardContent>
            <video src={mentor.video_url} controls className="w-full rounded-md bg-black" />
          </CardContent>
        </Card>
      ) : (
        <p className="text-sm text-muted-foreground">No profile video uploaded yet.</p>
      )}
    </div>
  );
};

export default UploadPage;
