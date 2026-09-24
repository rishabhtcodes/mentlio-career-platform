/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import Image from "next/image";
import { MarqueeDemo } from "./_components/MarqueeLogin";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { useRef, useState } from "react";
import { LuChevronRight, LuInfo, LuLoader } from "react-icons/lu";
import { AnimatedGradientTextDemo } from "./_components/GerdaientText";
// import Silk from "@/components/Silk/Silk";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import HCaptcha from "@hcaptcha/react-hcaptcha";
import Link from "next/link";

export default function AuthPage() {
  const captchaRef = useRef<HCaptcha>(null);
  const router = useRouter();
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string>("");

  const [email, setEmail] = useState<string>("");
  const [password, setPassword] = useState<string>("");
  // signup - create account, signin - login
  const [isSignup, setIsSignup] = useState<boolean>(false);
  const supabase = createClient();

  const handleLogin = async (provider: "google" | "discord" | "slack_oidc") => {
    const { error } = await supabase.auth.signInWithOAuth({
      provider,
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
        queryParams: {
          role: "user",
        },
      },
    });

    if (error) {
      console.error("Login error:", error.message);
      toast.error(error.message);
    }
  };

  async function HandleAuth() {
    setLoading(true);
    setError("");
    try {
      if (isSignup) {
        // signup functionality
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: `${window.location.origin}/email-verified`,
            // captchaToken: token || undefined,
            data: { role: "user" },
          },
        });

        if (error) throw error;
        // for email verification
        if (data.user && !data.session) {
          setError("Please check your email for verification link");
          return;
        }
      } else {
        // login functionality
        const { data, error } = await supabase.auth.signInWithPassword({
          email,
          password,
          options: {
            // captchaToken: token || undefined,
          },
        });

        if (error) throw error;
        if (data.session) {
          router.push("/auth/callback");
        }
      }
    } catch (err: any) {
      setError(err.error_description || err.message);
    } finally {
      setLoading(false);
    }
  }
  return (
    <section>
      <main className="flex lg:flex-row gap-10">
        {/* LEFT SIDE */}
        <div className="flex-1">
          <div className="w-full h-full flex flex-col items-center justify-center">
            <div className="flex items-center mb-10 cursor-pointer">
              <Link href="/web">
                <Image
                  src="/clarioBlack.png"
                  alt="logo"
                  width={80}
                  height={80}
                  className=""
                />
              </Link>

              <h1 className="font-raleway text-3xl font-bold">Mentlio</h1>
            </div>
            <div className="flex items-center">
              <hr className="w-[40px]" />
              <p className="text-center mb-6 text-sm font-inter whitespace-nowrap">
                Continue using Mentlio with your favorite provider{" "}
              </p>
              <hr className="w-[40px]" />
            </div>
            <div className="flex flex-col gap-3">
              <Button
                className="font-inter text-sm tracking-wide bg-blue-50 text-black rounded border shadow-sm hover:bg-blue-100 hover:scale-105 hover:border-blue-400 cursor-pointer w-[280px] py-5"
                onClick={() => handleLogin("google")}
              >
                <Image
                  src="/search.png"
                  alt="Google"
                  width={25}
                  height={25}
                  className="mr-5"
                />{" "}
                continue with Google
              </Button>
              <Button
                className="font-inter text-sm tracking-wide bg-blue-50 text-black rounded border shadow-sm  hover:bg-blue-100 hover:scale-105 hover:border-blue-400 cursor-pointer  w-[280px] py-5"
                onClick={() => handleLogin("discord")}
              >
                <Image
                  src="/discord.png"
                  alt="Google"
                  width={25}
                  height={25}
                  className="mr-5"
                />{" "}
                continue with Discord
              </Button>
              <Button
                className="font-inter text-sm tracking-wide bg-blue-50 text-black rounded border shadow-sm  hover:bg-blue-100 hover:scale-105 hover:border-blue-400 cursor-pointer  w-[280px] py-5"
                onClick={() => handleLogin("slack_oidc")}
              >
                <Image
                  src="/slack.png"
                  alt="Google"
                  width={25}
                  height={25}
                  className="mr-5"
                />{" "}
                continue with Slack
              </Button>
            </div>
            {/* ---- */}
            {/* ---- */}
            <div className="flex items-center my-4">
              <hr className="w-[60px] border-border" />
              <p className="text-center px-3 text-xs font-inter text-muted-foreground uppercase tracking-wider">
                Or continue with email
              </p>
              <hr className="w-[60px] border-border" />
            </div>

            <div className="flex flex-col gap-4 w-full max-w-[320px] mx-auto">
              <div className="flex flex-col gap-1.5">
                <Label className="font-inter text-xs text-muted-foreground">Email</Label>
                <Input
                  placeholder="Enter your email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full rounded border px-3 py-2 text-sm"
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label className="font-inter text-xs text-muted-foreground">Password</Label>
                <Input
                  placeholder="Enter your password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full rounded border px-3 py-2 text-sm"
                />
              </div>

              <Button
                className="rounded border font-sora cursor-pointer bg-black text-white hover:bg-neutral-800 w-full py-2.5 mt-1"
                disabled={loading}
                onClick={HandleAuth}
              >
                {loading ? (
                  <>
                    <LuLoader className="animate-spin mr-2" />
                    {isSignup ? "Creating account..." : "Signing in..."}
                  </>
                ) : (
                  <>
                    <span>{isSignup ? "Sign Up" : "Sign In"}</span>
                    <LuChevronRight className="ml-1" />
                  </>
                )}
              </Button>

              <p className="font-inter text-xs font-light text-center">
                {isSignup ? "Already have an account?" : "Don't have an account?"}{" "}
                <span
                  className="font-medium text-blue-500 cursor-pointer hover:underline"
                  onClick={() => setIsSignup(!isSignup)}
                >
                  {isSignup ? "Sign In" : "Sign Up"}
                </span>
              </p>

              <p
                onClick={() => router.push("/auth-mentor")}
                className="text-xs font-medium pt-2 pb-6 text-center text-muted-foreground"
              >
                Are you a Mentor?{" "}
                <span className="text-blue-500 cursor-pointer hover:underline">
                  Click here!
                </span>
              </p>
            </div>

            {error && (
              <p className="font-raleway text-sm text-muted-foreground text-center mt-10">
                <LuInfo className="mr-2 inline" /> {error}
              </p>
            )}
          </div>
        </div>
        {/* RIGHT SIDE */}
        <div className="h-screen w-[55%] bg-blue-700 relative">
          <div
            className="absolute inset-0 z-0"
            style={{
              background: `
        radial-gradient(ellipse 80% 60% at 70% 20%, rgba(90, 70, 200, 0.85), transparent 70%),
        radial-gradient(ellipse 70% 60% at 20% 80%, rgba(40, 120, 220, 0.75), transparent 70%),
        radial-gradient(ellipse 65% 55% at 60% 65%, rgba(0, 180, 255, 0.55), transparent 70%),
        radial-gradient(ellipse 65% 40% at 50% 60%, rgba(180, 60, 200, 0.45), transparent 70%),
        linear-gradient(180deg, #0f172a 0%, #1e293b 100%)
      `,
            }}
          />

          <div className="absolute top-[16%] left-1/2 -translate-x-1/2 -translate-y-1/2">
            <AnimatedGradientTextDemo />
          </div>
          <div className="absolute inset-0 ">
            <Image
              src="/clarioWhite.png"
              alt="Mentlio"
              width={100}
              height={100}
              className="absolute top-[32%] left-1/2 -translate-x-1/2 -translate-y-1/2"
            />
          </div>

          <div className="absolute top-[48%] left-1/2 -translate-x-1/2 -translate-y-1/2 w-full ">
            <h1 className="text-[58px] font-bold text-white/70 font-sora tracking-wide text-center leading-tight">
              “Clarity Today, <br /> <span className="">Success Tomorrow.</span>
              ”
            </h1>
          </div>

          <div className="w-[99%] mx-auto absolute bottom-2">
            <MarqueeDemo />
          </div>
        </div>
      </main>
    </section>
  );
}
