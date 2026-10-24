"use client";
import { useEffect, useRef, useState } from "react";
import { Separator } from "@/components/ui/separator";
import { useUserData } from "@/context/UserDataProvider";
import { SidebarTrigger } from "@/components/ui/sidebar";
import Image from "next/image";
import React from "react";
import {
  LuActivity,
  LuChevronLeft,
  LuDownload,
  LuEye,
  LuFileVideo,
  LuGhost,
  LuLoader,
  LuMessagesSquare,
  LuMic,
  LuMicOff,
  LuVideo,
  LuVideoOff,
} from "react-icons/lu";
import { Button } from "@/components/ui/button";
import { LucideLoader2, Timer, X } from "lucide-react";
import { toast } from "sonner";
import Vapi from "@vapi-ai/web";
import AI_Voice from "@/components/kokonutui/ai-voice";
import { useInterview } from "@/context/InterviewContext";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import axios from "axios";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

const VAPI_PUBLIC_KEY = process.env.NEXT_PUBLIC_VAPI_PUBLIC_KEY || "";

// Vapi public keys are long "vk-…" strings; anything shorter, or obviously a
// .env placeholder, must not be sent to api.vapi.ai.
const isUsableVapiKey =
  VAPI_PUBLIC_KEY.length >= 20 && !/^(dumm|placehold|your|chang)/i.test(VAPI_PUBLIC_KEY);

interface Message {
  type: "user" | "assistant";
  content: string;
}

const InterviewStart = () => {
  const { user } = useUserData();
  const router = useRouter();
  const videoRef = useRef<HTMLVideoElement>(null);
  const micStreamRef = useRef<MediaStream | null>(null);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [isCameraOn, setIsCameraOn] = useState(false);
  const [isMicOn, setIsMicOn] = useState(false);
  const { interviewData } = useInterview();
  const [activeUser, setActiveUser] = useState<boolean>(false);
  const [loading, setLoading] = useState<boolean>(true);
  const [isCallActive, setIsCallActive] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [callFinished, setCallFinished] = useState<boolean>(false);
  const [feedbackloading, setFeedbackLoading] = useState<boolean>(false);
  const [blockedReason, setBlockedReason] = useState<string | null>(null);
  const supabase = createClient();

  const [isDialogOpen, setIsDialogOpen] = useState(false);

  const [vapi] = useState(() => new Vapi(VAPI_PUBLIC_KEY));

  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const startCamera = async () => {
    try {
      const mediaStream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "user" },
        audio: false,
      });
      if (videoRef.current) {
        videoRef.current.srcObject = mediaStream;
      }
      toast.success("Camera turned on");
      setStream(mediaStream);
      setIsCameraOn(true);
    } catch (err) {
      console.error("Camera access error:", err);
      toast.error("Camera permission was blocked.", {
        description: (
          <span className="text-gray-600 font-inter">
            Allow camera access in your browser settings to use video proctoring.
          </span>
        ),
      });
    }
  };

  const stopCamera = () => {
    if (stream) {
      stream.getTracks().forEach((track) => track.stop());
      setStream(null);
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    setIsCameraOn(false);
  };

  const toggleCamera = () => {
    if (isCameraOn) {
      stopCamera();
      toast.success("Camera turned off");
    } else startCamera();
  };

  const toggleMic = async () => {
    if (isMicOn) {
      micStreamRef.current?.getTracks().forEach((track) => track.stop());
      micStreamRef.current = null;
      setIsMicOn(false);
      toast.success("Mic turned off");
    } else {
      try {
        micStreamRef.current = await navigator.mediaDevices.getUserMedia({ audio: true });
        setIsMicOn(true);
        toast.success("Mic turned on");
      } catch (err) {
        console.error("Mic access error:", err);
        toast.error("Microphone permission was blocked.", {
          description: (
            <span className="text-gray-600 font-inter">
              Allow microphone access in your browser settings so the interviewer can hear you.
            </span>
          ),
        });
      }
    }
  };
 
  // ----------------------------VAPI SETUP--------------------------------
  useEffect(() => {
    if (!interviewData?.jobTitle) {
      setLoading(false);
      setBlockedReason(
        "No interview session is loaded here. Generate your questions in AI Interview Prep, then press Start Interview."
      );
      return;
    }
    if (!isUsableVapiKey) {
      setLoading(false);
      setBlockedReason(
        "Voice interviews need a Vapi public key. Set NEXT_PUBLIC_VAPI_PUBLIC_KEY and reload this page."
      );
      return;
    }
    startCall();
  }, [interviewData]);

  const startCall = async () => {
    const questionList = interviewData?.questions
      ?.map((q: any) => q.question)
      .join(", ");

      // gpt-4.1-mini
    const jobTitle = interviewData?.jobTitle;
    try {
      await vapi.start({
        model: {
          provider: "google",
          model: "gemini-2.5-pro",
          messages: [
            {
              role: "system",
              content: `
You are an AI interviewer conducting a verbal mock interview for the position of ${jobTitle}.
Your goal is to ask each question clearly and conversationally, like a friendly human interviewer.

Begin with a warm introduction:
"Hey there! Welcome to your ${jobTitle} interview. Let's get started with a few questions!"

Ask **one question at a time** and pause to let the candidate respond before moving on.
Keep your tone natural, curious, and friendly — not robotic.

Here are the interview questions to ask one by one:
${questionList}

💡 If the candidate struggles, gently offer a hint or rephrase the question, but don't reveal the full answer.
Example:
"Need a little hint? Think about how you'd handle state updates in React."

After each answer, give a short and engaging response such as:
"Nice, that makes sense!"
"Interesting approach!"
"That's close — maybe think about scalability next time."

Keep the flow light and engaging. Use casual transitions like:
"Alright, next one!" or "Let's dive into something trickier!"

Key Guidelines:
- Keep responses concise and human-like.
- Be encouraging and adaptive.
- Maintain focus on the ${jobTitle} domain.
          `.trim(),
            },
          ],
        },
        voice: {
          provider: "vapi",
          voiceId: "Hana",
        },
        transcriber: {
          provider: "deepgram",
          model: "nova-2",
          language: "en-US",
        },
        firstMessage: `Hi ${
          user?.userName || "there"
        }, how are you? Ready for your interview on ${jobTitle}?`,
        endCallMessage:
          "Thanks for chatting! That was a solid interview — see you crushing it soon!",
        endCallPhrases: ["goodbye", "bye", "end call", "hang up"],

        // silenceTimeoutSeconds: 20,
        maxDurationSeconds: 300,
      });

      console.log("🎤 Vapi Interview started successfully!");
    } catch (error) {
      console.error("❌ Error starting call:", error);
      setLoading(false);
      setBlockedReason(
        "The AI interviewer could not connect right now. End this session and start again."
      );
    }
  };

  useEffect(() => {
    const onSpeechStart = () => setActiveUser(true);
    const onSpeechEnd = () => setActiveUser(false);
    const onCallStart = () => {
      setIsCallActive(true);
      setLoading(false);
      setBlockedReason(null);
      toast.info("Interview Has been started", {
        description: (
          <span className="text-sm text-gray-500 font-medium">
            Your Interview Has Been started!{" "}
            <span className="text-blue-600">All the best</span>
          </span>
        ),
      });
    };
    const onCallEnd = () => {
      setIsCallActive(false);
      setCallFinished(true);
    };
    const onMessage = (message: any) => {
      if (message.type === "transcript" && message.transcriptType === "final") {
        const role = message.role === "user" ? "user" : "assistant";
        const content = message.transcript;

        setMessages((prev) => {
          if (prev.length > 0) {
            const lastMsg = prev[prev.length - 1];
            if (lastMsg.type === role && lastMsg.content === content) {
              return prev;
            }
          }
          return [...prev, { type: role, content }];
        });
      }
    };

    vapi.on("speech-start", onSpeechStart);
    vapi.on("speech-end", onSpeechEnd);
    vapi.on("call-start", onCallStart);
    vapi.on("call-end", onCallEnd);
    vapi.on("message", onMessage);

    return () => {
      vapi.off("speech-start", onSpeechStart);
      vapi.off("speech-end", onSpeechEnd);
      vapi.off("call-start", onCallStart);
      vapi.off("call-end", onCallEnd);
      vapi.off("message", onMessage);
    };
  }, [vapi]);

  useEffect(() => {
    if (callFinished) {
      GenerateFeedback();
      setIsDialogOpen(true);
      toast.success("Interview Has been Ended", {
        description: (
          <span className="text-sm text-gray-500 font-medium">
            Your Interview Has Been Ended!{" "}
          </span>
        ),
      });
    }
  }, [callFinished]);

  // ------------------------GENERATE FEEDBACK FUNCTION------------
  const GenerateFeedback = async () => {
    if (messages.length === 0) {
      toast.info("No answers were recorded.", {
        description: (
          <span className="text-sm text-gray-500 font-medium">
            We could not build insights because the transcript is empty.
          </span>
        ),
      });
      return;
    }

    setFeedbackLoading(true);

    try {
      const response = await axios.post("/api/feedback", {
        conversation: messages,
      });

      const feedbackData = response.data?.data;

      const { error } = await supabase.from("others").insert([
        {
          userId: user?.id,
          jobTitle: interviewData?.jobTitle,
          interviewInsights: feedbackData,
        },
      ]);

      if (error) {
        console.error("❌ Supabase Insert Error:", error);
        toast.error("Feedback was generated but could not be saved.");
      } else {
        toast.success("Feedback generated successfully!");
      }
    } catch (error: any) {
      console.error("❌ Feedback Error:", error);
      toast.error("Failed to generate feedback. Try again!");
    } finally {
      setFeedbackLoading(false);
    }
  };

  const downloadTranscript = () => {
    if (messages.length === 0) {
      toast.info("No transcript yet.", {
        description: (
          <span className="text-gray-600 font-inter">
            Answers appear here once you speak during the interview.
          </span>
        ),
      });
      return;
    }

    const lines = messages.map(
      (m) => `${m.type === "assistant" ? "Interviewer" : "You"}: ${m.content}`
    );
    const blob = new Blob(
      [`Mentlio AI Interview Prep — transcript\n${new Date().toLocaleString()}\n\n${lines.join("\n\n")}\n`],
      { type: "text/plain;charset=utf-8" }
    );
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `mentlio-interview-transcript-${Date.now()}.txt`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
    toast.success("Transcript downloaded.");
  };

  const handleEnd = () => {
    stopCamera();
    micStreamRef.current?.getTracks().forEach((track) => track.stop());
    micStreamRef.current = null;
    try {
      vapi.stop();
    } catch (error) {
      console.error("Error stopping the call:", error);
    }
    setIsMicOn(false);
    toast.success("Call ended");
    // Vapi does not always emit call-end when the session never fully started,
    // so drive the end-of-interview flow from here as well.
    setCallFinished(true);
  };

  useEffect(() => {
    return () => {
      (videoRef.current?.srcObject as MediaStream | null)
        ?.getTracks()
        .forEach((track) => track.stop());
      micStreamRef.current?.getTracks().forEach((track) => track.stop());
      micStreamRef.current = null;
    };
  }, []);

  // -------------------TIMER-----------------------------------
  const [seconds, setSeconds] = useState(0);
  useEffect(() => {
    let interval: NodeJS.Timeout | null = null;

    if (isCallActive) {
      interval = setInterval(() => {
        setSeconds((prev) => prev + 1);
      }, 1000);
    } else {
      // Reset timer when call ends
      setSeconds(0);
      if (interval) clearInterval(interval);
    }

    return () => {
      if (interval) clearInterval(interval);
    };
  }, [isCallActive]);

  const formatTime = (totalSeconds: number) => {
    const hrs = Math.floor(totalSeconds / 3600)
      .toString()
      .padStart(2, "0");
    const mins = Math.floor((totalSeconds % 3600) / 60)
      .toString()
      .padStart(2, "0");
    const secs = (totalSeconds % 60).toString().padStart(2, "0");
    return `${hrs}:${mins}:${secs}`;
  };

  return (
    <div className="w-full h-screen overflow-hidden  bg-white p-4">
      <div className="flex justify-between w-full">
        <div>
          <div className="flex gap-3">
            <SidebarTrigger />
            <Button
              type="button"
              variant="ghost"
              onClick={() => router.back()}
              className="flex items-center gap-1 px-2 font-inter text-base text-black hover:bg-transparent"
            >
              <LuChevronLeft className="w-4 h-4" /> Back
            </Button>
          </div>
          <h1 className="text-[27px] font-sora font-semibold mt-2 flex items-center gap-4">
            AI Interview Prep <LuVideo className="w-6 h-6" />
          </h1>
        </div>
        <Image
          src={user?.avatar || "/user.png"}
          alt="User Avatar"
          width={70}
          height={70}
          className="rounded-full w-[72px] h-[72px] shrink-0"
        />
      </div>
      <Separator className="my-2 max-w-[90%] bg-gray-300 mx-auto" />

      {/* PARENT BOX - LEFT VIDEO / RIGHT - MESSAGE */}
      <div className="flex gap-5 ">
        {/* LEFT */}
        <div className="flex-1 p-2">
          <div className="flex justify-between mb-2">
            {loading ? (
              <div className="flex gap-4">
                <div className="w-5 h-5 bg-red-400 rounded-full animate-bounce"></div>
                <p className="font-inter text-base tracking-wide">
                  Connecting...
                </p>
              </div>
            ) : blockedReason ? (
              <div className="flex gap-4">
                <div className="w-5 h-5 bg-gray-400 rounded-full"></div>
                <p className="font-inter text-base tracking-wide">
                  Not connected
                </p>
              </div>
            ) : (
              <div className="flex gap-4">
                <div className="w-5 h-5 bg-green-300 rounded-full animate-bounce"></div>
                <p className="font-inter text-base tracking-wide">Connected</p>
              </div>
            )}

            <p className="text-xl flex items-center gap-3 font-semibold">
              <Timer /> {formatTime(seconds)}
            </p>
          </div>
          {/* VIDEO PART */}
          <div className="flex  justify-center w-full h-[520px] border rounded-lg shadow relative overflow-hidden">
            <video
              ref={videoRef}
              autoPlay
              playsInline
              muted
              className="w-full h-full object-cover rounded-xl"
            />
            {!isCameraOn && (
              <div>
                <Image
                  src={user?.avatar || "/user.png"}
                  alt="User Avatar"
                  width={70}
                  height={70}
                  className="rounded-full w-[200px] h-[200px] absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2"
                />
              </div>
            )}

            <div className="w-[180px] h-[180px] bg-blue-50 absolute top-3 right-3 rounded-lg border-2 border-blue-400 flex flex-col items-center justify-center overflow-hidden">
              <div className="  bg-white border rounded-full w-16 h-16 flex items-center justify-center shrink-0 -mb-5">
                <h1 className="font-extrabold font-inter text-2xl">AI</h1>
              </div>
              {!loading && !blockedReason && (
                <div className="mt-10 flex flex-col space-y-1">
                  <AI_Voice />
                  {activeUser ? (
                    <p className="text-center font-inter text-sm">Speaking</p>
                  ) : (
                    <p className="text-center font-inter text-sm">Listening</p>
                  )}
                </div>
              )}
            </div>

            {blockedReason && (
              <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-4 bg-white/95 px-8 text-center">
                <LuVideoOff className="w-8 h-8 text-gray-400" />
                <p className="max-w-md font-inter text-sm text-gray-700">
                  {blockedReason}
                </p>
                <Button
                  onClick={() => router.push("/home/interview-prep")}
                  className="font-inter text-sm bg-blue-500 text-white hover:bg-blue-700 cursor-pointer"
                >
                  <LuChevronLeft className="w-4 h-4 mr-2" />
                  Back to Interview Prep
                </Button>
              </div>
            )}
          </div>

          {!blockedReason && (
          <div className="mt-7 flex justify-center gap-10">
            {/*  Video Button */}
            <Button
              variant={isCameraOn ? "default" : "outline"}
              onClick={toggleCamera}
              className="font-inter text-sm shadow-md cursor-pointer"
            >
              {isCameraOn ? (
                <LuVideo className="w-4 h-4 mr-2 text-white" />
              ) : (
                <LuVideoOff className="w-4 h-4 mr-2 text-black" />
              )}
              Video
            </Button>
            {/*  Mic Button */}
            <Button
              variant={isMicOn ? "default" : "outline"}
              onClick={toggleMic}
              className="font-inter text-sm shadow-md cursor-pointer"
            >
              {isMicOn ? (
                <LuMic className="w-4 h-4 mr-2 text-white" />
              ) : (
                <LuMicOff className="w-4 h-4 mr-2 text-black" />
              )}
              Mic
            </Button>
            {/*  End Button */}
            <Button
              variant="destructive"
              onClick={handleEnd}
              className="font-inter text-sm shadow-md cursor-pointer"
            >
              <X className="w-4 h-4 mr-2" />
              End
            </Button>
          </div>
          )}
        </div>
        {/* RIGHT */}
        <div className="w-[28%] bg-gray-50 rounded-lg border p-3 flex flex-col">
          <h2 className="flex items-center justify-center gap-3 font-inter text-xl">
            Transcribe <LuMessagesSquare className="w-6 h-6" />
          </h2>
          <div className="bg-blue-50 border border-blue-400 mt-4 px-3 py-6 rounded-md">
            <p className="font-inter tracking-tight text-sm text-center">
              All transcriptions appear here. Please give clear, relevant
              answers.
            </p>
          </div>

          {messages.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full ">
              <h2 className="font-inter text-lg text-muted-foreground mb-2">
                No Transcriptions Available
              </h2>
              <LuGhost className="w-6 h-6 text-muted-foreground" />
            </div>
          ) : (
            <div className="space-y-3 h-[380px] mt-5 overflow-y-scroll">
              {messages.map((msg, i) => (
                <div
                  key={i}
                  className={`flex ${
                    msg.type === "assistant" ? "justify-start" : "justify-end"
                  }`}
                >
                  <div
                    className={`max-w-[70%] px-4 py-2 rounded-2xl text-xs tracking-tight font-inter shadow-sm ${
                      msg.type === "assistant"
                        ? "bg-white text-foreground rounded-bl-none"
                        : "bg-primary text-primary-foreground rounded-br-none"
                    }`}
                  >
                    {msg.content}
                  </div>
                  <div ref={scrollRef} />
                </div>
              ))}
            </div>
          )}

          <div className="w-full mt-auto">
            <Separator className="my-2" />
            <Button
              onClick={downloadTranscript}
              className="font-inter text-sm w-full bg-white text-black hover:bg-gray-100 cursor-pointer"
            >
              Download Transcript <LuDownload className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </div>

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="p-4  rounded-md max-w-md  overflow-hidden ">
          <h1 className="text-center font-semibold font-inter text-xl">
            Interview Ended Successfully{" "}
            <LuActivity className="inline w-5 h-5 ml-2" />
          </h1>
          <p className=" mt-3 font-inter text-center text-muted-foreground">
            Kindly wait, insights are being generated for you. Then you can
            safely leave this page.
          </p>

          {feedbackloading ? (
            <Button className="mt-5">
              <LucideLoader2 className="w-6 h-6 animate-spin " />
              Generating
            </Button>
          ) : (
            <Button
              className="font-inter text-sm mt-5"
              onClick={() => router.push("/home/interview-prep")}
            >
              <LuEye className="w-5 h-5 mr-2" />
              View Insights
            </Button>
          )}

          {/* <Image src="/element1.png" alt="success" width={100} height={100} className="mx-auto h-full w-full object-cover -mt-20" /> */}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default InterviewStart;
