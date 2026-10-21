"use client";
import { useRouter } from "next/navigation";
import { Brain, Map, FileText, Mic, Compass, ArrowRight, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";

const aiTools = [
  {
    id: "career-coach",
    title: "AI Career Coach",
    description: "Get personalised career guidance powered by AI. Ask questions, explore career paths, and get actionable advice.",
    icon: Brain,
    href: "/home/ai-tools/career-coach",
    color: "from-blue-500 to-indigo-600",
    badge: null,
  },
  {
    id: "roadmap-maker",
    title: "AI Roadmap Maker",
    description: "Create a custom learning roadmap for your career goals. Chart your journey with a clear, personalised path.",
    icon: Map,
    href: "/home/ai-tools/roadmap-maker",
    color: "from-purple-500 to-pink-600",
    badge: null,
  },
  {
    id: "job-tracker",
    title: "AI Job Tracker",
    description: "Track all your job applications in one place. Get AI-powered insights on your application status.",
    icon: Compass,
    href: "/home/job-tracker",
    color: "from-orange-500 to-red-500",
    badge: null,
  },
  {
    id: "resume-maker",
    title: "AI Resume Maker",
    description: "Generate a professional, ATS-optimised resume tailored to your experience and target role.",
    icon: FileText,
    href: "/home/ai-tools/resume-maker",
    color: "from-green-500 to-teal-600",
    badge: "Pro",
  },
  {
    id: "interview-prep",
    title: "AI Interview Prep",
    description: "Practice with an AI interviewer, get real-time feedback, and build confidence before your big day.",
    icon: Mic,
    href: "/home/interview-prep",
    color: "from-yellow-500 to-amber-600",
    badge: "Pro",
  },
];

export default function AIToolsPage() {
  const router = useRouter();

  return (
    <div className="min-h-full bg-gray-50 py-8 px-6">
      {/* Header */}
      <div className="mb-10">
        <div className="inline-flex items-center gap-2 bg-blue-50 border border-blue-200 rounded-full px-4 py-1.5 mb-4">
          <Sparkles className="w-4 h-4 text-blue-500" />
          <span className="text-sm font-medium text-blue-600 font-inter">AI-Powered Tools</span>
        </div>
        <h1 className="text-4xl font-bold font-sora tracking-tight text-gray-900 mb-2">
          Your AI Toolkit
        </h1>
        <p className="text-gray-500 font-inter text-lg max-w-lg">
          Accelerate your career with intelligent tools designed to guide, plan, and prepare you for success.
        </p>
      </div>

      {/* Tools Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 max-w-5xl">
        {aiTools.map((tool) => {
          const Icon = tool.icon;
          return (
            <div
              key={tool.id}
              onClick={() => router.push(tool.href)}
              className="group bg-white rounded-2xl border border-gray-200 shadow-sm hover:shadow-lg cursor-pointer transition-all duration-300 hover:-translate-y-1 overflow-hidden"
            >
              {/* Icon banner */}
              <div className={`h-28 bg-gradient-to-br ${tool.color} relative flex items-center justify-center`}>
                <Icon className="w-12 h-12 text-white/90" />
                {tool.badge && (
                  <span className="absolute top-3 right-3 bg-white/20 backdrop-blur-sm text-white text-xs font-medium px-2.5 py-1 rounded-full font-inter border border-white/30">
                    {tool.badge}
                  </span>
                )}
              </div>

              {/* Content */}
              <div className="p-5">
                <h3 className="font-semibold text-lg font-sora text-gray-900 mb-2 group-hover:text-blue-600 transition-colors">
                  {tool.title}
                </h3>
                <p className="text-sm text-gray-500 font-inter leading-relaxed mb-4">
                  {tool.description}
                </p>
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full font-inter group-hover:bg-blue-50 group-hover:border-blue-300 group-hover:text-blue-600 transition-colors"
                >
                  Open Tool <ArrowRight className="ml-2 w-4 h-4" />
                </Button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
