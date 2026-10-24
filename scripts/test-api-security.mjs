// Regression suite for the API authorization / payment / data-contract fixes.
const BASE_URL = process.env.TEST_BASE_URL || "http://localhost:3000";

let pass = 0;
let fail = 0;

function assert(condition, message) {
  if (condition) {
    console.log(`  ✅ PASS: ${message}`);
    pass++;
  } else {
    console.error(`  ❌ FAIL: ${message}`);
    fail++;
  }
}

const cookieOf = (res) => {
  const raw = res.headers.getSetCookie?.() || [];
  const hit = raw.find((c) => c.startsWith("mentlio_session="));
  return hit ? hit.split(";")[0] : "";
};

async function signup(email, password, fullName = "Security Tester") {
  const res = await fetch(`${BASE_URL}/api/auth/signup`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password, fullName, role: "user" }),
  });
  return { res, data: await res.json().catch(() => ({})), cookie: cookieOf(res) };
}

const json = (res) => res.json().catch(() => ({}));

async function run() {
  console.log("=== MENTLIO API SECURITY / CONTRACT REGRESSION SUITE ===\n");
  const ts = Date.now();
  const owner = await signup(`owner_${ts}@mentlio.local`, "SecurePassword123!", "Order Owner");
  const other = await signup(`other_${ts}@mentlio.local`, "SecurePassword123!", "Other Student");
  const ownerCookie = owner.cookie;
  const otherCookie = other.cookie;

  console.log("Test A: Payment endpoints require a session");
  const anonCreate = await json(
    await fetch(`${BASE_URL}/api/razorpay/create-order`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ planId: "topup_25" }),
    })
  );
  const anonCreateRes = await fetch(`${BASE_URL}/api/razorpay/create-order`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ planId: "topup_25" }),
  });
  assert(anonCreateRes.status === 401, "create-order rejects anonymous callers with 401");

  const anonVerify = await fetch(`${BASE_URL}/api/razorpay/verify-payment`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      razorpay_order_id: "order_x",
      razorpay_payment_id: "pay_x",
      razorpay_signature: "sig_x",
    }),
  });
  assert(anonVerify.status === 401, "verify-payment rejects anonymous callers with 401");

  const anonSim = await fetch(`${BASE_URL}/api/razorpay/simulate-payment`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ orderId: "order_x" }),
  });
  assert(anonSim.status === 401 || anonSim.status === 503, "simulate-payment is not anonymous");
  void anonCreate;

  console.log("\nTest B: Simulated order cannot be self-credited with a forged signature");
  const orderRes = await fetch(`${BASE_URL}/api/razorpay/create-order`, {
    method: "POST",
    headers: { "Content-Type": "application/json", cookie: ownerCookie },
    body: JSON.stringify({ planId: "topup_25" }),
  });
  const order = await json(orderRes);
  assert(orderRes.status === 200 && order.orderId, "owner creates a top-up order");
  assert(order.isSimulated === true, "unconfigured Razorpay falls back to the dev simulator");

  const forged = await fetch(`${BASE_URL}/api/razorpay/verify-payment`, {
    method: "POST",
    headers: { "Content-Type": "application/json", cookie: ownerCookie },
    body: JSON.stringify({
      razorpay_order_id: order.orderId,
      razorpay_payment_id: "pay_forged",
      razorpay_signature: `sig_valid_${order.orderId}`,
    }),
  });
  assert(forged.status === 400, "the legacy guessable simulator signature is rejected (400)");

  const wrongUser = await fetch(`${BASE_URL}/api/razorpay/simulate-payment`, {
    method: "POST",
    headers: { "Content-Type": "application/json", cookie: otherCookie },
    body: JSON.stringify({ orderId: order.orderId }),
  });
  assert(wrongUser.status === 403, "another account cannot finalize someone else's order (403)");

  const beforeCredits = (await json(
    await fetch(`${BASE_URL}/api/auth/session`, { headers: { cookie: ownerCookie } })
  ))?.user?.remainingCredits;

  const sim = await fetch(`${BASE_URL}/api/razorpay/simulate-payment`, {
    method: "POST",
    headers: { "Content-Type": "application/json", cookie: ownerCookie },
    body: JSON.stringify({ orderId: order.orderId }),
  });
  const simData = await json(sim);
  assert(sim.status === 200 && simData.success, "owner finalizes their own simulated order");
  assert(simData.creditsAdded === 25, "the server-trusted plan grants exactly 25 credits");

  const replay = await json(
    await fetch(`${BASE_URL}/api/razorpay/simulate-payment`, {
      method: "POST",
      headers: { "Content-Type": "application/json", cookie: ownerCookie },
      body: JSON.stringify({ orderId: order.orderId }),
    })
  );
  assert(replay.alreadyProcessed === true, "replaying the same order does not double-credit");

  const afterCredits = (await json(
    await fetch(`${BASE_URL}/api/auth/session`, { headers: { cookie: ownerCookie } })
  ))?.user?.remainingCredits;
  assert(
    typeof afterCredits === "number" && typeof beforeCredits === "number" && afterCredits > beforeCredits,
    `credits actually increased on the stored account (${beforeCredits} → ${afterCredits})`
  );

  console.log("\nTest C: Payments/orders/proctor tables are server-managed for clients");
  for (const table of ["orders", "payments", "proctor_events"]) {
    const write = await fetch(`${BASE_URL}/api/data/${table}`, {
      method: "POST",
      headers: { "Content-Type": "application/json", cookie: ownerCookie },
      body: JSON.stringify([{ userId: owner.data?.user?.id }]),
    });
    assert(write.status === 403, `POST /api/data/${table} is server-only (403)`);

    const read = await json(
      await fetch(`${BASE_URL}/api/data/${table}`, { headers: { cookie: otherCookie } })
    );
    const rows = Array.isArray(read) ? read : [];
    assert(
      rows.every((r) => String(r.userId) !== String(owner.data?.user?.id)),
      `GET /api/data/${table} never exposes another account's rows`
    );
  }

  const anonOrders = await fetch(`${BASE_URL}/api/data/orders`);
  assert(anonOrders.status === 401, "anonymous reads of /api/data/orders are blocked (401)");

  console.log("\nTest D: Cross-user row access is denied on the REST shim");
  const patchOther = await fetch(`${BASE_URL}/api/data/users?id=${other.data?.user?.id ?? 1}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json", cookie: ownerCookie },
    body: JSON.stringify({ userName: "Hacked" }),
  });
  assert(patchOther.status === 403 || patchOther.status === 404, "owner cannot patch the other account's row");

  const creditUp = await fetch(`${BASE_URL}/api/data/users?id=${owner.data?.user?.id ?? 1}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json", cookie: ownerCookie },
    body: JSON.stringify({ remainingCredits: 99999 }),
  });
  assert(creditUp.status === 403, "clients cannot inflate their own credits (debit-only rule)");

  const secretRead = await json(
    await fetch(`${BASE_URL}/api/data/users`, { headers: { cookie: ownerCookie } })
  );
  const rows = Array.isArray(secretRead) ? secretRead : [];
  assert(
    rows.every((r) => !("passwordHash" in r) && !("google_access_token" in r)),
    "directory reads never leak password hashes or OAuth tokens"
  );

  console.log("\nTest E: PostgREST single-row contract");
  const single = await fetch(
    `${BASE_URL}/api/data/mentors?select=id,full_name&limit=1`,
    { headers: { cookie: ownerCookie, Accept: "application/vnd.pgrst.object+json" } }
  );
  const singleData = await json(single);
  assert(single.status === 200 && !Array.isArray(singleData), ".single() style request returns one object");

  console.log("\nTest F: Proctoring events are authenticated and per-account");
  const anonEvent = await fetch(`${BASE_URL}/api/ai/mocktest/security`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ type: "copy", timestamp: Date.now(), sessionId: "sess_anon" }),
  });
  assert(anonEvent.status === 401, "anonymous proctor event is rejected (401)");

  const ownerEvent = await fetch(`${BASE_URL}/api/ai/mocktest/security`, {
    method: "POST",
    headers: { "Content-Type": "application/json", cookie: ownerCookie },
    body: JSON.stringify({ type: "copy", timestamp: Date.now(), sessionId: `sess_${ts}` }),
  });
  assert(ownerEvent.status === 200, "authenticated proctor event is stored");

  const spoofed = await json(
    await fetch(`${BASE_URL}/api/ai/mocktest/security`, {
      method: "POST",
      headers: { "Content-Type": "application/json", cookie: ownerCookie },
      body: JSON.stringify({
        type: "screenshot",
        timestamp: Date.now(),
        sessionId: `sess_${ts}`,
        userEmail: "victim@example.com",
      }),
    })
  );
  void spoofed;

  const otherRead = await json(
    await fetch(`${BASE_URL}/api/ai/mocktest/security?sessionId=sess_${ts}`, {
      headers: { cookie: otherCookie },
    })
  );
  assert(
    Array.isArray(otherRead.events) && otherRead.events.length === 0,
    "another account cannot read someone else's proctor events"
  );

  const ownerRead = await json(
    await fetch(`${BASE_URL}/api/ai/mocktest/security?sessionId=sess_${ts}`, {
      headers: { cookie: ownerCookie },
    })
  );
  assert(
    Array.isArray(ownerRead.events) && ownerRead.events.length === 2,
    `the owner reads their own events (${ownerRead?.count})`
  );
  assert(
    (ownerRead.events || []).every((e) => e.userEmail !== "victim@example.com"),
    "the stored email comes from the session, not the request body"
  );

  console.log("\nTest G: Paid-search proxies require a session");
  for (const path of ["/api/jobs?q=engineer", "/api/courses?q=engineer"]) {
    const res = await fetch(`${BASE_URL}${path}`);
    assert(res.status === 401, `${path} rejects anonymous callers (401)`);
  }

  console.log("\nTest H: Vector indexer is not an anonymous endpoint");
  const embed = await fetch(`${BASE_URL}/api/embed`, { method: "POST" });
  assert(embed.status === 401, "POST /api/embed requires a session");

  console.log("\nTest I: Directory reads expose only a peer-safe profile");
  const dir = await json(
    await fetch(`${BASE_URL}/api/data/users`, { headers: { cookie: otherCookie } })
  );
  const dirRows = Array.isArray(dir) ? dir : [];
  const PERSONAL = ["passwordHash", "userPhone", "phone", "latitude", "longitude", "institutionName", "remainingCredits", "totalCredits", "isPro", "invite_link"];
  assert(dirRows.length > 0, "the users directory returns rows for a signed-in caller");
  assert(
    dirRows
      .filter((r) => String(r.id) !== String(other.data?.user?.id))
      .every((r) => PERSONAL.every((f) => !(f in r))),
    "someone else's account row carries no phone, coordinates, credits or institution"
  );
  const ownRow = dirRows.find((r) => String(r.id) === String(other.data?.user?.id));
  assert(ownRow && "remainingCredits" in ownRow, "own row keeps private fields (credits readable)");

  const publicMentors = await json(await fetch(`${BASE_URL}/api/data/mentors`));
  assert(
    Array.isArray(publicMentors) && publicMentors.every((m) => !("phone" in m)),
    "anonymous mentor directory never includes personal phone numbers"
  );

  console.log("\nTest J: PostgREST filter grammar (in., is., unfiltered writes)");
  const inFilter = await json(
    await fetch(
      `${BASE_URL}/api/data/users?id=in.(${owner.data?.user?.id},${other.data?.user?.id})`,
      { headers: { cookie: ownerCookie } }
    )
  );
  assert(
    Array.isArray(inFilter) && inFilter.length === 2,
    `.in() list filter returns every listed row (${Array.isArray(inFilter) ? inFilter.length : "n/a"})`
  );

  const noFilterPatch = await fetch(`${BASE_URL}/api/data/tracks`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json", cookie: ownerCookie },
    body: JSON.stringify({ title: "mass-update" }),
  });
  assert(noFilterPatch.status === 400, "an unfiltered PATCH is refused instead of hitting every row");

  const noFilterDelete = await fetch(`${BASE_URL}/api/data/tracks`, {
    method: "DELETE",
    headers: { cookie: ownerCookie },
  });
  assert(noFilterDelete.status === 400, "an unfiltered DELETE is refused");

  console.log("\nTest K: Dev scaffolding is not reachable in the app router");
  for (const path of ["/home/test", "/home/test/run-embed", "/home/test/yt", "/home/test/showchats"]) {
    const res = await fetch(`${BASE_URL}${path}`, { headers: { cookie: ownerCookie } });
    assert(res.status === 404, `${path} no longer exists as a route`);
  }

  console.log("\nTest L: YouTube API key stays server-side");
  const ytAnon = await fetch(`${BASE_URL}/api/youtube/search?q=react`);
  assert(ytAnon.status === 401, "the YouTube proxy requires a session");
  const ytAuth = await fetch(`${BASE_URL}/api/youtube/search?q=react`, {
    headers: { cookie: ownerCookie },
  });
  assert(
    ytAuth.status === 503 || ytAuth.status === 200 || ytAuth.status === 502,
    `configured/unconfigured YouTube states are reported honestly (${ytAuth.status})`
  );

  console.log("\nTest M: Mentor-role endpoints reject student sessions");
  const studentVector = await fetch(`${BASE_URL}/api/vector/upload`, {
    method: "POST",
    headers: { "Content-Type": "application/json", cookie: ownerCookie },
    body: JSON.stringify({}),
  });
  assert(studentVector.status === 403, "a student session cannot index mentor vectors (403)");

  const anonSession = await json(await fetch(`${BASE_URL}/api/auth/session`));
  assert(anonSession.user === null, "/api/auth/session reports no user when anonymous");

  console.log("\nTest N: PostgREST logic groups (or= must OR, and= must AND)");
  const sessionInfo = await json(await fetch(`${BASE_URL}/api/auth/session`, { headers: { cookie: ownerCookie } }));
  const ownerId = String(sessionInfo?.user?.id);
  assert(ownerId !== "undefined", "owner session exposes an id for the logic-group probe");
  const probe = await json(
    await fetch(`${BASE_URL}/api/data/messages`, {
      method: "POST",
      headers: { "Content-Type": "application/json", cookie: ownerCookie },
      body: JSON.stringify({
        sender_id: ownerId,
        receiver_id: "qa_never_a_real_peer",
        message: "logic-group probe",
        created_at: new Date().toISOString(),
      }),
    })
  );
  const probeRow = Array.isArray(probe) ? probe[0] : probe;
  assert(!!probeRow?.id, "probe message created");
  const orQs = `or=(sender_id.eq.${ownerId},receiver_id.eq.${ownerId})`;
  const orRes = await json(await fetch(`${BASE_URL}/api/data/messages?${orQs}`, { headers: { cookie: ownerCookie } }));
  assert(
    Array.isArray(orRes) && orRes.some((r) => r.id === probeRow?.id),
    "or=(sender…,receiver…) matches on either side (was silently ANDed, breaking every chat thread)"
  );
  const orNeither = await json(
    await fetch(`${BASE_URL}/api/data/messages?or=(sender_id.eq.nope,receiver_id.eq.nope)`, { headers: { cookie: ownerCookie } })
  );
  assert(Array.isArray(orNeither) && orNeither.length === 0, "or= with no matching side returns nothing");
  const andRes = await json(
    await fetch(`${BASE_URL}/api/data/messages?and=(sender_id.eq.${ownerId},receiver_id.eq.nope)`, { headers: { cookie: ownerCookie } })
  );
  assert(Array.isArray(andRes) && andRes.length === 0, "and= requires every condition");
  const nestedRes = await json(
    await fetch(`${BASE_URL}/api/data/messages?or=(and(sender_id.eq.${ownerId},receiver_id.eq.nope),receiver_id.eq.qa_never_a_real_peer)`, { headers: { cookie: ownerCookie } })
  );
  assert(
    Array.isArray(nestedRes) && nestedRes.some((r) => r.id === probeRow?.id),
    "nested or=(and(…),…) resolves correctly"
  );
  await fetch(`${BASE_URL}/api/data/messages?id=eq.${probeRow?.id}`, { method: "DELETE", headers: { cookie: ownerCookie } });

  console.log(`\n=== RESULTS: ${pass} passed, ${fail} failed ===`);
  if (fail > 0) process.exit(1);
}

run().catch((err) => {
  console.error("Suite crashed:", err);
  process.exit(1);
});
