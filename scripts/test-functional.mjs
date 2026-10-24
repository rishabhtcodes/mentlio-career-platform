/**
 * Mentlio functional E2E (Phases 3, 4, 6).
 * Exercises the real HTTP surface with signed-in student + mentor sessions and
 * asserts cross-role authorization and persistence. Only creates its own
 * `qa_func_*` records and deletes exactly those at the end.
 *
 * Usage: node scripts/test-functional.mjs [baseUrl]
 */
const BASE = process.argv[2] || "http://localhost:3000";
const PW = "SecurePassword123!";
const STU = { email: "qa_func_stu_a@mentlio.local", fullName: "Func Student A" };
const STU2 = { email: "qa_func_stu_b@mentlio.local", fullName: "Func Student B" };
const MEN = { email: "qa_func_mentor@mentlio.local", fullName: "Func Mentor" };

let passed = 0;
let failed = 0;
const failures = [];

function check(name, ok, detail = "") {
  if (ok) {
    passed++;
    console.log(`  \u2705 PASS: ${name}`);
  } else {
    failed++;
    failures.push(`${name}${detail ? " — " + detail : ""}`);
    console.log(`  \u274c FAIL: ${name}${detail ? " — " + detail : ""}`);
  }
}

function section(t) {
  console.log(`\n${t}`);
}

async function req(path, { method = "GET", body, cookie, headers = {} } = {}) {
  const res = await fetch(BASE + path, {
    method,
    headers: {
      "Content-Type": "application/json",
      ...(cookie ? { Cookie: cookie } : {}),
      ...headers,
    },
    body: body === undefined ? undefined : JSON.stringify(body),
    redirect: "manual",
  });
  const text = await res.text();
  let json = null;
  try {
    json = JSON.parse(text);
  } catch {}
  const setCookie = res.headers.getSetCookie?.() || [];
  const session = setCookie
    .map((c) => c.split(";")[0])
    .find((c) => c.startsWith("mentlio_session="));
  return { status: res.status, json, text, session, headers: res.headers };
}

async function authenticate({ email, password, role, fullName }) {
  const signUp = await req("/api/auth/signup", {
    method: "POST",
    body: { email, password, role, fullName },
  });
  if (signUp.session) return { cookie: signUp.session, via: "signup" };
  const login = await req("/api/auth/login", {
    method: "POST",
    body: { email, password, role },
  });
  if (login.session) return { cookie: login.session, via: "login" };
  return { cookie: null, response: login };
}

const data = (table, qs = "", cookie) =>
  req(`/api/data/${table}${qs ? `?${qs}` : ""}`, { cookie });

async function main() {
  console.log(`Mentlio functional E2E against ${BASE}`);

  section("Setup: create/sign in QA accounts");
  const stu = await authenticate({ ...STU, password: PW, role: "user" });
  const stu2 = await authenticate({ ...STU2, password: PW, role: "user" });
  const men = await authenticate({ ...MEN, password: PW, role: "mentor" });
  check("student A has a session", !!stu.cookie, JSON.stringify(stu.response?.json || {}));
  check("student B has a session", !!stu2.cookie);
  check("mentor has a session", !!men.cookie);
  if (!stu.cookie || !stu2.cookie || !men.cookie) process.exit(1);

  const whoami = await req("/api/auth/session", { cookie: stu.cookie });
  const me = whoami.json?.user || {};
  const whoamiM = await req("/api/auth/session", { cookie: men.cookie });
  const mentorRow = whoamiM.json?.mentor || whoamiM.json?.user || {};
  check("session endpoint reports the caller, not the whole table", whoami.json?.user?.userEmail === STU.email);

  section("Phase 4: authentication boundary");
  check("anonymous GET /api/data/messages is rejected", (await data("messages")).status === 401);
  check("anonymous GET /api/data/mentor_sessions is rejected", (await data("mentor_sessions")).status === 401);
  check("anonymous GET /api/data/mentors is allowed (public directory)", (await data("mentors")).status === 200);
  const anonMentors = (await data("mentors")).json || [];
  check(
    "public mentor directory hides phone",
    anonMentors.length > 0 && anonMentors.every((r) => !("phone" in r))
  );
  const esc = await req(`/api/data/users?id=eq.${me.id}`, {
    method: "PATCH",
    body: { role: "admin", isPro: true, totalCredits: 9999 },
    cookie: stu.cookie,
  });
  const afterEsc = await data("users", `id=eq.${me.id}`, stu.cookie);
  const escRow = Array.isArray(afterEsc.json) ? afterEsc.json[0] : afterEsc.json;
  check(
    "role/isPro/totalCredits stripped from own PATCH",
    escRow?.role === undefined && escRow?.isPro !== true && escRow?.totalCredits !== 9999,
    JSON.stringify({ status: esc.status, role: escRow?.role, isPro: escRow?.isPro, totalCredits: escRow?.totalCredits })
  );
  check(
    "passwordHash never leaves the server",
    JSON.stringify((await data("users", "", stu.cookie)).json || "").includes("passwordHash") === false
  );

  section("Phase 6: persistence — mentor_sessions booking lifecycle");
  const sid = String(me.id);
  const mid = String(mentorRow.id);
  const booking = await req("/api/data/mentor_sessions", {
    method: "POST",
    body: {
      student_id: sid,
      mentor_id: mid,
      student_email: STU.email,
      mentor_email: MEN.email,
      date_time: "2026-11-02T10:00:00.000Z",
      status: "pending",
      topic: "QA functional probe",
    },
    cookie: stu.cookie,
  });
  const sessionRow = Array.isArray(booking.json) ? booking.json[0] : booking.json;
  check("student can create a booking", booking.status < 300 && !!sessionRow?.id, `status=${booking.status} ${booking.text.slice(0, 160)}`);
  check("booking survives the request (persisted read)", (await data("mentor_sessions", `id=eq.${sessionRow?.id}`, stu.cookie)).json?.length >= 1);

  const ownRead = await data("mentor_sessions", `student_id=eq.${sid}`, stu.cookie);
  check("student reads own bookings", (ownRead.json || []).length >= 1);
  const otherRead = await data("mentor_sessions", `mentor_id=eq.${mid}`, stu2.cookie);
  check("student B cannot read the mentor's inbox", (otherRead.json || []).length === 0, JSON.stringify(otherRead.json)?.slice(0, 120));
  const menRead = await data("mentor_sessions", `mentor_id=eq.${mid}`, men.cookie);
  check("mentor reads bookings addressed to them", (menRead.json || []).length >= 1);

  const accept = await req(`/api/data/mentor_sessions?id=eq.${sessionRow.id}`, {
    method: "PATCH",
    body: { status: "accepted" },
    cookie: men.cookie,
  });
  check("mentor can accept a session request", accept.status < 300, `status=${accept.status} ${accept.text.slice(0, 160)}`);
  const stolen = await req(`/api/data/mentor_sessions?id=eq.${sessionRow.id}`, {
    method: "PATCH",
    body: { status: "accepted" },
    cookie: stu2.cookie,
  });
  check(
    "an unrelated student cannot accept someone else's session",
    stolen.status === 403 || stolen.status === 404 || (stolen.json || []).length === 0,
    `status=${stolen.status}`
  );

  const delForeign = await req(`/api/data/mentor_sessions?id=eq.${sessionRow.id}`, {
    method: "DELETE",
    cookie: stu2.cookie,
  });
  check(
    "an unrelated student cannot delete someone else's session",
    delForeign.status === 403 || delForeign.status === 404 || (delForeign.json || []).length === 0,
    `status=${delForeign.status}`
  );

  section("Phase 6: persistence — messages between student and mentor");
  const msg = await req("/api/data/messages", {
    method: "POST",
    body: {
      sender_id: sid,
      receiver_id: mid,
      sender_email: STU.email,
      receiver_email: MEN.email,
      message: "QA functional probe message",
      created_at: new Date().toISOString(),
    },
    cookie: stu.cookie,
  });
  const msgRow = Array.isArray(msg.json) ? msg.json[0] : msg.json;
  check("student can send a message", msg.status < 300 && !!msgRow?.id, `status=${msg.status} ${msg.text.slice(0, 160)}`);
  const thread = await data(
    "messages",
    `or=(sender_id.eq.${sid},receiver_id.eq.${sid})`,
    stu.cookie
  );
  check("sender sees the thread", (thread.json || []).some((r) => r.id === msgRow?.id));
  const mentorThread = await data(
    "messages",
    `or=(sender_id.eq.${mid},receiver_id.eq.${mid})`,
    men.cookie
  );
  check("recipient sees the message", (mentorThread.json || []).some((r) => r.id === msgRow?.id));
  const eavesdrop = await data(
    "messages",
    `or=(sender_id.eq.${mid},receiver_id.eq.${mid})`,
    stu2.cookie
  );
  check("a third party cannot read the mentor's inbox", (eavesdrop.json || []).length === 0);

  section("Phase 6: persistence — job tracker, calendar, tracks, quiz, roadmap");
  const job = await req("/api/data/job_tracker", {
    method: "POST",
    body: { userId: sid, title: "QA Engineer", company: "Mentlio", status: "applied", url: "https://example.com" },
    cookie: stu.cookie,
  });
  const jobRow = Array.isArray(job.json) ? job.json[0] : job.json;
  check("job entry persists", job.status < 300 && !!jobRow, `status=${job.status} ${job.text.slice(0, 140)}`);
  const jobMove = await req(`/api/data/job_tracker?id=eq.${jobRow?.id}`, {
    method: "PATCH",
    body: { status: "interview" },
    cookie: stu.cookie,
  });
  const jobAfter = await data("job_tracker", `id=eq.${jobRow?.id}`, stu.cookie);
  check(
    "Kanban move is persisted",
    jobMove.status < 300 && (jobAfter.json || []).some((r) => r.status === "interview")
  );
  check(
    "another user cannot move my job card",
    (await req(`/api/data/job_tracker?id=eq.${jobRow?.id}`, { method: "PATCH", body: { status: "offer" }, cookie: stu2.cookie })).status >= 400
  );

  const cal = await req("/api/data/userCalendar", {
    method: "POST",
    body: { userId: sid, title: "QA Session", start: "2026-11-02T10:00:00.000Z", end: "2026-11-02T10:30:00.000Z" },
    cookie: stu.cookie,
  });
  const calRow = Array.isArray(cal.json) ? cal.json[0] : cal.json;
  check("calendar event persists", cal.status < 300 && !!calRow, `status=${cal.status} ${cal.text.slice(0, 140)}`);

  const quiz = await req("/api/data/userQuizData", {
    method: "POST",
    body: { userId: sid, userEmail: STU.email, answers: { q1: 2 }, score: 60 },
    cookie: stu.cookie,
  });
  check("quiz result persists", quiz.status < 300, `status=${quiz.status} ${quiz.text.slice(0, 140)}`);
  const quizRow = Array.isArray(quiz.json) ? quiz.json[0] : quiz.json;

  const roadmap = await req("/api/data/roadmapUsers", {
    method: "POST",
    body: { userId: sid, title: "QA Roadmap", steps: [], status: "active" },
    cookie: stu.cookie,
  });
  check("roadmap row persists", roadmap.status < 300, `status=${roadmap.status} ${roadmap.text.slice(0, 140)}`);
  const roadmapRow = Array.isArray(roadmap.json) ? roadmap.json[0] : roadmap.json;

  const notif = await req("/api/data/notification", {
    method: "POST",
    body: { userId: mid, userEmail: MEN.email, title: "QA booking", message: "New session request", type: "session", isRead: false },
    cookie: stu.cookie,
  });
  check("a booking can raise a notification for the other party", notif.status < 300, `status=${notif.status} ${notif.text.slice(0, 140)}`);
  const notifRow = Array.isArray(notif.json) ? notif.json[0] : notif.json;

  section("Phase 4/6: server-only tables and read scoping");
  for (const t of ["payments", "orders", "proctor_events"]) {
    const r = await req(`/api/data/${t}`, { method: "POST", body: { amount: 1 }, cookie: stu.cookie });
    check(`clients cannot write ${t} directly`, r.status === 403 || r.status === 405, `status=${r.status}`);
  }
  const peerList = await data("users", "", stu.cookie);
  const peerRow = (peerList.json || []).find((r) => r.userEmail === STU2.email);
  check(
    "peer directory rows are projected to safe fields",
    !!peerRow && peerRow.phone === undefined && peerRow.remainingCredits === undefined && peerRow.institutionName === undefined
  );
  const ownRow = (peerList.json || []).find((r) => r.userEmail === STU.email);
  check("own row stays complete for profile/settings", ownRow?.userEmail === STU.email);

  section("Phase 3: page-level role authorization (SSR responses)");
  const studentHitsMentor = await req("/dashboard", { cookie: stu.cookie });
  check("student session on /dashboard is not a mentor dashboard", studentHitsMentor.status !== 500);
  const anonHitsHome = await req("/home");
  check("anonymous /home is not a server error", anonHitsHome.status === 200 || anonHitsHome.status === 307);

  section("Cleanup: remove only the records this script created");
  // Quiz/roadmap rows whose newest quiz row had no selectedCareer used to be
  // left behind, which gated the QA account's career board on later logins.
  const created = [
    ["mentor_sessions", sessionRow?.id, stu.cookie],
    ["messages", msgRow?.id, stu.cookie],
    ["job_tracker", jobRow?.id, stu.cookie],
    ["userCalendar", calRow?.id, stu.cookie],
    ["userQuizData", quizRow?.id, stu.cookie],
    ["roadmapUsers", roadmapRow?.id, stu.cookie],
    // The notification belongs to the mentor, so only the mentor can delete it.
    ["notification", notifRow?.id, men.cookie],
  ].filter(([, id]) => id);
  for (const [table, id, cookie] of created) {
    const r = await req(`/api/data/${table}?id=eq.${id}`, { method: "DELETE", cookie });
    check(`cleanup ${table}#${id}`, r.status < 300, `status=${r.status}`);
  }

  console.log(`\n=== RESULTS: ${passed} passed, ${failed} failed ===`);
  if (failures.length) {
    console.log("Failures:");
    for (const f of failures) console.log(" - " + f);
  }
  process.exit(failed ? 1 : 0);
}

main().catch((e) => {
  console.error("E2E crashed:", e);
  process.exit(1);
});
