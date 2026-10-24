import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from '@/lib/auth/session';
import { getTable, mutateTable } from '@/lib/auth/db';
import type { ProctorEvent } from '@/lib/types/proctor';

const MAX_EVENTS = 5000;

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession();
    if (!session || !session.userId) {
      return NextResponse.json({ error: 'Authentication required.' }, { status: 401 });
    }

    const event: ProctorEvent = await request.json();

    if (!event.type || !event.timestamp || !event.sessionId) {
      return NextResponse.json(
        { error: 'Missing required fields: type, timestamp, sessionId' },
        { status: 400 }
      );
    }

    const record = {
      ...event,
      timestamp: Date.now(),
      sessionId: String(event.sessionId).slice(0, 120),
      // The account is trusted from the session, not from the request body.
      userId: session.userId,
      userEmail: session.email,
    };

    let eventId = 0;
    mutateTable('proctor_events', (events) => {
      const next = [...events, record].slice(-MAX_EVENTS);
      eventId = next.length - 1;
      return next;
    });

    return NextResponse.json({ success: true, message: 'Event logged successfully', eventId });
  } catch (error) {
    console.error('Error logging proctor event:', error);
    return NextResponse.json({ error: 'Failed to log event' }, { status: 500 });
  }
}

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession();
    if (!session || !session.userId) {
      return NextResponse.json({ error: 'Authentication required.' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const sessionId = searchParams.get('sessionId');

    // A user can only read proctor events recorded by their own account.
    const own = getTable('proctor_events').filter((e) => String(e.userId) === String(session.userId));
    const events = sessionId ? own.filter((e) => e.sessionId === sessionId) : own;

    return NextResponse.json({ events, count: events.length });
  } catch (error) {
    console.error('Error retrieving proctor events:', error);
    return NextResponse.json({ error: 'Failed to retrieve events' }, { status: 500 });
  }
}
