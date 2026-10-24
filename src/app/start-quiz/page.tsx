"use client";
import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Quiz from "../(main)/_components/NewQuizComponent";
import { createClient } from "@/lib/supabase/client";

const StartQuiz = () => {
  const router = useRouter();
  const [allowed, setAllowed] = useState(false);

  useEffect(() => {
    const check = async () => {
      const supabase = createClient();
      const { data } = await supabase.auth.getUser();
      if (!data?.user?.user_metadata?.role) {
        router.replace("/auth");
      } else {
        setAllowed(true);
      }
    };
    check();
  }, [router]);

  if (!allowed) return <div className="p-6">Checking access...</div>;

  return (
    <div className="h-screen w-full relative">
      <Quiz />
    </div>
  );
};

export default StartQuiz;
