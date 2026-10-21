import { createBrowserClient } from "@supabase/ssr";

/**
 * Custom fetch interceptor for Supabase client:
 * When the remote Supabase endpoint is offline or dummy, intercept auth and database
 * requests and route them to our secure local API backend.
 */
const localSupabaseFetch: typeof fetch = async (input, init) => {
  const urlStr = typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;

  try {
    const url = new URL(urlStr, window.location.origin);

    // 1. Intercept Auth endpoints
    if (url.pathname.includes("/auth/v1/signup")) {
      const body = init?.body ? JSON.parse(init.body as string) : {};
      const res = await fetch("/api/auth/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: body.email,
          password: body.password,
          role: body.data?.role || "user",
          fullName: body.data?.full_name,
          avatar: body.data?.avatar,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        return new Response(JSON.stringify({ msg: data.error, error_description: data.error }), {
          status: res.status,
          headers: { "Content-Type": "application/json" },
        });
      }
      return new Response(JSON.stringify(data), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }

    if (url.pathname.includes("/auth/v1/token")) {
      const body = init?.body ? JSON.parse(init.body as string) : {};
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: body.email,
          password: body.password,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        return new Response(JSON.stringify({ msg: data.error, error_description: data.error }), {
          status: res.status,
          headers: { "Content-Type": "application/json" },
        });
      }
      return new Response(JSON.stringify({ ...data, access_token: data.session?.access_token || "local-token" }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }

    if (url.pathname.includes("/auth/v1/user")) {
      const res = await fetch("/api/auth/session");
      const data = await res.json();
      if (!data.user) {
        return new Response(JSON.stringify({ msg: "No user", error: "not_found" }), {
          status: 401,
          headers: { "Content-Type": "application/json" },
        });
      }
      return new Response(JSON.stringify(data.user), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }

    if (url.pathname.includes("/auth/v1/logout")) {
      await fetch("/api/auth/logout", { method: "POST" });
      return new Response(JSON.stringify({}), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }

    if (url.pathname.includes("/auth/v1/authorize")) {
      const res = await fetch("/api/auth/oauth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ provider: "google" }),
      });
      const data = await res.json();
      if (data.url) {
        window.location.href = data.url;
      }
      return new Response(JSON.stringify(data), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }

    // 2. Intercept PostgREST database queries: /rest/v1/{table}
    if (url.pathname.includes("/rest/v1/")) {
      const parts = url.pathname.split("/rest/v1/");
      const tableAndQuery = parts[1] || "";
      const [table] = tableAndQuery.split("?");

      const queryParams = new URLSearchParams(url.search);
      // Map eq.val to simple val
      const localParams = new URLSearchParams();
      queryParams.forEach((val, key) => {
        if (val.startsWith("eq.")) {
          localParams.set(key, val.replace("eq.", ""));
        } else if (val.startsWith("in.")) {
          localParams.set(key, val.replace("in.(", "").replace(")", ""));
        } else {
          localParams.set(key, val);
        }
      });

      const method = init?.method || "GET";
      const forwardRes = await fetch(`/api/data/${table}?${localParams.toString()}`, {
        method,
        headers: { "Content-Type": "application/json" },
        body: init?.body,
      });

      const responseData = await forwardRes.json();
      return new Response(JSON.stringify(responseData), {
        status: forwardRes.status,
        headers: {
          "Content-Type": "application/json",
          "content-range": `0-${Array.isArray(responseData) ? responseData.length : 1}/*`,
        },
      });
    }

    // Default: try original fetch
    return fetch(input, init);
  } catch (err) {
    console.warn("Supabase fetch intercepted error:", err);
    return fetch(input, init);
  }
};

export function createClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || "https://pedvkwlatzssmjmgfjyn.supabase.co";
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.e30.dummy";

  return createBrowserClient(url, key, {
    global: {
      fetch: localSupabaseFetch,
    },
  });
}