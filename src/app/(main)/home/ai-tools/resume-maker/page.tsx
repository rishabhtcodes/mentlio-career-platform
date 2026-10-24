"use client";
import ResumeCard from "@/app/(main)/_components/ResumeCard";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import React, { useState } from "react";
import { FaPaperPlane } from "react-icons/fa6";
import { GrResume } from "react-icons/gr";
import {
  LuActivity,
  LuBrain,
  LuChevronRight,
  LuCircleFadingPlus,
  LuPackageOpen,
} from "react-icons/lu";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { useResumeStore } from "@/lib/store/useResumeStore";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

const ResumeMaker = () => {
  // ===============================================
  // ===================SETTING TITLE==================
  const [open, setOpen] = useState(false);
  const [resumeTitle, setResumeTitle] = useState("");

  const setTitle = useResumeStore((state) => state.setTitle);
  const resume = useResumeStore((state) => state.resume);
  const router = useRouter();

  const handleContinue = () => {
    if (!resumeTitle.trim()) return;

    setTitle(resumeTitle);
    setOpen(false);

    router.push("/home/ai-tools/resume-maker/start");
  };

  return (
    <div className="bg-gray-50 w-full h-full p-4 overflow-hidden">
      <ResumeCard />
      <div className="flex mt-4 h-full">
        {/* =====LEFT SIDE==== */}
        <div className="px-4">
          <h1 className="font-inter text-lg font-semibold tracking-tight">
            Make New Resume <FaPaperPlane className="inline ml-2" />
          </h1>
          <Button
            className="font-inter text-sm tracking-tight mt-5 flex items-center justify-center w-full"
            variant="outline"
            onClick={() => setOpen(true)}
          >
            Get Started <LuCircleFadingPlus />
          </Button>

          <h1 className="mt-6 font-inter text-lg font-semibold tracking-tight">
            Generate From AI <LuBrain className="inline ml-2" />
          </h1>

           <Button
            className="font-inter text-sm tracking-tight mt-5 flex items-center justify-center w-full"
            variant="outline"
            onClick={() =>
              toast.info(
                "AI resume generation isn't available yet. Use 'Get Started' to build one in the editor."
              )
            }
          >
            Generate <LuBrain className="ml-1" />
          </Button>
        </div>
        <Separator orientation="vertical" className="mx-4 bg-gray-300" />
        {/* =====RIGHT SIDE==== */}
        <div className="flex flex-1 flex-col h-full">
          <h1 className="font-inter text-lg font-semibold tracking-tight">
            Recent Created Resume <LuActivity className="inline ml-2" />
          </h1>
          {resume.title.trim() ? (
            <div className="mt-5 w-full max-w-md rounded-lg border bg-white p-4">
              <p className="font-inter text-base font-medium truncate">
                {resume.title}
              </p>
              <p className="font-inter text-xs text-gray-500 mt-1">
                {resume.bio.name
                  ? `${resume.bio.name}${resume.bio.email ? ` · ${resume.bio.email}` : ""}`
                  : "Draft — details not filled in yet"}
              </p>
              <Button
                className="mt-3 font-inter text-sm cursor-pointer"
                variant="outline"
                onClick={() =>
                  router.push("/home/ai-tools/resume-maker/start")
                }
              >
                Open <LuChevronRight className="ml-1" />
              </Button>
            </div>
          ) : (
            <p className="mt-5 font-inter text-sm text-gray-500 max-w-md">
              No resumes yet. Create one with "Get Started" — your draft is saved
              in this browser as you type.
            </p>
          )}
        </div>
      </div>

      {/* ===============DIALOG ================ */}
      {/* Dialog */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="w-[400px]">
          <DialogHeader>
            <DialogTitle className="font-inter font-semibold text-xl text-center">
              Give your resume a title
            </DialogTitle>
          </DialogHeader>

          <Input
            placeholder="Ex: Frontend Developer "
            value={resumeTitle}
            onChange={(e) => setResumeTitle(e.target.value)}
            className="font-inter"
          />

          <DialogFooter>
            <Button
              className="w-full mt-4 font-inter text-sm cursor-pointer"
              onClick={handleContinue}
              disabled={!resumeTitle.trim()}
            >
              Continue <LuChevronRight className="ml-2 " />
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default ResumeMaker;
