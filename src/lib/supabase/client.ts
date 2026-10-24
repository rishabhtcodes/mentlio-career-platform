import { createBrowserClient } from "@supabase/ssr";

/**
 * Custom fetch interceptor for Supabase client:
 * When the remote Supabase endpoint is offline or dummy, intercept auth and database
 * requests and route them to our secure local API backend.
 */
const localSupabaseFetch: typeof fetch = async (input, init) => {
  const urlStr = typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;

  // Build a GoTrue-compatible session payload from our backend's auth response
  // so supabase-js populates data.session (and saves it) on signUp/signIn.
  const sessionPayload = (data: any) => {
    const accessToken = data?.session?.access_token || "local-token";
    const expiresIn = data?.session?.expires_in ?? 72 * 3600;
    return {
      access_token: accessToken,
      refresh_token: `mentlio-local-refresh:${accessToken.slice(-24)}`,
      expires_in: expiresIn,
      expires_at: Math.floor(Date.now() / 1000) + expiresIn,
      token_type: "bearer",
      user: data?.user ?? null,
    };
  };

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
      return new Response(JSON.stringify(sessionPayload(data)), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }

    if (url.pathname.includes("/auth/v1/token")) {
      const body = init?.body ? JSON.parse(init.body as string) : {};
      const isRefreshGrant =
        body?.grant_type === "refresh_token" || (body?.refresh_token && !body?.email);

      if (isRefreshGrant) {
        // Resolve the current server-side session (HTTP-only cookie) instead.
        const sessionRes = await fetch("/api/auth/session");
        const sessionData = await sessionRes.json();
        if (!sessionData.user) {
          return new Response(
            JSON.stringify({ msg: "Session expired", error_description: "Session expired" }),
            { status: 401, headers: { "Content-Type": "application/json" } }
          );
        }
        return new Response(
          JSON.stringify({
            access_token: "local-token",
            refresh_token: body.refresh_token || "mentlio-local-refresh",
            expires_in: 72 * 3600,
            expires_at: Math.floor(Date.now() / 1000) + 72 * 3600,
            token_type: "bearer",
            user: sessionData.user,
          }),
          { status: 200, headers: { "Content-Type": "application/json" } }
        );
      }

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
      return new Response(JSON.stringify(sessionPayload(data)), {
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
      const provider = url.searchParams.get("provider") || "google";
      const role = url.searchParams.get("role") || "user";
      const res = await fetch("/api/auth/oauth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ provider, role }),
      });
      const data = await res.json();
      if (!res.ok) {
        return new Response(
          JSON.stringify({
            msg: data.error || "OAuth provider not configured",
            error_description: data.error || "OAuth provider not configured",
          }),
          {
            status: res.status,
            headers: { "Content-Type": "application/json" },
          }
        );
      }
      if (data.url && (data.url.startsWith("https://") || data.url.startsWith("http://"))) {
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

      // PostgREST filter operators (eq./neq./in./is./or=/order=) are understood
      // natively by /api/data/[table], so forward them untouched. Rewriting
      // `in.(1,2)` into `1,2` used to silently match zero rows.
      const localParams = new URLSearchParams(url.search);

      const method = init?.method || "GET";
      const forwardHeaders: Record<string, string> = {
        "Content-Type": "application/json",
      };
      const accept = new Headers(init?.headers as any).get("accept") || "";
      if (accept.includes("application/vnd.pgrst.object+json")) {
        forwardHeaders.Accept = "application/vnd.pgrst.object+json";
      }

      const forwardRes = await fetch(`/api/data/${table}?${localParams.toString()}`, {
        method,
        headers: forwardHeaders,
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

  const client = createBrowserClient(url, key, {
    global: {
      fetch: localSupabaseFetch,
    },
  });

  // This deployment has no Supabase project behind it: auth and data are served by
  // our own /api routes. Realtime therefore has no socket server, and letting
  // supabase-js connect produces endless failed-websocket noise in the console.
  // Subscriptions become explicit no-ops; lists still refresh on mount.
  const noopChannel = () => {
    const ch: any = {
      on: () => ch,
      subscribe: () => ch,
      unsubscribe: () => ch,
      close: () => ch,
      send: () => ch,
    };
    return ch;
  };
  (client as any).channel = noopChannel;
  (client as any).removeChannel = () => {};

  return client;
}