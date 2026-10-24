"use client";

import { useEffect, useState } from "react";
import { useQuizData } from "@/context/userQuizProvider";
import { Button } from "@/components/ui/button";
import { ExternalLink } from "lucide-react";
import YtVideo from "./YtVideo";
import { LuLoader } from "react-icons/lu";
import { Skeleton } from "@/components/ui/skeleton";


type Course = {
  title: string;
  link?: string;
  source?: string;
  redirect_link?: string;
  displayed_link?: string;
  favicon?: string;
  snippet?: string;
};

const demoCourses: Course[] = [
  {
    title: "Introduction to Web Development",
    link: "https://coursera.org/web-dev",
    source: "Coursera",
    displayed_link: "coursera.org",
    favicon:
      "https://serpapi.com/searches/68d83966d1a72bf32a4c37bc/images/36cfec19a0a7c5787c1a138b581fcef39ccbc9414b414c8aa182b07086fc936e.png",
    snippet: "Learn HTML, CSS, and JavaScript to build responsive websites.",
    redirect_link:
      "https://www.coursera.org/learn/html-css-javascript-for-web-developers",
  },
  {
    title: "Full-Stack Developer Bootcamp",
    link: "https://udemy.com/fullstack",
    source: "Udemy",
    displayed_link: "udemy.com",
    snippet:
      "A complete guide to becoming a full-stack web developer with React & Node.js.",
  },
  {
    title: "Data Science with Python",
    link: "https://edx.org/data-science-python",
    source: "edX",
    displayed_link: "edx.org",
    snippet:
      "Master data analysis, visualization, and machine learning with Python.",
  },
  {
    title: "UI/UX Design Specialization",
    link: "https://coursera.org/uiux",
    source: "Coursera",
    displayed_link: "coursera.org",
    snippet:
      "Learn user experience principles and design interactive interfaces.",
  },
  {
    title: "Machine Learning Crash Course",
    link: "https://developers.google.com/machine-learning/crash-course",
    source: "Google Developers",
    displayed_link: "developers.google.com",
    snippet: "Hands-on introduction to machine learning with TensorFlow APIs.",
  },
  {
    title: "Cloud Computing with AWS",
    link: "https://aws.training",
    source: "AWS Training",
    displayed_link: "aws.training",
    snippet:
      "Get started with AWS cloud services and deploy scalable applications.",
  },
  {
    title: "Mobile App Development with Flutter",
    link: "https://udacity.com/flutter",
    source: "Udacity",
    displayed_link: "udacity.com",
    snippet:
      "Learn to build cross-platform mobile apps using Flutter and Dart.",
  },
  {
    title: "Cybersecurity Fundamentals",
    link: "https://nptel.ac.in/courses/cybersecurity",
    source: "NPTEL",
    displayed_link: "nptel.ac.in",
    snippet:
      "Understand the basics of cybersecurity, threats, and ethical hacking.",
  },
];

export default function CareerCourses() {
  const { quizData } = useQuizData();
  const [courses, setCourses] = useState<Course[]>([]);
  const [coursesError, setCoursesError] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!quizData?.selectedCareer) return;

    const fetchCourses = async () => {
      try {
        setLoading(true);
        setCoursesError("");
        const res = await fetch(`/api/courses?q=${quizData.selectedCareer}`);
        const data = await res.json().catch(() => null);
        if (!res.ok) {
          throw new Error(
            (data as any)?.error || "Course search is unavailable right now."
          );
        }
        setCourses(Array.isArray(data) ? data : []);
      } catch (err: any) {
        console.error("❌ Error fetching courses:", err);
        setCoursesError(err?.message || "Could not load courses right now.");
      } finally {
        setLoading(false);
      }
    };

    fetchCourses();
  }, [quizData?.selectedCareer]);

  // ----------------------FAKE DATA FOR DEMO----------------------
  // useEffect(() => {
  //   if (quizData?.selectedCareer) {
  //     setCourses(demoCourses);
  //   }
  // }, [quizData?.selectedCareer]);

  // ===================================================================
  const [activeTab, setActiveTab] = useState<"courses" | "videos">("courses");

  // ================================================================
  // YT VIDEOS

  const [videos, setVideos] = useState<any[]>([]);
  const [videosError, setVideosError] = useState("");
  const [loadingV, setLoadingV] = useState(false);

  useEffect(() => {
    if (!quizData?.selectedCareer) return;

    const fetchVideos = async () => {
      setLoading(true);
      setVideosError("");
      try {
        const searchQuery = encodeURIComponent(quizData.selectedCareer);

        // Server-side proxy: keeps the YouTube API key out of the browser bundle.
        const searchRes = await fetch(
          `/api/youtube/search?q=${searchQuery}&maxResults=30&order=viewCount&details=true`
        );
        const searchData = await searchRes.json();
        if (!searchRes.ok) throw new Error(searchData?.error || "YouTube search failed");

        const detailsData = { items: searchData.items || [] };

        // STEP 3: Filter valid videos
        const filtered = (detailsData.items || [])
          .filter((video: any) => {
            // Handle missing fields gracefully
            if (!video.contentDetails || !video.statistics) return false;

            const durationStr = video.contentDetails.duration;
            const viewsStr = video.statistics.viewCount;
            if (!durationStr || !viewsStr) return false;

            const duration = parseISO8601Duration(durationStr);
            const views = parseInt(viewsStr, 10);

            return duration > 5 && views > 100000; // >5 min, >100k views
          })
          .sort(
            (a: any, b: any) =>
              parseInt(b.statistics.viewCount) -
              parseInt(a.statistics.viewCount)
          )
          .slice(0, 10); //top 10

        setVideos(filtered);
      } catch (err: any) {
        console.error("Error fetching YouTube videos:", err);
        setVideosError(
          err?.message || "Could not load YouTube videos right now."
        );
      } finally {
        setLoadingV(false);
      }
    };

    fetchVideos();
  }, [quizData?.selectedCareer]);

  // Helper: convert ISO 8601 duration to total minutes
  const parseISO8601Duration = (duration: string) => {
    const match = duration.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
    const hours = parseInt(match?.[1] || "0", 10);
    const minutes = parseInt(match?.[2] || "0", 10);
    const seconds = parseInt(match?.[3] || "0", 10);
    return hours * 60 + minutes + seconds / 60; // total minutes
  };

  const formatDuration = (duration: string) => {
    const match = duration.match(/PT(\d+H)?(\d+M)?(\d+S)?/);
    const hours = match?.[1] ? parseInt(match[1]) : 0;
    const minutes = match?.[2] ? parseInt(match[2]) : 0;
    const seconds = match?.[3] ? parseInt(match[3]) : 0;
    const total = hours * 3600 + minutes * 60 + seconds;
    const h = Math.floor(total / 3600);
    const m = Math.floor((total % 3600) / 60);
    const s = total % 60;
    return h > 0
      ? `${h}:${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`
      : `${m}:${s.toString().padStart(2, "0")}`;
  };

  if (loading)
    return (
      <>
        <div className="flex items-center justify-center">
          <div className="flex items-center gap-3">
            <LuLoader className="animate-spin text-4xl text-blue-600" />
            <p className="font-inter text-base tracking-tight ">
              Getting Resources Ready...
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-10 mt-10">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="flex flex-col gap-4">
              <Skeleton className="h-[280px] w-[280px] rounded-lg" />
            </div>
          ))}
        </div>
      </>
    );

  return (
    <div className="max-w-[1300px] mx-auto  px-4">
      {/* ======= Header Text ======= */}
      <h2 className="text-2xl font-semibold text-center mb-6 -mt-3 font-inter">
        {activeTab === "courses"
          ? "Top courses found  for you"
          : "Top rated YouTube videos for you"}
      </h2>

      {/* ======= Toggle Buttons ======= */}
      <div className="flex justify-center gap-10 mb-10">
        <Button
          variant={activeTab === "courses" ? "default" : "outline"}
          onClick={() => setActiveTab("courses")}
          className="font-inter"
        >
          📘 Courses
        </Button>
        <Button
          variant={activeTab === "videos" ? "default" : "outline"}
          onClick={() => setActiveTab("videos")}
          className="font-inter"
        >
          🎥 YouTube Videos
        </Button>
      </div>

      {/* ======= Conditional Display ======= */}
      <div
        key={activeTab}
        className="transition-all duration-300 ease-in-out animate-fadeIn"
      >
        {activeTab === "courses" ? (
          coursesError ? (
            <p className="text-center mt-6 text-muted-foreground">
              {coursesError}
            </p>
          ) : courses.length === 0 ? (
            <p className="text-center mt-6 text-muted-foreground">
              No courses found for {quizData?.selectedCareer}.
            </p>
          ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-10">
            {courses.map((course, idx) => (
              <div
                key={idx}
                className="border rounded-lg p-4 shadow-sm hover:shadow-md transition bg-white h-[300px] flex flex-col"
              >
                <a
                  href={course.link}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-lg font-semibold text-black font-inter text-center hover:underline"
                >
                  {course.title}
                </a>

                {course.snippet && (
                  <p className="text-base line-clamp-3 font-sora text-muted-foreground mt-2">
                    {course.snippet}
                  </p>
                )}

                <div className="flex items-center justify-between gap-10 px-4 mt-4">
                  {course.favicon && (
                    <img
                      src={course.favicon}
                      alt={course.title}
                      className="w-8 h-8 mt-2"
                    />
                  )}

                  {course.source && (
                    <p className="text-sm tracking-tight font-raleway text-blue-600 mt-2">
                      {course.source}
                    </p>
                  )}
                </div>

                <Button
                  className="font-inter text-sm mt-auto w-full"
                  variant="outline"
                >
                  {course.redirect_link && (
                    <a
                      href={course.redirect_link}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      Redirect Link{" "}
                      <ExternalLink className="inline-block ml-2 -mt-1 h-4 w-4" />
                    </a>
                  )}
                </Button>
              </div>
            ))}
          </div>
          )
        ) : (
          // <YtVideo />
          <div className="">
            <h2 className="text-xl font-semibold font-inter mb-5">
              Top YouTube Videos about {quizData?.selectedCareer}
            </h2>

            {loading && <p className="font-inter text-lg my-4">Loading top videos...</p>}
            {!loading && videosError && (
              <p className="text-gray-500">{videosError}</p>
            )}
            {!loading && !videosError && videos.length === 0 && (
              <p className="text-gray-500">No videos match the criteria.</p>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {videos.map((video) => (
                <div key={video.id} className="border rounded-lg p-2 bg-white shadow ">
                  <iframe
                    width="100%"
                    height="200"
                    src={`https://www.youtube.com/embed/${video.id}`}
                    title={video.snippet.title}
                    allowFullScreen
                  ></iframe>

                  <div className="mt-2">
                    <p className="font-semibold text-sm font-inter line-clamp-2">
                      {video.snippet.title}
                    </p>
                    <p className="text-xs text-gray-600 font-inter mt-1">
                      🕒{" "}
                      {new Date(video.snippet.publishedAt).toLocaleDateString()}
                    </p>
                    <p className="text-xs text-gray-600 font-inter">
                      ⏱{" "}
                      {video.contentDetails?.duration
                        ? formatDuration(video.contentDetails.duration)
                        : "N/A"}
                    </p>
                    <p className="text-xs text-gray-500">
                      👁️{" "}
                      {video.statistics?.viewCount
                        ? parseInt(video.statistics.viewCount).toLocaleString()
                        : "N/A"}{" "}
                      views
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
