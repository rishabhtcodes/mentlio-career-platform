import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "@/lib/auth/session";
import { getTable, mutateTable, isKnownTable, DatabaseSchema } from "@/lib/auth/db";

// Tables that may be read without a session (public directory data).
const PUBLIC_READ_TABLES = new Set(["mentors", "colleges"]);

// Tables that are managed exclusively by server-side API routes (payments/orders
// are written by the Razorpay flow). Clients must never write them directly.
const SERVER_ONLY_TABLES = new Set(["payments", "orders", "proctor_events"]);

// Tables where any authenticated user may read all (sanitized) rows because the
// product exposes them as directories: peer discovery by career / student info
// needed by mentors on their dashboard.
const DIRECTORY_READ_TABLES = new Set(["users", "userQuizData"]);

// Inserts into notifications are allowed for any signed-in user (a booking
// notifies the other party). Rows are still read-owner-only.
const OPEN_INSERT_TABLES = new Set(["notification"]);

// Fields that must never leave the server or be writable by clients.
const SECRET_FIELDS = new Set([
  "passwordHash",
  "google_refresh_token",
  "google_access_token",
]);

// Fields a signed-in caller may see about *someone else's* account. The only
// consumers of the users directory (peer lists, chat headers, mentor dashboards)
// ask for id/userName/userEmail/avatar — everything else on a foreign row
// (phone, coordinates, credits, institution, flags) is personal data.
const PEER_VISIBLE_FIELDS = new Set([
  "id",
  "userName",
  "userEmail",
  "avatar",
  "mainFocus",
  "current_status",
  "created_at",
]);

// Public mentor profiles never need to broadcast a personal phone number.
const PUBLIC_REDACTED_FIELDS = new Set(["phone"]);

// Fields clients may not set/change via this generic endpoint. is_verified and
// remainingCredits are allowed on a caller's own row (PATCH ownership is
// enforced below): onboarding legitimately sets is_verified, and bookings
// debit credits — but only downward (see PATCH), never as a top-up.
const PROTECTED_WRITE_FIELDS = new Set([
  "passwordHash",
  "google_refresh_token",
  "google_access_token",
  "role",
  "isPro",
  "totalCredits",
  "rating",
]);

// Fields that tie a row to its owner for READ access (both message endpoints).
const READER_KEYS = [
  "userId",
  "user_id",
  "userEmail",
  "email",
  "student_id",
  "mentor_id",
  "sender_id",
  "receiver_id",
];

// Fields that may legitimately appear on an INSERT to claim the new row.
const WRITER_CLAIM_KEYS = [
  "userId",
  "user_id",
  "userEmail",
  "email",
  "student_id",
  "mentor_id",
  "sender_id",
];

function sanitizeRows(rows: Array<Record<string, any>>) {
  return rows.map((row) => {
    const copy = { ...row };
    for (const f of SECRET_FIELDS) delete copy[f];
    return copy;
  });
}

function stripProtectedFields(obj: Record<string, any>) {
  const copy = { ...obj };
  for (const f of PROTECTED_WRITE_FIELDS) delete copy[f];
  return copy;
}

function identityValues(session: { userId: string; email: string }) {
  return new Set([String(session.userId), session.email.toLowerCase()]);
}

/** A row belongs to the session when any ownership field matches the user's id or email. */
function rowOwnedBy(row: Record<string, any>, session: { userId: string; email: string }) {
  const ids = identityValues(session);
  return READER_KEYS.some((k) => {
    const v = row[k];
    if (v === undefined || v === null) return false;
    return ids.has(String(v)) || ids.has(String(v).toLowerCase());
  });
}

/** True when the insert body carries a writer-claim field that matches the session. */
function bodyClaimsOwnRow(item: Record<string, any>, session: { userId: string; email: string }) {
  const ids = identityValues(session);
  return WRITER_CLAIM_KEYS.some((k) => {
    const v = item[k];
    if (v === undefined || v === null) return false;
    return ids.has(String(v)) || ids.has(String(v).toLowerCase());
  });
}

// --- Minimal PostgREST-style filter support (eq/neq/gt/gte/lt/lte + or/and groups) ---

function matchCondition(row: Record<string, any>, cond: string): boolean {
  const m = cond.match(/^([A-Za-z_][\w]*)\.(eq|neq|gt|gte|lt|lte|in|is)\.(.+)$/);
  if (!m) return false;
  const [, field, op, rawVal] = m;
  const cell = row[field];

  if (op === "in") {
    const inner = rawVal.replace(/^\(/, "").replace(/\)$/, "");
    const list = splitTopLevel(inner, ",").map((v) => v.trim().replace(/^"(.*)"$/, "$1"));
    return list.some((v) => String(cell ?? "") === v);
  }
  if (op === "is") {
    if (rawVal === "null") return cell === null || cell === undefined;
    if (rawVal === "true") return cell === true;
    if (rawVal === "false") return cell === false;
    return false;
  }
  const cellStr = cell === undefined || cell === null ? "" : String(cell);
  const valStr = String(rawVal);
  const cellNum = Number(cell);
  const valNum = Number(valStr);
  const numeric = !Number.isNaN(cellNum) && !Number.isNaN(valNum) && valStr.trim() !== "";
  switch (op) {
    case "eq": return cellStr === valStr;
    case "neq": return cellStr !== valStr;
    case "gt": return numeric ? cellNum > valNum : cellStr > valStr;
    case "gte": return numeric ? cellNum >= valNum : cellStr >= valStr;
    case "lt": return numeric ? cellNum < valNum : cellStr < valStr;
    case "lte": return numeric ? cellNum <= valNum : cellStr <= valStr;
    default: return false;
  }
}

function splitTopLevel(input: string, sep: string): string[] {
  const parts: string[] = [];
  let depth = 0;
  let current = "";
  for (const ch of input) {
    if (ch === "(") depth++;
    if (ch === ")") depth--;
    if (ch === sep && depth === 0) {
      parts.push(current);
      current = "";
    } else {
      current += ch;
    }
  }
  if (current) parts.push(current);
  return parts;
}

// postgrest-js signals "return a single object" via this Accept header
// (`.single()` / `.maybeSingle()`); PostgREST honors it, so must we.
function wantsObject(req: NextRequest) {
  return (req.headers.get("accept") || "").includes("application/vnd.pgrst.object+json");
}

/** Remove one layer of parentheses, but only when they actually wrap the whole expression. */
function stripOuterParens(value: string): string {
  const v = value.trim();
  if (!v.startsWith("(") || !v.endsWith(")")) return v;
  let depth = 0;
  for (let i = 0; i < v.length; i++) {
    if (v[i] === "(") depth++;
    else if (v[i] === ")") depth--;
    if (depth === 0 && i < v.length - 1) return v;
  }
  return v.slice(1, -1);
}

/**
 * Evaluate a PostgREST logic tree, e.g. `or=(a.eq.1,and(b.eq.2,c.eq.3))`.
 * `splitTopLevel` ignores commas inside nested groups, so the outer `or=(…)`
 * arrives as one token — the mode must come from the param name, not the shape.
 */
function matchLogicGroup(row: Record<string, any>, raw: string, mode: "or" | "and"): boolean {
  const parts = splitTopLevel(stripOuterParens(raw), ",")
    .map((p) => p.trim())
    .filter(Boolean);
  if (parts.length === 0) return true;
  const results = parts.map((p) => {
    const nested = p.match(/^(or|and)\(([\s\S]*)\)$/i);
    if (nested) {
      return matchLogicGroup(row, nested[2], nested[1].toLowerCase() as "or" | "and");
    }
    return matchCondition(row, p);
  });
  return mode === "or" ? results.some(Boolean) : results.every(Boolean);
}

const NON_FILTER_PARAMS = new Set([
  "order",
  "ascending",
  "limit",
  "single",
  "or",
  "and",
  "select",
  "columns",
  "eqKey",
  "eqVal",
]);

function filterParams(url: URL): Array<[string, string]> {
  return [...url.searchParams.entries()].filter(([k]) => !NON_FILTER_PARAMS.has(k));
}

/** AND-composed PostgREST filter for a single row (params + `or=`/`and=` groups). */
function rowMatchesFilters(row: Record<string, any>, url: URL): boolean {
  for (const [key, val] of filterParams(url)) {
    if (/^(eq|neq|gt|gte|lt|lte|in|is)\./.test(val)) {
      if (!matchCondition(row, `${key}.${val}`)) return false;
    } else if (String(row[key] ?? "") !== String(val)) {
      return false;
    }
  }
  const orVal = url.searchParams.get("or");
  if (orVal && !matchLogicGroup(row, orVal, "or")) return false;
  const andVal = url.searchParams.get("and");
  if (andVal && !matchLogicGroup(row, andVal, "and")) return false;
  return true;
}

function applyFilters(rows: Array<Record<string, any>>, url: URL) {
  let out = rows.filter((r) => rowMatchesFilters(r, url));
  const orderRaw = url.searchParams.get("order");
  if (orderRaw) {
    // Supports both `order=field` (+ascending=true|false) and PostgREST `order=field.asc|desc`
    const [orderField, dir] = orderRaw.split(".");
    const ascending = dir ? dir !== "desc" : url.searchParams.get("ascending") !== "false";
    out = [...out].sort((a, b) => {
      const valA = a[orderField];
      const valB = b[orderField];
      if (valA === valB) return 0;
      if (valA === undefined || valA === null) return 1;
      if (valB === undefined || valB === null) return -1;
      if (valA < valB) return ascending ? -1 : 1;
      if (valA > valB) return ascending ? 1 : -1;
      return 0;
    });
  }
  const limit = url.searchParams.get("limit");
  if (limit) {
    const n = parseInt(limit, 10);
    if (!Number.isNaN(n)) out = out.slice(0, n);
  }
  return out;
}

/**
 * Predicate selecting the rows a PATCH/DELETE targets. Refuses to return an
 * always-true matcher: an unfiltered write would hit every row in the table.
 */
function buildTargetMatcher(url: URL): ((row: Record<string, any>) => boolean) | null {
  const legacyKey = url.searchParams.get("eqKey");
  const legacyVal = url.searchParams.get("eqVal");
  if (legacyKey) return (row) => String(row[legacyKey]) === String(legacyVal ?? "");
  if (
    filterParams(url).length === 0 &&
    !url.searchParams.get("or") &&
    !url.searchParams.get("and")
  )
    return null;
  return (row) => rowMatchesFilters(row, url);
}

export async function GET(req: NextRequest, { params }: { params: Promise<{ table: string }> }) {  try {
    const { table } = await params;
    const tableName = table as keyof DatabaseSchema;
    const session = await getServerSession();
    const url = new URL(req.url);

    if (!isKnownTable(table)) {
      return NextResponse.json({ error: `Unknown table: ${table}` }, { status: 404 });
    }

    if (SERVER_ONLY_TABLES.has(tableName)) {
      if (!session) {
        return NextResponse.json({ error: "Authentication required." }, { status: 401 });
      }
      const rows = applyFilters(getTable(tableName), url).filter((r) => rowOwnedBy(r, session));
      if (url.searchParams.get("single") === "true") {
        return NextResponse.json(sanitizeRows(rows)[0] ?? null);
      }
      return NextResponse.json(sanitizeRows(rows));
    }

    if (!PUBLIC_READ_TABLES.has(tableName) && !session) {
      return NextResponse.json({ error: "Authentication required." }, { status: 401 });
    }

    let rows = applyFilters(getTable(tableName), url);

    // Private tables: users only ever receive their own rows, except directory
    // tables which the product exposes to any signed-in user (sanitized).
    if (session && !PUBLIC_READ_TABLES.has(tableName) && !DIRECTORY_READ_TABLES.has(tableName)) {
      rows = rows.filter((r) => rowOwnedBy(r, session));
    }

    rows = sanitizeRows(rows);

    if (session && DIRECTORY_READ_TABLES.has(tableName)) {
      rows = rows.map((r) =>
        rowOwnedBy(r, session)
          ? r
          : Object.fromEntries(
              Object.entries(r).filter(([k]) => PEER_VISIBLE_FIELDS.has(k))
            )
      );
    }

    if (PUBLIC_READ_TABLES.has(tableName)) {
      rows = rows.map((r) => {
        const copy = { ...r };
        for (const f of PUBLIC_REDACTED_FIELDS) delete copy[f];
        // Mentor email is the contact shown on the signed-in detail page. Keep
        // it out of anonymous responses so the public directory cannot be
        // scraped for addresses.
        if (!session) delete copy.email;
        return copy;
      });
    }

    if (url.searchParams.get("single") === "true" || wantsObject(req)) {
      return NextResponse.json(rows[0] ?? null);
    }
    return NextResponse.json(rows);
  } catch (err: any) {
    console.error("Data GET error:", err);
    return NextResponse.json({ error: "Failed to read data." }, { status: 500 });
  }
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ table: string }> }) {
  try {
    const { table } = await params;
    const tableName = table as keyof DatabaseSchema;
    const session = await getServerSession();

    if (!session) {
      return NextResponse.json({ error: "Authentication required." }, { status: 401 });
    }
    if (SERVER_ONLY_TABLES.has(tableName)) {
      return NextResponse.json({ error: "This table is server-managed." }, { status: 403 });
    }
    if (!isKnownTable(table)) {
      return NextResponse.json({ error: `Unknown table: ${table}` }, { status: 404 });
    }

    const body = await req.json();
    const items = Array.isArray(body) ? body : [body];

    // Idempotency for account rows: never create a second row for an email that
    // already has one — return the existing record instead.
    if (tableName === "users" || tableName === "mentors") {
      const emailField = tableName === "users" ? "userEmail" : "email";
      const existing = getTable(tableName).find(
        (r) =>
          String(r[emailField] || "").toLowerCase() === session.email.toLowerCase()
      );
      if (existing) {
        const { passwordHash: _, ...safe } = existing;
        return NextResponse.json(Array.isArray(body) ? [safe] : safe);
      }
      for (const item of items) {
        if (
          item[emailField] &&
          String(item[emailField]).toLowerCase() !== session.email.toLowerCase()
        ) {
          return NextResponse.json({ error: "Forbidden." }, { status: 403 });
        }
      }
    }

    const newRows = items.map((item) => stripProtectedFields(item));

    if (!PUBLIC_READ_TABLES.has(tableName) && !OPEN_INSERT_TABLES.has(tableName)) {
      for (const item of newRows) {
        if (!bodyClaimsOwnRow(item, session)) {
          return NextResponse.json(
            { error: "Cannot create records for other users." },
            { status: 403 }
          );
        }
      }
    }

    const insertedItems: Array<Record<string, any>> = [];
    mutateTable(tableName, (current) => {
      for (const item of newRows) {
        const withId = {
          id: item.id || Date.now() + Math.floor(Math.random() * 1000),
          created_at: item.created_at || new Date().toISOString(),
          ...item,
        };
        insertedItems.push(withId);
        current.push(withId);
      }
      return current;
    });

    const sanitized = sanitizeRows(insertedItems);
    if (wantsObject(req)) {
      return NextResponse.json(sanitized[0] ?? null);
    }
    return NextResponse.json(Array.isArray(body) ? sanitized : sanitized[0]);
  } catch (err: any) {
    console.error("Data POST error:", err);
    return NextResponse.json({ error: "Failed to create record." }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ table: string }> }) {
  try {
    const { table } = await params;
    const tableName = table as keyof DatabaseSchema;
    const session = await getServerSession();

    if (!session) {
      return NextResponse.json({ error: "Authentication required." }, { status: 401 });
    }
    if (SERVER_ONLY_TABLES.has(tableName)) {
      return NextResponse.json({ error: "This table is server-managed." }, { status: 403 });
    }
    if (!isKnownTable(table)) {
      return NextResponse.json({ error: `Unknown table: ${table}` }, { status: 404 });
    }

    const url = new URL(req.url);
    const body = stripProtectedFields(await req.json());

    const matches = buildTargetMatcher(url);
    if (!matches) {
      return NextResponse.json(
        { error: "A row filter is required to update records." },
        { status: 400 }
      );
    }

    const targets = getTable(tableName).filter(matches);

    // Every matched row must belong to the caller — this also covers mentors
    // editing their own mentor profile but no one else's.
    if (targets.length > 0 && !targets.every((r) => rowOwnedBy(r, session))) {
      return NextResponse.json({ error: "Forbidden." }, { status: 403 });
    }

    // Credits are money: clients may only ever DECREASE their own balance via
    // this generic endpoint (booking sessions). Top-ups happen server-side
    // through the payment flow.
    if ("remainingCredits" in body) {
      const newVal = Number(body.remainingCredits);
      if (
        Number.isNaN(newVal) ||
        targets.some((r) => typeof r.remainingCredits === "number" && newVal > r.remainingCredits)
      ) {
        return NextResponse.json(
          { error: "Credits can only be debited, not increased." },
          { status: 403 }
        );
      }
    }

    let updatedCount = 0;
    mutateTable(tableName, (current) =>
      current.map((item) => {
        if (matches(item)) {
          updatedCount++;
          return { ...item, ...body, updated_at: new Date().toISOString() };
        }
        return item;
      })
    );

    return NextResponse.json({ success: true, updated: updatedCount });
  } catch (err: any) {
    console.error("Data PATCH error:", err);
    return NextResponse.json({ error: "Failed to update record." }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ table: string }> }) {
  try {
    const { table } = await params;
    const tableName = table as keyof DatabaseSchema;
    const session = await getServerSession();

    if (!session) {
      return NextResponse.json({ error: "Authentication required." }, { status: 401 });
    }
    if (SERVER_ONLY_TABLES.has(tableName)) {
      return NextResponse.json({ error: "This table is server-managed." }, { status: 403 });
    }
    if (!isKnownTable(table)) {
      return NextResponse.json({ error: `Unknown table: ${table}` }, { status: 404 });
    }

    const url = new URL(req.url);
    const matches = buildTargetMatcher(url);
    if (!matches) {
      return NextResponse.json(
        { error: "A row filter is required to delete records." },
        { status: 400 }
      );
    }

    const targets = getTable(tableName).filter(matches);
    if (targets.length > 0 && !targets.every((r) => rowOwnedBy(r, session))) {
      return NextResponse.json({ error: "Forbidden." }, { status: 403 });
    }

    mutateTable(tableName, (current) => current.filter((item) => !matches(item)));

    return NextResponse.json({ success: true });
  } catch (err: any) {
    console.error("Data DELETE error:", err);
    return NextResponse.json({ error: "Failed to delete record." }, { status: 500 });
  }
}
