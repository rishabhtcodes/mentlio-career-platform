"use client";
import React, { createContext, useContext, useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useUserData } from "@/context/UserDataProvider";
import { getUserQuizData } from "@/lib/functions/dbActions";
import { UserQuizData } from "@/lib/types/allTypes";

type QuizContextType = {
  quizData: UserQuizData | null;
  loadingQuiz: boolean;
  refreshQuizData: () => Promise<void>;
};

const QuizContext = createContext<QuizContextType>({
  quizData: null,
  loadingQuiz: false,
  refreshQuizData: async () => {},
});

export const QuizDataProvider = ({
  children,
}: {
  children: React.ReactNode;
}) => {
  const { user, loading } = useUserData();
  const [quizData, setQuizData] = useState<UserQuizData | null>(null);
  const [loadingQuiz, setLoadingQuiz] = useState(false);
  const supabase = createClient();

  const fetchQuizData = async () => {
    if (!user || loading || user?.isQuizDone == false) return;

    setLoadingQuiz(true);
    // Route through the shared accessor so the provider sees the same ordering
    // and career backfill as every other reader: a retake inserts a new row with
    // no selectedCareer, and reading only that row made the career disappear.
    const rows = await getUserQuizData(user.id);
    setQuizData(rows[0] ?? null);
    setLoadingQuiz(false);
  };

  useEffect(() => {
    fetchQuizData();
  }, [user, loading]);

  useEffect(() => {
    if (!user?.id) return;

    const channel = supabase
      .channel("quiz-update-listener")
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "userQuizData",
          filter: `userId=eq.${user.id}`,
        },
        () => {
          fetchQuizData(); 
        }
      )
      .subscribe();


    return () => {
      supabase.removeChannel(channel);
    };
  }, [user?.id]);

  return (
    <QuizContext.Provider
      value={{
        quizData,
        loadingQuiz,
        refreshQuizData: fetchQuizData,
      }}
    >
      {children}
    </QuizContext.Provider>
  );
};

export const useQuizData = () => useContext(QuizContext);
