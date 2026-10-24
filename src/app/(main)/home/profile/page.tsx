"use client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { useUserData } from "@/context/UserDataProvider";
import { useQuizData } from "@/context/userQuizProvider";
import { createClient } from "@/lib/supabase/client";
import { LucideActivity, LucideEdit } from "lucide-react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import React, { useEffect, useState } from "react";
import { LuCopy } from "react-icons/lu";
import { toast } from "sonner";

const UserProfile = () => {
  const { user } = useUserData();
  const { quizData } = useQuizData();
  const router = useRouter();
  const supabase = createClient();
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    userName: "",
    userPhone: "",
    institutionName: "",
    current_status: "",
    mainFocus: "",
  });

  useEffect(() => {
    if (!user) return;
    setForm({
      userName: user.userName || "",
      userPhone: user.userPhone || "",
      institutionName: user.institutionName || "",
      current_status: user.current_status || "",
      mainFocus: user.mainFocus || "",
    });
  }, [user]);

  const setField = (key: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm((prev) => ({ ...prev, [key]: e.target.value }));

  const saveProfile = async () => {
    if (!user?.id) return;
    if (form.userName.trim().length < 2) {
      toast.error("Please enter your name.");
      return;
    }
    setSaving(true);
    try {
      const { error } = await supabase.from("users").update(form).eq("id", user.id);
      if (error) throw error;
      toast.success("Profile updated.");
      setEditing(false);
      router.refresh();
    } catch (err: any) {
      console.error("Profile update failed:", err);
      toast.error(err?.message || "Failed to save profile.");
    } finally {
      setSaving(false);
    }
  };

  const copyInviteLink = async () => {
    if (!user?.invite_link) {
      toast.info("No invite link generated yet.");
      return;
    }
    try {
      await navigator.clipboard.writeText(
        `${window.location.origin}/invite/${user.invite_link}`
      );
      toast.success("Invite link copied.");
    } catch {
      toast.error("Clipboard access was blocked by the browser.");
    }
  };

  return (
    <div className="w-full h-full bg-gray-50 ">
      <div className="bg-gradient-to-br from-indigo-400 to-blue-200 p-4 h-[140px] relative ">
        <Image
          src={user?.avatar || "/user.png"}
          alt="User Avatar"
          width={80}
          height={80}
          className="w-[120px] h-[120px] absolute top-16 left-16 rounded-full"
        />
        <div className="flex items-center gap-12 absolute top-24 left-[260px]">
          {editing ? (
            <>
              <Button
                className="font-inter cursor-pointer"
                onClick={saveProfile}
                disabled={saving}
              >
                {saving ? "Saving..." : "Save Changes"}
              </Button>
              <Button
                className="font-inter cursor-pointer"
                variant="outline"
                onClick={() => setEditing(false)}
                disabled={saving}
              >
                Cancel
              </Button>
            </>
          ) : (
            <Button
              className="font-inter cursor-pointer"
              variant="outline"
              onClick={() => setEditing(true)}
            >
              Edit Profile
              <LucideEdit />
            </Button>
          )}
          {!user?.isPro && (
            <Button
              className="font-sora cursor-pointer"
              variant="outline"
              onClick={() => router.push("/home/settings/billing")}
            >
              Upgrade Now
              <LucideActivity />
            </Button>
          )}
        </div>

        <Image
          src="/design100.png"
          alt="User Avatar"
          width={80}
          height={80}
          className="w-[120px] h-[120px] absolute top-10 right-5 rounded-full opacity-20"
        />
      </div>
      {/* ALL INFO */}
      <div className="mt-16 px-12">
        <h2 className=" text-2xl font-semibold font-inter">
          Personal Information
        </h2>
        <div className="space-y-3 mt-6">
          <div className="flex items-center max-w-[440px] gap-8">
            <Label className="font-sora text-base" htmlFor="email">
              Name
            </Label>
            <Input
              id="name"
              type="text"
              value={form.userName}
              readOnly={!editing}
              onChange={setField("userName")}
              className="bg-white w-full font-raleway"
            />
          </div>
          <div className="flex items-center max-w-[440px] gap-8">
            <Label
              className="font-sora text-base whitespace-nowrap"
              htmlFor="email"
            >
              Email
            </Label>
            <Input
              id="email"
              type="text"
              value={user?.userEmail || ""}
              readOnly
              className="bg-white w-full font-raleway"
            />
          </div>
          <div className="flex items-center max-w-[440px] gap-8">
            <Label
              className="font-sora text-base whitespace-nowrap"
              htmlFor="email"
            >
              Phone No.
            </Label>
            <Input
              id="phone"
              type="text"
              value={form.userPhone}
              readOnly={!editing}
              onChange={setField("userPhone")}
              className="bg-white w-full font-inter"
            />
          </div>
          <div className="flex items-center max-w-[500px] gap-8">
            <Label
              className="font-sora text-base whitespace-nowrap"
              htmlFor="link"
            >
              Invite Link
            </Label>
            <Input
              id="link"
              type="text"
              value={user?.invite_link || "Not Generated"}
              readOnly
              className="bg-white w-full font-inter"
            />
            <LuCopy
              className="cursor-pointer"
              size={26}
              onClick={copyInviteLink}
              role="button"
              aria-label="Copy invite link"
            />
          </div>
        </div>
        <Separator className="my-6 max-w-[700px]" />
        <h2 className=" text-2xl font-semibold font-inter">
          Basic Information
        </h2>
        <div className="space-y-3 mt-6">
          <div className="flex items-center max-w-[600px] gap-8">
            <Label
              className="font-sora text-base whitespace-nowrap"
              htmlFor="institution"
            >
              Institute/College Name
            </Label>
            <Input
              id="institution"
              type="text"
              value={form.institutionName}
              readOnly={!editing}
              onChange={setField("institutionName")}
              className="bg-white w-full font-raleway"
            />
          </div>
          <div className="flex items-center max-w-[450px] gap-8">
            <Label
              className="font-sora text-base whitespace-nowrap"
              htmlFor="occupation"
            >
              Current Occupation
            </Label>
            <Input
              id="occupation"
              type="text"
              value={form.current_status}
              readOnly={!editing}
              onChange={setField("current_status")}
              className="bg-white w-full font-raleway"
            />
          </div>
          <div className="flex items-center max-w-[450px] gap-8">
            <Label
              className="font-sora text-base whitespace-nowrap"
              htmlFor="mainFocus"
            >
              Main Focus
            </Label>
            <Input
              id="mainFocus"
              type="text"
              value={form.mainFocus}
              readOnly={!editing}
              onChange={setField("mainFocus")}
              className="bg-white w-full font-inter"
            />
          </div>
        </div>
        <Separator className="my-6 max-w-[700px]" />
        <h2 className=" text-2xl font-semibold font-inter">
          Other Information
        </h2>
        <div className="space-y-5 mt-6 mb-20">
          <div className="flex items-center max-w-[500px] gap-8">
            <Label
              className="font-sora text-base whitespace-nowrap"
              htmlFor="choosedCareer"
            >
              Chosen Career
            </Label>
            <Input
              id="choosedCareer"
              type="text"
              value={quizData?.selectedCareer || "Not Selected"}
              readOnly
              className="bg-blue-100 border border-blue-300 text-black w-full font-inter"
            />
          </div>
          <div className="flex items-center max-w-[450px] gap-8">
            <Label
              className="font-sora text-base whitespace-nowrap"
              htmlFor="currentStream"
            >
              Current Stream
            </Label>
            <Input
              id="currentStream"
              type="text"
              value={quizData?.quizInfo?.stream || "Not Selected"}
              readOnly
              className="bg-white w-full font-raleway"
            />
          </div>
          <div className="flex  max-w-[450px] gap-5">
            <Label className="font-sora text-base whitespace-nowrap">
              Suggested Degree
            </Label>

            <div className="flex flex-wrap gap-2">
              {quizData?.quizInfo?.degree?.length > 0 ? (
                quizData?.quizInfo.degree.map((deg: string, index: number) => (
                  <span
                    key={index}
                    className="bg-blue-100 text-blue-700 font-inter text-sm px-3 py-1 rounded-full shadow-sm"
                  >
                    {deg}
                  </span>
                ))
              ) : (
                <span className="text-gray-400 font-inter text-sm">
                  No degree selected
                </span>
              )}
            </div>
          </div>

          <div className="flex  gap-4">
            <Label className="font-sora text-base whitespace-nowrap">
              Suggested Career Options
            </Label>

            <div className="flex flex-wrap gap-2">
              {quizData?.quizInfo?.careerOptions?.length > 0 ? (
                quizData?.quizInfo.careerOptions.map(
                  (career: string, index: number) => (
                    <span
                      key={index}
                      className="bg-blue-100 text-blue-600 font-inter text-sm px-3 py-1 rounded-full shadow-sm"
                    >
                      {career}
                    </span>
                  )
                )
              ) : (
                <span className="text-gray-400 font-inter text-sm">
                  No career options found
                </span>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default UserProfile;
