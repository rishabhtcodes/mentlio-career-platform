import { NextResponse } from "next/server";
import { google } from "googleapis";
import { getServerSession } from "@/lib/auth/session";
import { getTable } from "@/lib/auth/db";

export async function POST(req: Request) {
  const session = await getServerSession();
  if (!session) {
    return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  }

  let payload: any;
  try {
    payload = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }
  const { type, event } = payload ?? {};

  if (!type || !event || typeof event !== "object") {
    return NextResponse.json(
      { error: "Both 'type' and 'event' are required." },
      { status: 400 }
    );
  }

  // Always act on the signed-in user's calendar — never on a client-supplied userId.
  const userId = session.userId;
  const u = getTable("users").find((row) => String(row.id) === String(userId));

  if (!u || !u.google_refresh_token) {
    return NextResponse.json({ error: "Not connected" }, { status: 400 });
  }

  const auth = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID!,
    process.env.GOOGLE_CLIENT_SECRET!,
    process.env.GOOGLE_REDIRECT_URI!
  );

  auth.setCredentials({ refresh_token: u.google_refresh_token });

  const calendar = google.calendar({ version: "v3", auth });

  try {
    // create
    if (type === "create") {
      const res = await calendar.events.insert({
        calendarId: "primary",
        requestBody: {
          summary: event.title,
          start: { dateTime: event.start },
          end: { dateTime: event.end },
        },
      });

      return NextResponse.json({ google_event_id: res.data.id });
    }

    // update
    if (type === "update") {
      if (!event.google_event_id) {
        return NextResponse.json(
          { error: "This event is not linked to a Google Calendar event." },
          { status: 400 }
        );
      }
      await calendar.events.update({
        calendarId: "primary",
        eventId: event.google_event_id,
        requestBody: {
          summary: event.title,
          start: { dateTime: event.start },
          end: { dateTime: event.end },
        },
      });

      return NextResponse.json({ success: true });
    }

    // delete
    if (type === "delete") {
      if (!event.google_event_id) {
        return NextResponse.json(
          { error: "This event is not linked to a Google Calendar event." },
          { status: 400 }
        );
      }
      await calendar.events.delete({
        calendarId: "primary",
        eventId: event.google_event_id,
      });

      return NextResponse.json({ success: true });
    }

    return NextResponse.json({ error: "Invalid type" }, { status: 400 });
  } catch (err: any) {
    console.error("Google Calendar sync failed:", err?.message || err);
    return NextResponse.json(
      {
        error:
          err?.message || "Google Calendar sync failed. Please try again.",
      },
      { status: 502 }
    );
  }
}

