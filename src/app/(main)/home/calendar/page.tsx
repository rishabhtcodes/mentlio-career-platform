/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";
import React, { useEffect, useState } from "react";
import { Calendar, momentLocalizer } from "react-big-calendar";
import withDragAndDrop from "react-big-calendar/lib/addons/dragAndDrop";
import moment from "moment";
import "react-big-calendar/lib/css/react-big-calendar.css";
import "react-big-calendar/lib/addons/dragAndDrop/styles.css";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/client";
import { UserCalendarEvent } from "@/lib/types/allTypes";
import { useUserData } from "@/context/UserDataProvider";
import { LuChevronLeft, LuLoader } from "react-icons/lu";
import { Calendar1, Loader2 } from "lucide-react";

import { useRouter } from "next/navigation";
import { toast } from "sonner";

const localizer = momentLocalizer(moment);
// const DnDCalendar = withDragAndDrop(Calendar);
const DndCalendar = withDragAndDrop<UserCalendarEvent, object>(Calendar);

type MyEvent = {
  id: number;
  title: string;
  start: Date;
  end: Date;
};

const eventStyleGetter = (
  event: any,
  start: Date,
  end: Date,
  isSelected: boolean
) => {
  const style = {
    backgroundColor: "#3B82F6",
    color: "white",
    borderRadius: "6px",
    border: "none",
    padding: "2px 6px",
    display: "block",
  };
  return { style };
};

export default function MyCalendar() {
  const { user } = useUserData();
  const [events, setEvents] = useState<UserCalendarEvent[]>([]);
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [isOpenEvent, setIsOpenEvent] = useState(false);
  const [selectedEvent, setSelectedEvent] = useState<UserCalendarEvent | null>(
    null
  );
  const [title, setTitle] = useState("");
  const [startDate, setStartDate] = useState<Date | null>(null);
  const [endDate, setEndDate] = useState<Date | null>(null);
  const supabase = createClient();
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [createLoading, setCreateLoading] = useState(false);
  const [connecting, setConnecting] = useState(false);

  async function connectGoogleCalendar() {
    if (!user?.id) return;
    if (user.google_refresh_token) {
      toast.success("Google Calendar is already connected.");
      return;
    }
    setConnecting(true);
    try {
      const connectUrl = `/api/google/connect?user_id=${encodeURIComponent(String(user.id))}`;
      const res = await fetch(connectUrl, { redirect: "manual" });

      // The server only redirects once Google OAuth is configured; let the
      // browser follow that redirect so the user lands on Google's consent page.
      if (res.type === "opaqueredirect") {
        window.location.href = connectUrl;
        return;
      }

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        toast.error(data?.error || "Could not start Google Calendar setup.");
        return;
      }

      toast.error("Could not start Google Calendar setup.");
    } catch {
      toast.error("Could not reach the Google Calendar service. Try again.");
    } finally {
      setConnecting(false);
    }
  }

  useEffect(() => {
    setLoading(true);
    const fetchEvents = async () => {
      const { data, error } = await supabase
        .from("userCalendar")
        .select("*")
        .eq("user_id", user?.id);

      if (error) {
        console.error("Error fetching events:", error);
        setLoading(false);
      } else if (data) {
        const mapped = data.map((ev) => ({
          ...ev,
          start: new Date(ev.start_time),
          end: new Date(ev.end_time),
        }));
        setEvents(mapped);
        setLoading(false);
      }
    };

    if (user) fetchEvents();
  }, [user?.id]);

  // =====================================
  // =====================================
  // ========GOOGLE CALENDAR=============

  const getRefreshToken = async () => {
    const { data } = await supabase
      .from("users")
      .select("google_refresh_token")
      .eq("id", user?.id)
      .single();

    return data?.google_refresh_token;
  };

  const handleSelectSlot = (slotInfo: any) => {
    setSelectedDate(slotInfo.start);
    setSelectedEvent(null);
    setTitle("");
    setStartDate(slotInfo.start);
    setEndDate(moment(slotInfo.start).add(1, "hours").toDate());
    setIsOpenEvent(true);
  };

  const handleSelectEvent = (event: object, _e: React.SyntheticEvent) => {
    const ev = event as UserCalendarEvent;
    setSelectedEvent(ev);
    setSelectedDate(null);
    setTitle(ev.title);
    setStartDate(ev.start);
    setEndDate(ev.end);
    setIsOpenEvent(true);
  };

  // ==============================================

  const syncGoogleCalendar = async (
    type: "create" | "update" | "delete",
    event: Record<string, any>
  ) => {
    const res = await fetch("/api/google/sync", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type, event }),
    });
    const data = await res.json().catch(() => ({}));
    return {
      ok: res.ok,
      error: data?.error as string | undefined,
      google_event_id: data?.google_event_id as string | undefined,
    };
  };

  const handleSave = async () => {
    if (!title.trim()) {
      toast.error("Please give the event a title.");
      return;
    }
    if (!startDate || !endDate) {
      toast.error("Please choose a start and end time.");
      return;
    }

    const refreshToken = await getRefreshToken();

    if (selectedEvent) {
      // -------------------------
      // EDIT MODE
      // -------------------------
      const { error } = await supabase
        .from("userCalendar")
        .update({
          title,
          start_time: startDate,
          end_time: endDate,
        })
        .eq("id", selectedEvent.id);

      if (error) {
        console.error("Event update failed:", error);
        toast.error("Your event could not be updated. Please try again.");
      } else {
        setEvents((prev) =>
          prev.map((ev) =>
            ev.id === selectedEvent.id
              ? { ...ev, title, start: startDate!, end: endDate! }
              : ev
          )
        );
        toast.success("Event updated.");

        if (refreshToken && selectedEvent.google_event_id) {
          const sync = await syncGoogleCalendar("update", {
            google_event_id: selectedEvent.google_event_id,
            title,
            start: startDate.toISOString(),
            end: endDate.toISOString(),
          });
          if (!sync.ok) {
            toast.error(sync.error || "Google Calendar sync failed.");
          }
        }
      }

      setIsOpenEvent(false);
      return;
    }

    // -------------------------
    // CREATE MODE
    // -------------------------
    setCreateLoading(true);

    const { data, error } = await supabase
      .from("userCalendar")
      .insert([
        {
          user_id: user?.id,
          title,
          start_time: startDate,
          end_time: endDate,
        },
      ])
      .select();

    if (error || !data?.[0]) {
      console.error("Event create failed:", error);
      toast.error("Your event could not be created. Please try again.");
      setCreateLoading(false);
      setIsOpenEvent(false);
      return;
    }

    const created = data[0];

    setEvents((prev) => [
      ...prev,
      {
        ...created,
        start: new Date(created.start_time),
        end: new Date(created.end_time),
        google_event_id: null,
      } as UserCalendarEvent,
    ]);
    setCreateLoading(false);
    setIsOpenEvent(false);
    toast.success("Event added to your calendar.");

    if (refreshToken) {
      const sync = await syncGoogleCalendar("create", {
        title,
        start: startDate.toISOString(),
        end: endDate.toISOString(),
      });

      if (sync.ok && sync.google_event_id) {
        await supabase
          .from("userCalendar")
          .update({ google_event_id: sync.google_event_id })
          .eq("id", created.id);

        setEvents((prev) =>
          prev.map((ev) =>
            ev.id === created.id ? { ...ev, google_event_id: sync.google_event_id } : ev
          )
        );
        toast.success("Event synced to Google Calendar.");
      } else {
        toast.error(
          sync.error || "Saved to your Mentlio calendar, but Google sync failed."
        );
      }
    }
  };

  const handleDeleteEvent = async () => {
    if (!selectedEvent) return;
    const eventId = selectedEvent.id;
    const googleEventId = selectedEvent.google_event_id;

    const { error } = await supabase
      .from("userCalendar")
      .delete()
      .eq("id", eventId);

    if (error) {
      console.error("Event delete failed:", error);
      toast.error("Your event could not be deleted. Please try again.");
      return;
    }

    setEvents((prev) => prev.filter((ev) => ev.id !== eventId));
    toast.success("Event deleted.");
    setIsOpenEvent(false);
    setSelectedEvent(null);

    const refreshToken = await getRefreshToken();
    if (refreshToken && googleEventId) {
      const sync = await syncGoogleCalendar("delete", {
        google_event_id: googleEventId,
      });
      if (!sync.ok) {
        toast.error(sync.error || "Google Calendar sync failed.");
      }
    }
  };

  // ===============================================
  // Handle Drag + Drop
  // ===============================================

  const handleEventDrop = async ({ event, start, end }: any) => {
    const { error } = await supabase
      .from("userCalendar")
      .update({
        start_time: start,
        end_time: end,
      })
      .eq("id", event.id);

    if (error) {
      console.error("Event move failed:", error);
      toast.error("Your event could not be moved. Please try again.");
      return;
    }

    setEvents((prev) =>
      prev.map((ev) => (ev.id === event.id ? { ...ev, start, end } : ev))
    );

    if (!event.google_event_id) return;

    const sync = await syncGoogleCalendar("update", {
      google_event_id: event.google_event_id,
      title: event.title,
      start: start.toISOString(),
      end: end.toISOString(),
    });
    if (!sync.ok) {
      toast.error(sync.error || "Google Calendar sync failed.");
    }
  };

  // =====================================================

  // ========================================================
  const handleEventResize = async ({ event, start, end }: any) => {
    const { error } = await supabase
      .from("userCalendar")
      .update({
        start_time: start,
        end_time: end,
      })
      .eq("id", event.id);

    if (error) {
      console.error("Event resize failed:", error);
      toast.error("Your event could not be resized. Please try again.");
      return;
    }

    setEvents((prev) =>
      prev.map((ev) => (ev.id === event.id ? { ...ev, start, end } : ev))
    );

    if (!event.google_event_id) return;

    const sync = await syncGoogleCalendar("update", {
      google_event_id: event.google_event_id,
      title: event.title,
      start: start.toISOString(),
      end: end.toISOString(),
    });
    if (!sync.ok) {
      toast.error(sync.error || "Google Calendar sync failed.");
    }
  };

  if (loading) {
    return (
      <div className="w-full h-[calc(100vh-44px)] bg-gray-50 flex items-center justify-center">
        <p className="text-xl font-sora">
          <LuLoader className="animate-spin inline mr-4 text-2xl" /> Loading
          content...
        </p>
      </div>
    );
  }

  return (
    <div
      style={{ height: "100%", padding: "26px 5px" }}
      className="bg-white border-t  font-inter font-medium text-black rounded"
    >
      <div className="mb-5 flex items-center gap-20">
        <p className="text-sm font-inter ml-5 cursor-pointer ">
          <LuChevronLeft className="inline mr-2" /> Back
        </p>

        <Button
          variant="ghost"
          className="font-inter cursor-pointer pl-0"
          onClick={() => router.back()}
        >
          <LuChevronLeft className="inline mr-2" /> Back
        </Button>

        {user?.google_refresh_token ? (
          <Button
            className="font-inter cursor-pointer flex items-center gap-2 bg-green-500 text-white hover:bg-green-600"
            size="sm"
            onClick={connectGoogleCalendar}
          >
            Connected to Google
            <Calendar1 className="inline" />
          </Button>
        ) : (
          <Button
            className="font-inter cursor-pointer flex items-center gap-2 bg-blue-600 text-white hover:bg-blue-700"
            size="sm"
            disabled={connecting}
            onClick={connectGoogleCalendar}
          >
            {connecting ? "Connecting..." : "Connect Google Calendar"}
            <Calendar1 className="inline" />
          </Button>
        )}
      </div>
      <DndCalendar
        selectable
        resizable
        localizer={localizer}
        events={events}
        startAccessor="start"
        endAccessor="end"
        onSelectSlot={handleSelectSlot}
        onSelectEvent={handleSelectEvent}
        onEventDrop={handleEventDrop}
        onEventResize={handleEventResize}
        eventPropGetter={eventStyleGetter}
        style={{ height: "100%" }}
        className="bg-white"
      />

      {/* Dialog for Create/Edit Event */}
      <Dialog open={isOpenEvent} onOpenChange={setIsOpenEvent}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="text-center font-semibold font-sora">
              {selectedEvent ? "Edit Event" : "Add Event"}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Event title"
            />

            {!selectedEvent && (
              <>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Start</label>
                  <Input
                    type="datetime-local"
                    value={
                      startDate
                        ? moment(startDate).format("YYYY-MM-DDTHH:mm")
                        : ""
                    }
                    onChange={(e) => setStartDate(new Date(e.target.value))}
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium">End</label>
                  <Input
                    type="datetime-local"
                    value={
                      endDate ? moment(endDate).format("YYYY-MM-DDTHH:mm") : ""
                    }
                    onChange={(e) => setEndDate(new Date(e.target.value))}
                  />
                </div>
              </>
            )}
          </div>

          <DialogFooter>
            {selectedEvent && (
              <Button
                onClick={handleDeleteEvent}
                variant="destructive"
                className="font-inter mr-auto"
                disabled={createLoading}
              >
                Delete
              </Button>
            )}
            <Button onClick={() => setIsOpenEvent(false)} variant="outline">
              Cancel
            </Button>
            <Button
              onClick={handleSave}
              className="font-inter flex items-center gap-2"
              disabled={createLoading}
            >
              {createLoading ? (
                <>
                  <Loader2 className="animate-spin h-4 w-4" />
                  Saving...
                </>
              ) : selectedEvent ? (
                "Update"
              ) : (
                "Create"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
