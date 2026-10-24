"use client";

import { useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Line,
  LineChart,
  ResponsiveContainer,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from "recharts";
import { createClient } from "@/lib/supabase/client";
import { useUserData } from "@/context/UserDataProvider";
import { MentorSession } from "@/lib/types/allTypes";

type Range = "7days" | "30days" | "1month";

export function MeetingsChart() {
  const supabase = createClient();
  const { mentor } = useUserData();
  const [timeFilter, setTimeFilter] = useState<Range>("7days");
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
        console.error("Error loading sessions for analytics:", error);
      } else {
        setSessions(data || []);
      }
      setLoaded(true);
    })();
  }, [mentor?.id]);

  const buckets = useMemo(() => {
    const ranges: Record<Range, { count: number; stepMs: number; label: (d: Date) => string }> = {
      "7days": {
        count: 7,
        stepMs: 86400000,
        label: (d) => d.toLocaleDateString(undefined, { weekday: "short" }),
      },
      "30days": {
        count: 30,
        stepMs: 86400000,
        label: (d) => d.toLocaleDateString(undefined, { month: "short", day: "numeric" }),
      },
      "1month": {
        count: 6,
        stepMs: 30 * 86400000,
        label: (d) => d.toLocaleDateString(undefined, { month: "short" }),
      },
    };

    const { count, stepMs, label } = ranges[timeFilter];
    const end = new Date();
    const start = new Date(end.getTime() - count * stepMs);

    const series = Array.from({ length: count }, (_, i) => {
      const bucketStart = new Date(start.getTime() + i * stepMs);
      const bucketEnd = new Date(bucketStart.getTime() + stepMs);
      const inBucket = (raw?: string | null) => {
        if (!raw) return false;
        const t = new Date(raw).getTime();
        return t >= bucketStart.getTime() && t < bucketEnd.getTime();
      };
      return {
        date: label(bucketStart),
        completed: sessions.filter((s) => s.status === "completed" && inBucket(s.completed_at || s.scheduled_at)).length,
        rejected: sessions.filter((s) => s.status === "rejected" && inBucket(s.requested_at)).length,
      };
    });

    return series;
  }, [sessions, timeFilter]);

  const hasData = buckets.some((b) => b.completed > 0 || b.rejected > 0);

  return (
    <Card className="bg-white mt-16">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-xl font-semibold text-black font-inter">Meeting Analytics</CardTitle>
            <p className="text-sm font-inter text-gray-500 mt-1">
              Your real completed vs rejected sessions
            </p>
          </div>
          <div className="flex gap-2">
            <Button
              variant={timeFilter === "7days" ? "default" : "outline"}
              size="sm"
              onClick={() => setTimeFilter("7days")}
              className={timeFilter === "7days" ? "bg-blue-600 hover:bg-blue-700" : ""}
            >
              7 days
            </Button>
            <Button
              variant={timeFilter === "30days" ? "default" : "outline"}
              size="sm"
              onClick={() => setTimeFilter("30days")}
              className={timeFilter === "30days" ? "bg-blue-600 hover:bg-blue-700" : ""}
            >
              30 days
            </Button>
            <Button
              variant={timeFilter === "1month" ? "default" : "outline"}
              size="sm"
              onClick={() => setTimeFilter("1month")}
              className={timeFilter === "1month" ? "bg-blue-600 hover:bg-blue-700" : ""}
            >
              6 months
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="h-72">
          {!loaded ? (
            <p className="text-sm text-gray-500">Loading your session data…</p>
          ) : !hasData ? (
            <div className="h-full flex items-center justify-center">
              <p className="text-sm text-gray-500">
                No completed or rejected sessions in this period yet.
              </p>
            </div>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={buckets}>
                <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
                <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: "#6B7280" }} />
                <YAxis
                  allowDecimals={false}
                  axisLine={false}
                  tickLine={false}
                  tick={{ fontSize: 12, fill: "#6B7280" }}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "white",
                    border: "1px solid #E5E7EB",
                    borderRadius: "8px",
                    boxShadow: "0 4px 6px -1px rgba(0, 0, 0, 0.1)",
                  }}
                />
                <Legend />
                <Line
                  type="monotone"
                  dataKey="completed"
                  stroke="#0051FF"
                  strokeWidth={3}
                  dot={{ fill: "#0051FF", strokeWidth: 2, r: 4 }}
                  name="Completed Meetings"
                />
                <Line
                  type="monotone"
                  dataKey="rejected"
                  stroke="#4B87FF"
                  strokeWidth={3}
                  dot={{ fill: "#4B87FF", strokeWidth: 2, r: 4 }}
                  name="Rejected Meetings"
                />
              </LineChart>
            </ResponsiveContainer>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
