"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { FeatherCalendar } from "@subframe/core";
import { FeatherDownload } from "@subframe/core";
import { FeatherUserPlus } from "@subframe/core";
import { FeatherUsers } from "@subframe/core";
import { FeatherMapPin } from "@subframe/core";
import { FeatherPlay } from "@subframe/core";
import { FeatherPlus } from "@subframe/core";
import { FeatherArrowRight } from "@subframe/core";
import { IconWithBackground } from "@/ui/components/IconWithBackground";
import { Button } from "@/ui/components/Button";
import { SkeletonCard } from "@/components/ui/SkeletonTable";
import { api } from "@/lib/api";
import { useToast } from "@/components/ToastProvider";


export default function DashboardPage() {
  const router = useRouter();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [chapterId, setChapterId] = useState<string | null>(null);
  const [totalPnms, setTotalPnms] = useState(0);
  const [totalEvents, setTotalEvents] = useState(0);
  const [upcomingEvents, setUpcomingEvents] = useState(0);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadDashboardData();
  }, []);

  const loadDashboardData = async () => {
    try {
      setLoading(true);
      setError(null);

      // Get chapter
      let cid: string | null = null;
      try {
        const chapters = await api<{ id: string }[]>("/chapters", { timeout: 5000 });
        cid = chapters[0]?.id || null;
        if (!cid) {
          toast({ title: "No chapter found", description: "Please create a chapter first" });
          setLoading(false);
          return;
        }
        setChapterId(cid);
      } catch (e: any) {
        console.error("Failed to load chapters:", e);
        const errorMsg = e?.message || "Unable to fetch chapters";
        setError(errorMsg);
        const isProduction = typeof window !== 'undefined' && window.location.hostname !== 'localhost';

        if (errorMsg.includes("timed out") || errorMsg.includes("timeout")) {
          if (isProduction) {
            toast({
              title: "Backend server not responding",
              description: `Request timed out. Please check if your Render backend service is running and healthy.`
            });
          } else {
            toast({
              title: "Backend server not responding",
              description: "Please make sure the backend server is running on port 8000"
            });
          }
        } else if (errorMsg.includes("Cannot connect to backend") || errorMsg.includes("Failed to fetch")) {
          toast({
            title: "Cannot connect to backend",
            description: errorMsg
          });
        } else if (errorMsg.includes("Authentication failed") || errorMsg.includes("401")) {
          toast({
            title: "Authentication failed",
            description: "Your session may have expired. Please try logging out and back in."
          });
        } else {
          toast({ title: "Failed to load chapter", description: errorMsg });
        }
        setLoading(false);
        return;
      }

      // Load all data in parallel with error handling
      let pnmsData: any[] = [];
      let eventsData: any[] = [];

      try {
        [pnmsData, eventsData] = await Promise.all([
          api<any[]>(`/pnms?chapter_id=${cid}`).catch(() => []),
          api<any[]>(`/events?chapter_id=${cid}`).catch(() => []),
        ]);
      } catch (e: any) {
        console.error("Failed to load dashboard data:", e);
        toast({ title: "Failed to load some data", description: e?.message || "Some data may be incomplete" });
      }

      // Set total PNMs - ensure it's an array
      setTotalPnms(Array.isArray(pnmsData) ? pnmsData.length : 0);

      // Set total events
      setTotalEvents(Array.isArray(eventsData) ? eventsData.length : 0);

      // Calculate upcoming events (events in the future)
      if (Array.isArray(eventsData)) {
        const now = new Date();
        const upcoming = eventsData.filter((e: any) => {
          if (!e.date) return false;
          try {
            return new Date(e.date) >= now;
          } catch {
            return false;
          }
        }).length;
        setUpcomingEvents(upcoming);
      } else {
        setUpcomingEvents(0);
      }
    } catch (e: any) {
      console.error("Failed to load dashboard:", e);
      const errorMessage = e?.message || e?.toString() || "Unknown error occurred";
      toast({ title: "Failed to load dashboard", description: errorMessage });
    } finally {
      setLoading(false);
    }
  };

  const handleQuickAction = (action: string) => {
    switch (action) {
      case "add-pnm":
        router.push("/rush");
        break;
      case "new-event":
        router.push("/events?action=add");
        break;
      case "all-pnms":
        router.push("/pnms");
        break;
      case "export":
        router.push("/exports");
        break;
      default:
        break;
    }
  };

  const isNewChapter = totalPnms === 0 && totalEvents === 0;

  // Loading state with skeletons
  if (loading) {
    return (
      <div className="container max-w-none flex h-full w-full flex-col items-start gap-6 bg-default-background px-4 py-6 sm:px-6">
        <div className="flex w-full flex-col items-start gap-1">
          <div className="h-8 w-32 rounded bg-neutral-200 dark:bg-neutral-700 animate-pulse" />
          <div className="h-5 w-64 rounded bg-neutral-200 dark:bg-neutral-700 animate-pulse" />
        </div>
        <div className="w-full grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          <SkeletonCard />
          <SkeletonCard />
          <SkeletonCard />
        </div>
        <div className="h-6 w-32 rounded bg-neutral-200 dark:bg-neutral-700 animate-pulse" />
        <div className="w-full grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-24 rounded-xl bg-neutral-200 dark:bg-neutral-700 animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="container max-w-none flex h-full w-full flex-col items-start gap-5 bg-default-background px-4 py-6 sm:px-6">
      {/* Header */}
      <div className="flex w-full flex-col items-start gap-1">
        <h1 className="text-heading-1 font-heading-1 text-default-font">
          Dashboard
        </h1>
        <p className="text-body font-body text-subtext-color">
          Overview of your chapter's rush activities
        </p>
      </div>

      {/* Onboarding Panel - Show when counts are 0 */}
      {isNewChapter && !error && (
        <div className="w-full rounded-xl border-2 border-dashed border-brand-300 dark:border-brand-700 bg-brand-50 dark:bg-brand-900/20 p-6">
          <div className="flex flex-col gap-4">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-brand-100 dark:bg-brand-800">
                <FeatherPlay className="h-5 w-5 text-brand-600 dark:text-brand-400" />
              </div>
              <div>
                <h2 className="text-heading-3 font-heading-3 text-default-font">
                  Welcome! Let's get started
                </h2>
                <p className="text-caption text-subtext-color">
                  Follow these steps to set up your first rush event
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {/* Step 1: Create Event */}
              <button
                onClick={() => router.push("/events?action=add")}
                className="flex items-center gap-3 rounded-lg border border-brand-200 dark:border-brand-700 bg-white dark:bg-neutral-800 p-4 text-left transition-all hover:bg-brand-50 dark:hover:bg-brand-900/30 hover:border-brand-300"
              >
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-brand-600 text-white text-sm font-bold">
                  1
                </div>
                <div className="flex-1">
                  <p className="text-body-bold font-body-bold text-default-font">
                    Create Event
                  </p>
                  <p className="text-caption text-subtext-color">
                    Set up your first rush event
                  </p>
                </div>
                <FeatherArrowRight className="h-4 w-4 text-subtext-color" />
              </button>

              {/* Step 2: Add PNMs */}
              <button
                onClick={() => router.push("/rush")}
                className="flex items-center gap-3 rounded-lg border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 p-4 text-left transition-all hover:bg-neutral-50 dark:hover:bg-neutral-700"
              >
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-neutral-300 dark:bg-neutral-600 text-neutral-600 dark:text-neutral-300 text-sm font-bold">
                  2
                </div>
                <div className="flex-1">
                  <p className="text-body-bold font-body-bold text-default-font">
                    Add PNMs
                  </p>
                  <p className="text-caption text-subtext-color">
                    Register potential new members
                  </p>
                </div>
                <FeatherArrowRight className="h-4 w-4 text-subtext-color" />
              </button>

              {/* Step 3: Start Check-in */}
              <button
                onClick={() => router.push("/rush")}
                className="flex items-center gap-3 rounded-lg border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 p-4 text-left transition-all hover:bg-neutral-50 dark:hover:bg-neutral-700"
              >
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-neutral-300 dark:bg-neutral-600 text-neutral-600 dark:text-neutral-300 text-sm font-bold">
                  3
                </div>
                <div className="flex-1">
                  <p className="text-body-bold font-body-bold text-default-font">
                    Start Check-in
                  </p>
                  <p className="text-caption text-subtext-color">
                    Track attendance at events
                  </p>
                </div>
                <FeatherArrowRight className="h-4 w-4 text-subtext-color" />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Stats Grid - Tighter layout */}
      <div className="w-full grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        <div className="flex flex-col items-start gap-2 rounded-xl border border-neutral-border dark:border-neutral-700 bg-white dark:bg-neutral-800 p-4 shadow-sm">
          <div className="flex items-center gap-2">
            <IconWithBackground size="small" variant="neutral" icon={<FeatherUsers />} />
            <span className="text-caption-bold font-caption-bold text-subtext-color">
              Total PNMs
            </span>
          </div>
          <span className="text-heading-2 font-heading-2 text-default-font">
            {totalPnms}
          </span>
        </div>

        <div className="flex flex-col items-start gap-2 rounded-xl border border-neutral-border dark:border-neutral-700 bg-white dark:bg-neutral-800 p-4 shadow-sm">
          <div className="flex items-center gap-2">
            <IconWithBackground size="small" variant="success" icon={<FeatherCalendar />} />
            <span className="text-caption-bold font-caption-bold text-subtext-color">
              Total Events
            </span>
          </div>
          <span className="text-heading-2 font-heading-2 text-default-font">
            {totalEvents}
          </span>
        </div>

        <div className="flex flex-col items-start gap-2 rounded-xl border border-neutral-border dark:border-neutral-700 bg-white dark:bg-neutral-800 p-4 shadow-sm sm:col-span-2 lg:col-span-1">
          <div className="flex items-center gap-2">
            <IconWithBackground size="small" variant="warning" icon={<FeatherMapPin />} />
            <span className="text-caption-bold font-caption-bold text-subtext-color">
              Upcoming Events
            </span>
          </div>
          <span className="text-heading-2 font-heading-2 text-default-font">
            {upcomingEvents}
          </span>
        </div>
      </div>

      {/* Quick Actions - Tighter layout with primary CTA emphasis */}
      <div className="flex w-full flex-col items-start gap-3">
        <div className="flex flex-col items-start gap-0.5">
          <h2 className="text-heading-3 font-heading-3 text-default-font">
            Quick Actions
          </h2>
          <p className="text-caption font-caption text-subtext-color">
            Common tasks and shortcuts
          </p>
        </div>
        <div className="w-full grid grid-cols-2 lg:grid-cols-4 gap-3">
          {/* Primary CTA: Add PNM */}
          <button
            onClick={() => handleQuickAction("add-pnm")}
            className="flex flex-col items-center justify-center gap-2 rounded-xl border-2 border-brand-200 dark:border-brand-700 bg-brand-50 dark:bg-brand-900/20 p-4 transition-all cursor-pointer hover:bg-brand-100 dark:hover:bg-brand-900/40 hover:shadow-md active:scale-[0.98] touch-manipulation"
          >
            <div className="flex h-11 w-11 flex-none items-center justify-center rounded-xl bg-brand-100 dark:bg-brand-800">
              <FeatherUserPlus className="h-5 w-5 text-brand-600 dark:text-brand-400" />
            </div>
            <span className="text-body-bold font-body-bold text-brand-700 dark:text-brand-300 text-center">
              Add PNM
            </span>
          </button>

          <button
            onClick={() => handleQuickAction("new-event")}
            className="flex flex-col items-center justify-center gap-2 rounded-xl border border-neutral-border dark:border-neutral-700 bg-white dark:bg-neutral-800 p-4 transition-all cursor-pointer hover:shadow-md active:scale-[0.98] touch-manipulation"
          >
            <div className="flex h-11 w-11 flex-none items-center justify-center rounded-xl bg-orange-100 dark:bg-orange-900/40">
              <FeatherCalendar className="h-5 w-5 text-orange-600 dark:text-orange-400" />
            </div>
            <span className="text-body-bold font-body-bold text-default-font text-center">
              New Event
            </span>
          </button>

          <button
            onClick={() => handleQuickAction("all-pnms")}
            className="flex flex-col items-center justify-center gap-2 rounded-xl border border-neutral-border dark:border-neutral-700 bg-white dark:bg-neutral-800 p-4 transition-all cursor-pointer hover:shadow-md active:scale-[0.98] touch-manipulation"
          >
            <div className="flex h-11 w-11 flex-none items-center justify-center rounded-xl bg-neutral-100 dark:bg-neutral-700">
              <FeatherUsers className="h-5 w-5 text-neutral-600 dark:text-neutral-300" />
            </div>
            <span className="text-body-bold font-body-bold text-default-font text-center">
              All PNMs
            </span>
          </button>

          <button
            onClick={() => handleQuickAction("export")}
            className="flex flex-col items-center justify-center gap-2 rounded-xl border border-neutral-border dark:border-neutral-700 bg-white dark:bg-neutral-800 p-4 transition-all cursor-pointer hover:shadow-md active:scale-[0.98] touch-manipulation"
          >
            <div className="flex h-11 w-11 flex-none items-center justify-center rounded-xl bg-neutral-100 dark:bg-neutral-700">
              <FeatherDownload className="h-5 w-5 text-neutral-600 dark:text-neutral-300" />
            </div>
            <span className="text-body-bold font-body-bold text-default-font text-center">
              Export
            </span>
          </button>
        </div>
      </div>
    </div>
  );
}
