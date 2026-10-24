"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { SidebarProvider } from "@/components/ui/sidebar";
import { AppSidebar } from "@/app/(main)/_components/app-sidebar";
import { Toaster } from "@/components/ui/sonner";
import Navbar from "@/app/(main)/_components/Navbar";
import { QuizDataProvider } from "@/context/userQuizProvider";
import { usePathname } from "next/navigation";
import GetUserLocation from "@/app/(main)/_components/GeoLocation";
import { InterviewProvider } from "@/context/InterviewContext";
import { createClient } from "@/lib/supabase/client";

function StudentAuthGate({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [allowed, setAllowed] = useState(false);

  useEffect(() => {
    const check = async () => {
      const supabase = createClient();
      const { data } = await supabase.auth.getUser();
      const role = data?.user?.user_metadata?.role;

      if (!role) {
        router.replace("/auth");
      } else if (role !== "user") {
        router.replace("/unauthorized");
      } else {
        setAllowed(true);
      }
    };
    check();
  }, [router]);

  if (!allowed) return <div className="p-6">Checking access...</div>;
  return <>{children}</>;
}

export default function Layout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const hideNavbar =
    (pathname.startsWith("/home/mentor-connect/") &&
      pathname !== "/home/mentor-connect" &&
      pathname !== "/home/mentor-connect/bookings") ||
    pathname === "/home/profile" ||
    pathname === "/home/calendar" ||
    pathname === "/home/settings/billing" ||
    pathname === "/home/ai-tools/resume-maker/start" ||
    pathname === "/home/interview-prep/start" ||
    pathname.includes("/mocktest/");

  const hideSidebar = pathname.includes("/mocktest");

  return (
    <div className="w-screen ">
      <SidebarProvider>
        {!hideSidebar && <AppSidebar />}
        <main className="flex-1 flex flex-col">
          <QuizDataProvider>
            <InterviewProvider>
              {!hideNavbar && <Navbar />}
              <StudentAuthGate>{children}</StudentAuthGate>
            </InterviewProvider>
          </QuizDataProvider>
        </main>
        <Toaster />
        <GetUserLocation />
      </SidebarProvider>
    </div>
  );
}
