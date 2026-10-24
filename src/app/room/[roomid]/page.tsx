
"use client";

import { useUserData } from "@/context/UserDataProvider";
import React, { useEffect, useRef, useState } from "react";


const Room = ({ params }: { params: Promise<{ roomid: string }> | { roomid: string } }) => {
  // useUser is a client hook — ok to use since this is a client component.
  // Next's App Router may provide params as a Promise in client components.
  // React.use(...) unwraps promises so we can access params.roomid synchronously.
  // If params is already a plain object, React.use returns it unchanged.
  // (If your Next version doesn't support React.use for this, replace with a server-side page
  // that passes roomID down to this client component.)
  // Type-ignore to avoid TS error if React.use isn't typed for this usage.
  // @ts-ignore
  const unwrappedParams = React.use ? React.use(params) : params;
  const roomID = (unwrappedParams && (unwrappedParams as any).roomid) || "";
  const { mentor } = useUserData();

  const containerRef = useRef<HTMLDivElement | null>(null);
  const zpRef = useRef<any>(null);
  const [callError, setCallError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;

    if (!roomID) {
      console.error("[Room] roomID is empty. params.roomid must be supplied.");
      setCallError("This call link is invalid: no room ID was provided.");
      return;
    }

    // run only in browser
    if (typeof window === "undefined" || typeof document === "undefined") {
      console.error("[Room] Not running in browser — Zego UI must run client-side.");
      return;
    }

    const init = async () => {
      try {
        // Dynamic import so the module only loads client-side (prevents "document is not defined")
        const zegoModule = await import("@zegocloud/zego-uikit-prebuilt");

        // The token is signed on the server: the Zego server secret must never
        // ship in the browser bundle.
        const tokenRes = await fetch("/api/zego/token", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ roomID, userName: mentor?.full_name || "Mentlio user" }),
        });

        if (!tokenRes.ok) {
          const detail = await tokenRes.json().catch(() => ({}));
          console.error("[Room] Could not start the call:", detail?.error || tokenRes.status);
          setCallError(
            detail?.error ||
              "Video calling is unavailable right now. The provider is not configured on this server."
          );
          return;
        }

        const { kitToken } = await tokenRes.json();
        if (!kitToken) {
          console.error("[Room] Server returned no Zego token.");
          setCallError("Video calling is unavailable right now.");
          return;
        }

        // create instance and join room
        const zp = (zegoModule as any).ZegoUIKitPrebuilt.create(kitToken);
        zpRef.current = zp;

        // defensive check
        if (!containerRef.current) {
          console.error("[Room] containerRef missing when trying to join room.");
          setCallError("The video call could not be started. Please refresh and try again.");
          return;
        }

        // joinRoom may throw if token invalid or other issues
        zp.joinRoom({
          container: containerRef.current,
          sharedLinks: [
            {
              name: "Shareable link",
              url:
                window.location.protocol +
                "//" +
                window.location.host +
                window.location.pathname +
                "?roomID=" +
                roomID,
            },
          ],
          scenario: {
            mode: (zegoModule as any).ZegoUIKitPrebuilt.VideoConference,
          },
        });
      } catch (err: any) {
        console.error("[Room] Zego init error:", err?.message || err);
        setCallError("The video call could not be started. Please try again.");
      }
    };

    init();

    return () => {
      mounted = false;
      // attempt cleanup if SDK exposes a destroy/leave method
      try {
        if (zpRef.current?.destroy) {
          zpRef.current.destroy();
        } else if (zpRef.current?.leave) {
          zpRef.current.leave();
        }
      } catch (e) {
        // ignore cleanup errors
      }
    };
    // we want roomID and fullName to re-run init if they change
  }, [roomID, mentor?.full_name]);

  return (
    <div className="relative">
      {callError && (
        <div className="absolute inset-0 flex items-center justify-center bg-gray-50 p-6">
          <p className="max-w-md text-center font-inter text-sm text-gray-700">{callError}</p>
        </div>
      )}
      <div
        className="myCallContainer"
        ref={containerRef}
        style={{ width: "100vw", height: "100vh" }}
      />
    </div>
  );
};

export default Room;