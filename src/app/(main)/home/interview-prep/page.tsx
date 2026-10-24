"use client";

import { Separator } from "@/components/ui/separator";
import SingleCard from "../../_components/InterviewSingleCard";
import { LuCircleFadingArrowUp, LuLoader } from "react-icons/lu";
import { Button } from "@/components/ui/button";
import { GhostIcon, LucideActivity, LucideHistory } from "lucide-react";
import Image from "next/image";
import { useEffect, useState } from "react";
import { InterviewFeedback } from "@/lib/types/allTypes";
import { useUserData } from "@/context/UserDataProvider";
import { useInterview } from "@/context/InterviewContext";
import { createClient } from "@/lib/supabase/client";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Progress } from "@/components/ui/progress";
import { format } from "date-fns";
import { toast } from "sonner";
import axios from "axios";

import { useRouter } from "next/navigation";

const InterviewDefault = () => {
  const router = useRouter();
  const { user } = useUserData();
  const { setInterviewData } = useInterview();
  const [feedbacks, setFeedbacks] = useState<InterviewFeedback[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<InterviewFeedback | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [jobTitle, setJobTitle] = useState("");
  const [jobDescription, setJobDescription] = useState("");
  const supabase = createClient();

  useEffect(() => {
    const fetchFeedbacks = async () => {
      if (!user?.id) return;

      setLoading(true);
      const { data, error } = await supabase
        .from("others")
        .select("*")
        .eq("userId", user.id)
        .order("created_at", { ascending: false });

      if (error) {
        console.error("❌ Supabase fetch error:", error);
      } else {
        setFeedbacks(data as InterviewFeedback[]);
      }
      setLoading(false);
    };

    fetchFeedbacks();
  }, [user]);

  const formatDate = (value: string) => {
    const date = new Date(value);
    return date.getTime()
      ? format(date, "dd MMM yyyy, hh:mm a")
      : "Unknown date";
  };

  const now = new Date();
  const completedThisMonth = feedbacks.filter((fb) => {
    const date = new Date(fb.created_at);
    return (
      !isNaN(date.getTime()) &&
      date.getMonth() === now.getMonth() &&
      date.getFullYear() === now.getFullYear()
    );
  }).length;

  const handleGenerateInterview = async () => {
    const title = jobTitle.trim();
    const description = jobDescription.trim();

    if (title.length < 3) {
      toast.error("Enter the job title for this interview.");
      return;
    }
    if (description.length < 20) {
      toast.error("Add a short job description.", {
        description: (
          <span className="text-gray-600 font-inter">
            Paste the posting or list the key skills — the AI builds the
            questions from it.
          </span>
        ),
      });
      return;
    }

    setGenerating(true);
    try {
      const response = await axios.post("/api/ai/qna-generate", {
        jobTitle: title,
        jobDescription: description,
      });

      const questions = (
        response.data?.data?.interviewQuestions || []
      ).filter((q: any) => q?.question);

      if (questions.length === 0) {
        toast.error("The AI returned no questions. Please try again.");
        return;
      }

      setInterviewData({ jobTitle: title, questions });
      setCreateOpen(false);
      toast.success(`${questions.length} questions ready. Starting interview…`);
      router.push("/home/interview-prep/start");
    } catch (error: any) {
      const message =
        error?.response?.data?.error ||
        error?.response?.data?.message ||
        "Could not generate interview questions. Please try again.";
      toast.error(message);
    } finally {
      setGenerating(false);
    }
  };

  return (
    <div className="bg-gray-50 h-full overflow-hidden w-full px-2 py-4">
      <SingleCard onStart={() => setCreateOpen(true)} />
      <div className="mt-6 flex w-full h-full">
        {/* LEFT SIDE */}
        <div className="w-[320px] flex flex-col px-1">
          <h1 className="text-2xl font-semibold font-sora mb-8">
            Create AI Interviews
          </h1>
          <div className="w-full px-4">
            {" "}
            <h2 className="font-medium font-inter text-base">
              Create New Interview{" "}
              <LuCircleFadingArrowUp className="inline w-5 h-5 ml-2" />
            </h2>
            <Button
              className="text-sm font-inter mt-4 w-full cursor-pointer"
              variant="outline"
              onClick={() => setCreateOpen(true)}
            >
              Create New{" "}
              <LuCircleFadingArrowUp className="inline w-5 h-5 ml-2" />{" "}
            </Button>
            <h2 className="font-medium font-inter text-base mt-5">
              Create From Job Tracker Board{" "}
              <LucideActivity className="inline w-5 h-5 ml-2" />
            </h2>
            <Button
              className="text-sm font-inter mt-4 w-full cursor-pointer"
              variant="outline"
              onClick={() => router.push("/home/job-tracker")}
            >
              Job Tracker <LucideActivity className="inline w-5 h-5 ml-2" />{" "}
            </Button>
          </div>
          <div className="h-[180px] bg-gradient-to-br from-yellow-50 via-yellow-200 to-yellow-400 w-full mt-10 rounded-lg p-2 relative overflow-hidden">
            <Image
              src="/element1.png"
              alt="element"
              width={200}
              height={200}
              className="w-full h-full object-cover absolute -left-28"
            />
            <h2 className="font-extrabold font-inter text-black text-4xl absolute top-[34%] right-[40%]">
              {loading ? "–" : completedThisMonth}
            </h2>
            <h2 className="font-medium font-inter text-black text-xl absolute top-[60%] right-5 text-center max-w-[180px]">
              Interviews completed this month
            </h2>
          </div>
        </div>
        <Separator orientation="vertical" className="mx-2 " />
        {/* Right side */}
        <div className="flex-1 h-full  rounded-md p-4">
          <h1 className="text-2xl font-semibold font-sora tracking-wide ml-4 -mt-4">
            Interviews History <LucideHistory className="inline w-6 h-6 ml-2" />
          </h1>
          {feedbacks.length > 0 ? (
            // All cards will be displayed
            <div className="grid grid-cols-3 gap-5 mt-6">
              {feedbacks.map((fb) => {
                const ratings = fb.interviewInsights?.feedback?.rating || {};
                const entries = Object.entries(ratings as Record<string, number>);
                const avgScore = entries.length
                  ? (
                      entries.reduce(
                        (acc, [, val]) => acc + (Number(val) || 0),
                        0
                      ) / entries.length
                    ).toFixed(1)
                  : "–";

                return (
                  <Card
                    key={fb.id}
                    onClick={() => setSelected(fb)}
                    className="p-3 cursor-pointer hover:scale-[1.02] transition-all border border-gray-200 shadow-sm"
                  >
                    <h3 className="font-inter font-semibold text-base capitalize tracking-tight ">
                      {fb.jobTitle || "Interview "}
                    </h3>
                    <p className="text-sm text-muted-foreground font-inter -mt-4">
                      {formatDate(fb.created_at)}
                    </p>
                    <div className="flex items-center justify-between">
                      <p className="font-inter text-sm text-gray-600">
                        Avg. Score
                      </p>
                      <p className="font-sora font-semibold text-blue-600 text-base">
                        {avgScore}/10
                      </p>
                    </div>
                  </Card>
                );
              })}
            </div>
          ) : (
            <div className="mt-20 w-full flex flex-col items-center justify-center">
              <p className="font-semibold text-muted-foreground mb-6  font-inter text-xl">No Interviews Created</p>
              <GhostIcon className="w-10 h-10 text-gray-400" />
            </div>
          )}
        </div>
      </div>

      {/* ---------- Dialog ---------- */}
      <Dialog open={!!selected} onOpenChange={() => setSelected(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="font-sora text-xl text-center">
              {selected?.jobTitle || "Interview"}
            </DialogTitle>
            <p className="text-sm font-inter text-gray-500">
              {selected && formatDate(selected.created_at)}
            </p>
          </DialogHeader>

          {selected && (
            <div className="space-y-4 mt-4">
              {Object.entries(
                selected.interviewInsights?.feedback?.rating || {}
              ).map(
                ([key, value]) => {
                  const score = value ?? 0;
                  const getColor = () => {
                    if (score <= 3) return "bg-red-500";
                    if (score <= 6) return "bg-orange-400";
                    return "bg-green-500";
                  };

                  return (
                    <div key={key}>
                      <div className="flex justify-between text-sm mb-1">
                        <span className="capitalize font-medium">{key}</span>
                        <span className="text-gray-600">{score}/10</span>
                      </div>

                      <div className="relative w-full h-2 bg-gray-200 rounded-full overflow-hidden">
                        <div
                          className={`h-full ${getColor()} rounded-full transition-all duration-500`}
                          style={{ width: `${score * 10}%` }}
                        />
                      </div>
                    </div>
                  );
                }
              )}
              <div className="mt-5">
                <h4 className="font-sora font-semibold mb-2">Summary</h4>
                <p className="text-sm text-gray-800 font-inter leading-relaxed">
                  {selected.interviewInsights?.feedback?.summary ||
                    "No written summary was stored for this interview."}
                </p>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* ---------- Create interview dialog ---------- */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="font-sora text-xl">
              Create a new AI interview
            </DialogTitle>
            <DialogDescription className="font-inter text-sm">
              Mentlio generates 6-7 questions from the role and description,
              then the AI interviewer asks them out loud.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 mt-2">
            <div className="space-y-2">
              <Label htmlFor="interviewJobTitle" className="font-inter text-sm">
                Job title
              </Label>
              <Input
                id="interviewJobTitle"
                placeholder="e.g. Frontend Developer"
                value={jobTitle}
                onChange={(e) => setJobTitle(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label
                htmlFor="interviewJobDescription"
                className="font-inter text-sm"
              >
                Job description or key skills
              </Label>
              <Textarea
                id="interviewJobDescription"
                rows={5}
                placeholder="e.g. React, TypeScript, Next.js, state management, REST APIs, testing, performance optimisation."
                value={jobDescription}
                onChange={(e) => setJobDescription(e.target.value)}
              />
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setCreateOpen(false)}
              disabled={generating}
              className="font-inter text-sm cursor-pointer"
            >
              Cancel
            </Button>
            <Button
              onClick={handleGenerateInterview}
              disabled={generating}
              className="font-inter text-sm cursor-pointer bg-blue-500 text-white hover:bg-blue-700"
            >
              {generating ? (
                <>
                  <LuLoader className="w-4 h-4 mr-2 animate-spin" />
                  Generating
                </>
              ) : (
                <>
                  Start Interview <LucideActivity className="w-4 h-4 ml-2" />
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default InterviewDefault;
