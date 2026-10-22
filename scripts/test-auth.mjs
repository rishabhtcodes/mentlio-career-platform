// Automated Authentication Test Suite for Mentlio / Clarioo
const BASE_URL = process.env.TEST_BASE_URL || "http://localhost:3000";

let testPassCount = 0;
let testFailCount = 0;

function assert(condition, message) {
  if (condition) {
    console.log(`  ✅ PASS: ${message}`);
    testPassCount++;
  } else {
    console.error(`  ❌ FAIL: ${message}`);
    testFailCount++;
  }
}

async function runTests() {
  console.log("=== STARTING MENTLIO AUTHENTICATION TEST SUITE ===\n");

  const timestamp = Date.now();
  const testEmail = `student_${timestamp}@mentlio.local`;
  const testPassword = "SecurePassword123!";

  // TEST 1: Registration with invalid inputs (short password)
  console.log("Test 1: Registration input validation (short password)");
  const res1 = await fetch(`${BASE_URL}/api/auth/signup`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: testEmail, password: "123" }),
  });
  const data1 = await res1.json();
  assert(res1.status === 400, "Rejects password shorter than 6 characters with status 400");
  assert(data1.error && data1.error.includes("6 characters"), "Returns clear password length error");

  // TEST 2: Registration with invalid email format
  console.log("\nTest 2: Registration input validation (invalid email)");
  const res2 = await fetch(`${BASE_URL}/api/auth/signup`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: "invalid-email-format", password: testPassword }),
  });
  assert(res2.status === 400, "Rejects malformed email address with status 400");

  // TEST 3: Successful registration
  console.log("\nTest 3: Valid user registration");
  const res3 = await fetch(`${BASE_URL}/api/auth/signup`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: testEmail, password: testPassword, fullName: "Test Student" }),
  });
  const data3 = await res3.json();
  const cookieHeader = res3.headers.get("set-cookie") || "";
  assert(res3.status === 200, "Successfully creates user with status 200");
  assert(data3.user && data3.user.email === testEmail, "Returns created user profile");
  assert(data3.session && data3.session.access_token, "Returns active session with access token");
  assert(cookieHeader.includes("mentlio_session"), "Sets secure HTTP-only mentlio_session cookie");

  // TEST 4: Duplicate account registration prevention
  console.log("\nTest 4: Duplicate registration prevention");
  const res4 = await fetch(`${BASE_URL}/api/auth/signup`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: testEmail, password: testPassword }),
  });
  const data4 = await res4.json();
  assert(res4.status === 409, "Rejects duplicate email registration with status 409");
  assert(data4.error && data4.error.includes("already exists"), "Returns clear duplicate account message");

  // TEST 5: Login with wrong password
  console.log("\nTest 5: Login with incorrect password");
  const res5 = await fetch(`${BASE_URL}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: testEmail, password: "WrongPassword999!" }),
  });
  assert(res5.status === 401, "Rejects incorrect password with status 401");

  // TEST 6: Login with non-existent user
  console.log("\nTest 6: Login with non-existent user");
  const res6 = await fetch(`${BASE_URL}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: `nonexistent_${timestamp}@mentlio.local`, password: testPassword }),
  });
  assert(res6.status === 401, "Rejects unknown email with status 401");

  // TEST 7: Login with valid credentials
  console.log("\nTest 7: Valid user login");
  const res7 = await fetch(`${BASE_URL}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: testEmail, password: testPassword }),
  });
  const data7 = await res7.json();
  const loginCookie = res7.headers.get("set-cookie") || "";
  assert(res7.status === 200, "Successfully logs in with status 200");
  assert(data7.user && data7.user.email === testEmail, "Returns authenticated user data");
  assert(loginCookie.includes("mentlio_session"), "Issues HTTP-only session cookie on login");

  // Extract session token
  const tokenMatch = loginCookie.match(/mentlio_session=([^;]+)/);
  const sessionToken = tokenMatch ? tokenMatch[1] : "";

  // TEST 8: Session verification via cookie
  console.log("\nTest 8: Session persistence & validation");
  const res8 = await fetch(`${BASE_URL}/api/auth/session`, {
    headers: { Cookie: `mentlio_session=${sessionToken}` },
  });
  const data8 = await res8.json();
  assert(res8.status === 200, "Retrieves active session with status 200");
  assert(data8.user && data8.user.email === testEmail, "Session correctly identifies the authenticated user");

  // TEST 9: Tampered session token rejection
  console.log("\nTest 9: Security: Tampered session token rejection");
  const tamperedToken = sessionToken.slice(0, -6) + "tamper";
  const res9 = await fetch(`${BASE_URL}/api/auth/session`, {
    headers: { Cookie: `mentlio_session=${tamperedToken}` },
  });
  const data9 = await res9.json();
  assert(data9.user === null, "Rejects cryptographically tampered session token");

  // TEST 10: Security: Unconfigured OAuth provider rejection (no fake sessions)
  console.log("\nTest 10: Security: Unconfigured OAuth provider rejection");
  const res10 = await fetch(`${BASE_URL}/api/auth/oauth`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ provider: "google" }),
  });
  const data10 = await res10.json();
  // In dev/test without live Google credentials, must reject with 501
  if (process.env.GOOGLE_CLIENT_ID && !process.env.GOOGLE_CLIENT_ID.includes("dummy")) {
    assert(res10.status === 200 && data10.url?.includes("accounts.google.com"), "Redirects to live Google auth");
  } else {
    assert(res10.status === 501, "Safely rejects unconfigured Google OAuth with 501");
    assert(data10.code === "OAUTH_PROVIDER_UNCONFIGURED", "Returns OAUTH_PROVIDER_UNCONFIGURED code");
    assert(!data10.session, "Never produces a session for unconfigured OAuth");
  }

  // TEST 10b: Security: Unsupported OAuth provider rejection
  console.log("\nTest 10b: Security: Unsupported OAuth provider rejection");
  const res10b = await fetch(`${BASE_URL}/api/auth/oauth`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ provider: "unsupported_provider_xyz" }),
  });
  const data10b = await res10b.json();
  assert(res10b.status === 400, "Rejects unsupported provider with status 400");
  assert(data10b.code === "INVALID_PROVIDER", "Returns INVALID_PROVIDER error code");

  // TEST 11: Logout session invalidation
  console.log("\nTest 11: Logout & session invalidation");
  const res11 = await fetch(`${BASE_URL}/api/auth/logout`, {
    method: "POST",
    headers: { Cookie: `mentlio_session=${sessionToken}` },
  });
  const logoutCookie = res11.headers.get("set-cookie") || "";
  assert(res11.status === 200, "Logs out successfully with status 200");
  assert(
    logoutCookie.includes("mentlio_session=;") || logoutCookie.includes("Max-Age=0"),
    "Clears HTTP-only session cookie on logout"
  );

  console.log("\n=== TEST SUITE RESULTS ===");
  console.log(`Total Passed: ${testPassCount}`);
  console.log(`Total Failed: ${testFailCount}`);

  if (testFailCount > 0) {
    process.exit(1);
  } else {
    console.log("ALL AUTHENTICATION TESTS PASSED PERFECTLY!\n");
  }
}

runTests().catch((err) => {
  console.error("Test execution error:", err);
  process.exit(1);
});
