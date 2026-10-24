"use client";
import React, { useEffect, useState } from "react";
import { useUserData } from "@/context/UserDataProvider";
import { createClient } from "@/lib/supabase/client";
import { getUserQuizData } from "@/lib/functions/dbActions";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const IndustryCharts = () => {
  const { user } = useUserData();
  const [careerSkillOptions, setCareerSkillOptions] = useState<string[]>([]);
  const [quizDataLoading, setQuizDataLoading] = useState(false);
  const supabase = createClient();

  useEffect(() => {
    if (!user?.id) return;

    const fetchData = async () => {
      setQuizDataLoading(true);
      const data = await getUserQuizData(user.id);

      if (data.length > 0) {
        const firstQuiz = data[0];
        const options = firstQuiz.quizInfo?.careerOptions;

        if (Array.isArray(options)) {
          setCareerSkillOptions(options);
        }
      }
      setQuizDataLoading(false);
    };

    fetchData();
  }, [user?.id]);

  return (
    <Card className="w-full border rounded-md shadow-sm">
      <CardHeader>
        <CardTitle className="text-2xl font-sora font-medium">
        <h2>Career Salary Overview</h2>
        <p className="text-xl text-muted-foreground font-inter mt-1">Salary insights for your suggested careers, sourced from live job data.</p>
        </CardTitle>
      </CardHeader>
      <CardContent className="h-[350px]">
        {quizDataLoading ? (
          <p className="text-sm text-gray-500">Loading chart...</p>
        ) : careerSkillOptions.length === 0 ? (
          <p className="text-sm text-gray-500">
            Complete the career quiz to see salary insights for your suggested careers.
          </p>
        ) : (
          <div className="h-full flex items-center justify-center text-center px-6">
            <p className="text-sm text-gray-500 max-w-md">
              Salary data is not available yet. This chart needs a configured job-data provider
              (SERPAPI_KEY) on the server, and we never display invented figures as if they were real.
              Once the provider is enabled, average and peak salaries for{" "}
              {careerSkillOptions.slice(0, 3).join(", ")}
              {careerSkillOptions.length > 3 ? ` and ${careerSkillOptions.length - 3} more` : ""} will appear here.
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default IndustryCharts;
