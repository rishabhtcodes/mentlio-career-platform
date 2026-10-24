"use client";

import { useEffect, useState } from "react";
import { Typewriter } from "react-simple-typewriter";
import { BsStars } from "react-icons/bs";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
  SheetFooter,
} from "@/components/ui/sheet";
import { useAssistantSheetStore } from "@/lib/store/useAssistantSheet";
import Image from "next/image";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { LuSend } from "react-icons/lu";
import { useUserData } from "@/context/UserDataProvider";
import { useQuizData } from "@/context/userQuizProvider";

type AssistantMessage = { role: "user" | "ai"; text: string };

export default function AnimatedAssistant() {
  const [showWave, setShowWave] = useState(false);
  const [displayText, setDisplayText] = useState("AI Assistant");
  const { isOpen, open, close } = useAssistantSheetStore();
  const { user } = useUserData();
  const { quizData } = useQuizData();
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<AssistantMessage[]>([]);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const sendMessage = async () => {
    const question = input.trim();
    if (!question || sending) return;
    setSending(true);
    setError(null);
    setMessages((prev) => [...prev, { role: "user", text: question }]);
    setInput("");
    try {
      const res = await fetch("/api/ai/career-coach", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          question,
          userName: user?.userName,
          user_current_status: user?.current_status,
          stream: quizData?.quizInfo?.stream,
          careerOptions: (quizData?.quizInfo?.careerOptions || []).join(", "),
          summary: quizData?.quizInfo?.summary,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "The assistant is unavailable right now.");
      setMessages((prev) => [...prev, { role: "ai", text: String(data.reply ?? "") }]);
    } catch (err: any) {
      setError(err?.message || "The assistant is unavailable right now.");
    } finally {
      setSending(false);
    }
  };


  const texts = [
    "Do You Need help?",
    "Ask me anything.",
    "AI Assistant",
    "How can I help today?",
  ];

  const prompts = [
    "Which career suits my profile best?",
    "What skills should I learn next?",
    "How do I build a strong resume?",
    "How should I prepare for interviews?",
  ];

  useEffect(() => {
    let waveTimeout: NodeJS.Timeout;
    let triggerTimeout: NodeJS.Timeout;

    const triggerEffect = () => {
      let newText = displayText;
      while (newText === displayText && texts.length > 1) {
        newText = texts[Math.floor(Math.random() * texts.length)];
      }
      setDisplayText(newText);

      setShowWave(true);
      waveTimeout = setTimeout(() => setShowWave(false), 1200);

      const nextDelay = Math.random() * 10000 + 8000;
      triggerTimeout = setTimeout(triggerEffect, nextDelay);
    };

    triggerEffect();

    return () => {
      clearTimeout(waveTimeout);
      clearTimeout(triggerTimeout);
    };
  }, []);

  return (
    <>
      <div className="flex items-center gap-4 relative">
        <div
          onClick={open}
          className="relative bg-gradient-to-br from-blue-300/30 to-white w-11 h-11 rounded-full flex items-center justify-center shadow-md cursor-pointer"
        >
          <BsStars className="text-[20px] text-black z-10" />
          {showWave && (
            <>
              <span className="absolute w-full h-full rounded-full bg-blue-400/20 animate-ping z-0" />
              <span className="absolute w-14 h-14 rounded-full bg-blue-400/10 animate-ping z-0" />
              <span className="absolute w-16 h-16 rounded-full bg-blue-200/10 animate-ping z-0" />
            </>
          )}
        </div>

        <p className="font-sora text-base text-black">
          <Typewriter
            words={[displayText]}
            loop={1}
            typeSpeed={60}
            deleteSpeed={30}
            delaySpeed={2000}
          />
        </p>
      </div>

      {/* Sheet instead of Dialog */}
      <Sheet open={isOpen} onOpenChange={close}>
        <SheetContent
          side="right"
          className="sm:max-w-sm bg-slate-900 border-none"
        >
          <SheetHeader>
            <SheetTitle>
              {" "}
              <div className={`flex items-center justify-start `}>
                <Image
                  src="/clarioWhite.png"
                  alt="logo"
                  width={60}
                  height={60}
                  className=""
                />
                <h2 className="font-bold -ml-1 font-sora tracking-tight text-2xl text-white">
                  Mentlio
                </h2>
              </div>
            </SheetTitle>
            <SheetDescription>
             AI Assistant at your help anytime and anywhere.
            </SheetDescription>
          </SheetHeader>
          <div className="grid grid-cols-2 gap-4 px-2 mt-5">
            {prompts.map((p) => (
              <button
                key={p}
                type="button"
                onClick={() => setInput(p)}
                className="p-2 rounded-sm bg-blue-200 border-2 border-blue-500 text-black font-sora text-xs tracking-tight text-center hover:bg-blue-200 hover:scale-105 transition-all duration-200 cursor-pointer"
              >
                <p>{p}</p>
              </button>
            ))}
          </div>

          <div className="flex-1 overflow-y-auto px-2 mt-5 space-y-3">
            {messages.length === 0 ? (
              <p className="text-gray-300 text-sm font-inter px-1">
                Ask a career question and Mentlio Coach will answer it using your quiz profile.
              </p>
            ) : (
              messages.map((m, i) => (
                <div
                  key={i}
                  className={`text-sm font-inter rounded-md p-2 whitespace-pre-wrap ${
                    m.role === "user"
                      ? "bg-blue-600 text-white ml-8"
                      : "bg-slate-800 text-gray-100 mr-8 border border-slate-700"
                  }`}
                >
                  {m.text || (sending ? "Thinking…" : "")}
                </div>
              ))
            )}
            {sending && messages[messages.length - 1]?.role === "user" && (
              <div className="text-sm font-inter rounded-md p-2 bg-slate-800 text-gray-300 mr-8 border border-slate-700">
                Thinking…
              </div>
            )}
            {error && (
              <p className="text-xs font-inter text-red-300 px-1">{error}</p>
            )}
          </div>

               <SheetFooter className="shrink-0">
          <div className="w-full">
            <Label className="text-white font-inter text-sm tracking-tight font-medium mt-2 mb-2">
              Send a message
            </Label>
            <div className="relative">
              <Textarea
                placeholder="Write a message"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    sendMessage();
                  }
                }}
                className="bg-black text-gray-200 font-inter text-sm tracking-tight font-medium mt-2 mb-2 h-28 resize-none"
              />
              <Button
                className="absolute right-2 bottom-2 bg-gray-600 cursor-pointer"
                onClick={sendMessage}
                disabled={sending || !input.trim()}
                aria-label="Send message"
              >
                <LuSend className="text-white" size={10} />
              </Button>
            </div>
          </div>
        </SheetFooter>
        </SheetContent>
      
      </Sheet>
    </>
  );
}
