"use client";
import React, { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useUserData } from "@/context/UserDataProvider";
import { MentorSession } from "@/lib/types/allTypes";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight } from "lucide-react";

const daysOfWeek = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const months = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

const dayKey = (y: number, m: number, d: number) =>
  `${y}-${String(m + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;

const CalendarPage = () => {
  const supabase = createClient();
  const { mentor } = useUserData();
  const [sessions, setSessions] = useState<MentorSession[]>([]);
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selected, setSelected] = useState<string | null>(null);

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();

  useEffect(() => {
    if (!mentor?.id) return;
    (async () => {
      const { data, error } = await supabase
        .from("mentor_sessions")
        .select("*")
        .eq("mentor_id", mentor.id)
        .in("status", ["accepted", "completed"]);
      if (error) {
        console.error("Error fetching mentor sessions:", error);
        return;
      }
      setSessions(data || []);
    })();
  }, [mentor?.id]);

  const byDay = useMemo(() => {
    const map = new Map<string, MentorSession[]>();
    for (const s of sessions) {
      if (!s.scheduled_at) continue;
      const d = new Date(s.scheduled_at);
      const key = dayKey(d.getFullYear(), d.getMonth(), d.getDate());
      map.set(key, [...(map.get(key) || []), s]);
    }
    return map;
  }, [sessions]);

  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const todayKey = dayKey(new Date().getFullYear(), new Date().getMonth(), new Date().getDate());

  const selectedSessions = selected ? byDay.get(selected) || [] : [];

  return (
    <div className="flex flex-col px-4 pb-20 bg-gray-50 min-h-screen">
      <h1 className="font-sora text-2xl font-semibold py-6">Session Calendar</h1>
      <div className="grid gap-6 lg:grid-cols-2 max-w-5xl">
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-base font-medium">
                {months[month]} {year}
              </CardTitle>
              <div className="flex items-center gap-2">
                <Button
                  variant="ghost"
                  size="sm"
                  aria-label="Previous month"
                  onClick={() => setCurrentDate(new Date(year, month - 1, 1))}
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  aria-label="Next month"
                  onClick={() => setCurrentDate(new Date(year, month + 1, 1))}
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-7 gap-1">
              {daysOfWeek.map((d) => (
                <div key={d} className="h-8 flex items-center justify-center text-xs text-gray-600">
                  {d}
                </div>
              ))}
              {Array.from({ length: firstDay }).map((_, i) => (
                <div key={`empty-${i}`} className="h-9" />
              ))}
              {Array.from({ length: daysInMonth }).map((_, i) => {
                const key = dayKey(year, month, i + 1);
                const has = byDay.has(key);
                return (
                  <button
                    key={key}
                    onClick={() => setSelected(key)}
                    className={`h-9 rounded-full text-sm transition-colors ${
                      key === todayKey
                        ? "bg-blue-600 text-white"
                        : has
                        ? "bg-blue-100 text-blue-700 hover:bg-blue-200"
                        : "hover:bg-gray-100"
                    }`}
                  >
                    {i + 1}
                  </button>
                );
              })}
            </div>
            <div className="flex items-center gap-4 text-xs pt-3 border-t">
              <span className="flex items-center gap-2">
                <span className="w-3 h-3 bg-blue-600 rounded-full" /> Today
              </span>
              <span className="flex items-center gap-2">
                <span className="w-3 h-3 bg-blue-200 rounded-full" /> Session booked
              </span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base font-medium">
              {selected ? `Sessions on ${selected}` : "Select a date"}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {selectedSessions.length === 0 ? (
              <p className="text-sm text-gray-600">
                No confirmed or completed sessions on this date.
              </p>
            ) : (
              <ul className="space-y-2">
                {selectedSessions.map((s) => (
                  <li
                    key={s.id}
                    className="border rounded-md p-3 flex items-center justify-between text-sm"
                  >
                    <span>{new Date(s.scheduled_at!).toLocaleTimeString()}</span>
                    <span className="text-muted-foreground">{s.session_type}</span>
                    <span className="capitalize">{s.status}</span>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default CalendarPage;
