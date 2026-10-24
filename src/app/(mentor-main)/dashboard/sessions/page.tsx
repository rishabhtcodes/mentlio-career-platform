"use client";
import React from "react";
import MentorSessionsTabs from "../../_components/MentorTabs";

const SessionsPage = () => (
  <div className="flex flex-col px-4 pb-20 bg-gray-50 min-h-screen">
    <h1 className="font-sora text-2xl font-semibold py-6">All Sessions</h1>
    <MentorSessionsTabs />
  </div>
);

export default SessionsPage;
