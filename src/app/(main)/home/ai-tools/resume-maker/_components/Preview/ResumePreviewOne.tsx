// components/resume/Preview/ResumePreview.tsx
"use client";

import { useResumeStore } from "@/lib/store/useResumeStore";
import TemplateOne from "./templates/TemplateOne";
import { useSidebar } from "@/components/ui/sidebar";
import { AirplayIcon } from "lucide-react";
import { GrResume } from "react-icons/gr";
import { LuActivity, LuBadgeCheck, LuChevronRight, LuCircleFadingPlus, LuDownload, LuFileBadge } from "react-icons/lu";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

export function ResumePreview() {
  const resume = useResumeStore((s) => s.resume);
  const { open: sidebarOpen, isMobile } = useSidebar();

  const handleDownload = () => {
    window.print();
  };

  return (
    <div className="">
      <h1 className="text-center font-inter text-3xl font-semibold">
        Live Resume Preview <LuFileBadge  className="w-7 h-7 inline-block ml-2" />
      </h1>
      <div className="flex items-center justify-evenly mt-6">
        <Button
          variant="outline"
          className="bg-gradient-to-br from-indigo-300 to-blue-400 text-white py-[6px] px-3 rounded-lg font-inter text-sm tracking-tight border-0"
          onClick={() =>
            toast.info(
              "AI resume enhancement isn't available yet. Build your resume in the editor and download it."
            )
          }
        >
          Enhance Resume
          <LuBadgeCheck className="w-5 h-5 inline-block ml-2" />
        </Button>

        <Button className="font-inter text-sm" variant="outline" onClick={handleDownload}>
          Download <LuDownload className="w-6 h-6 inline-block ml-2" />
        </Button>
      </div>

      <div
        id="resume-print-area"
        className={`mx-auto  bg-white w-[794px] h-[1123px] ${
          sidebarOpen ? "scale-75 -mt-20" : "scale-75 -mt-20"
        } shadow-lg rounded p-8`}
      >
        <TemplateOne resume={resume} />
      </div>
    </div>
  );
}
