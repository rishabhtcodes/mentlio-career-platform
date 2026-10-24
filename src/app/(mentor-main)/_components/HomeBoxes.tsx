"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CalendarCheck, CalendarClock, CheckCircle } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { useUserData } from "@/context/UserDataProvider";
import { MentorSession } from "@/lib/types/allTypes";

export function StatsBoxes() {
  const supabase = createClient();
  const { mentor } = useUserData();
  const [sessions, setSessions] = useState<MentorSession[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if (!mentor?.id) return;
    (async () => {
      const { data, error } = await supabase
        .from("mentor_sessions")
        .select("*")
        .eq("mentor_id", mentor.id);
      if (error) {
        console.error("Error loading mentor session stats:", error);
      } else {
        setSessions(data || []);
      }
      setLoaded(true);
    })();
  }, [mentor?.id]);

  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

  const upcoming = sessions.filter(
    (s) => s.status === "accepted" && s.scheduled_at && new Date(s.scheduled_at) >= now
  ).length;
  const completedThisMonth = sessions.filter(
    (s) => s.status === "completed" && s.completed_at && new Date(s.completed_at) >= monthStart
  ).length;
  const scheduledToday = sessions.filter(
    (s) =>
      s.scheduled_at &&
      new Date(s.scheduled_at).toDateString() === now.toDateString() &&
      s.status !== "rejected"
  ).length;

  const value = (n: number) => (loaded ? String(n) : "…");

  return (
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 w-full my-5">
      <Card className="p-4 hover:shadow-md transition bg-gradient-to-br from-blue-300/70 via-blue-200/60 to-purple-200/60 ">
        <CardHeader className="">
          <CardTitle className="text-lg font-sora font-medium flex items-center gap-2">
            <CalendarCheck className="w-5 h-5 text-blue-500" /> Booked Sessions
          </CardTitle>
        </CardHeader>
        <CardContent className="-mt-2">
          <p className="text-3xl font-inter font-bold">{value(sessions.length)}</p>
          <p className="text-sm mt-1 text-muted-foreground">All time requests received</p>
        </CardContent>
      </Card>

      <Card className="p-3 hover:shadow-md transition">
        <CardHeader className="">
          <CardTitle className="text-lg font-sora font-medium flex items-center gap-2">
            <CalendarClock className="w-5 h-5 text-blue-500 -ml-2 shrink-0" /> Upcoming Sessions
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-3xl font-inter font-bold">{value(upcoming)}</p>
          <p className="text-sm mt-1 text-muted-foreground">Today: {scheduledToday} session(s)</p>
        </CardContent>
      </Card>

      <Card className="p-3 hover:shadow-md transition">
        <CardHeader className="">
          <CardTitle className="text-lg font-sora font-medium flex items-center gap-2">
            <CheckCircle className="w-5 h-5 text-blue-500 -ml-2 shrink-0" /> Completed Sessions
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-3xl font-inter font-bold">{value(completedThisMonth)}</p>
          <p className="text-sm mt-1 text-muted-foreground">This month</p>
        </CardContent>
      </Card>
    </div>
  );
}
