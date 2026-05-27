"use client";

import React, { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { FeatherCalendar } from "@subframe/core";
import { FeatherDownload } from "@subframe/core";
import { FeatherUserPlus } from "@subframe/core";
import { FeatherUsers } from "@subframe/core";
import { FeatherMapPin } from "@subframe/core";
import { FeatherPlay } from "@subframe/core";
import { FeatherPlus } from "@subframe/core";
import { FeatherArrowRight } from "@subframe/core";
import { MoreHorizontal, ChevronRight } from "lucide-react";
import { IconWithBackground } from "@/ui/components/IconWithBackground";
import { Button } from "@/ui/components/Button";
import { SkeletonCard } from "@/components/ui/SkeletonTable";
import { api, getChapterId } from "@/lib/api";
import { useToast } from "@/components/ToastProvider";
import { useActiveEvent } from "@/hooks/useActiveEvent";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/ui/dropdown-menu";


export default function DashboardPage() {
  const router = useRouter();
  const search = useSearchParams();
  const { toast } = useToast();
  const [chapterId, setChapterId] = useState<string | null>(null);
  const [totalPnms, setTotalPnms] = useState(0);
  const [totalEvents, setTotalEvents] = useState(0);
  const [upcomingEvents, setUpcomingEvents] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [dataLoading, setDataLoading] = useState(true);

  // Use activeEvent hook with chapterId once we have it
  const { activeEvent, loading: eventLoading } = useActiveEvent({ chapterId });

  useEffect(() => {
    if (search?.get("welcome") === "1") {
      toast({
        title: "Welcome to RushRank",
        description: "Invite your team from Settings."
      });
      router.replace("/dashboard");
    }
  }, [search, router, toast]);

  useEffect(() => {
    loadDashboardData();
  }, []);

  const loadDashboardData = async () => {
    try {
      setDataLoading(true);
      setError(null);

      // Get chapter ID (uses cache first)
      const cid = await getChapterId();
      if (!cid) {
        toast({ title: "No chapter found", description: "Please create a chapter first" });
        setDataLoading(false);
        return;
      }
      setChapterId(cid);

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
      setError(errorMessage);
    } finally {
      setDataLoading(false);
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
  const loading = dataLoading;

  // Loading state with skeletons
  if (loading && !chapterId) {
    return (
      <div className="container max-w-none flex h-full w-full flex-col items-start gap-6 bg-default-background px-4 py-6 sm:px-6">
        <div className="flex w-full flex-col items-start gap-1">
          <div className="h-8 w-32 rounded bg-neutral-200 dark:bg-neutral-700 animate-pulse" />
          <div className="h-5 w-64 rounded bg-neutral-200 dark:bg-neutral-700 animate-pulse" />
        </div>
        <div className="w-full grid grid-cols-2 gap-4">
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

      {/* Active Event Panel */}
      <div className="w-full rounded-2xl border border-neutral-border dark:border-neutral-700 bg-white dark:bg-neutral-800 p-5 shadow-sm">
        {activeEvent ? (
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            {/* Left: Event Info */}
            <div className="flex-1 min-w-0">
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground mb-1">
                Active Event
              </p>
              <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100 truncate mb-1">
                {activeEvent.name}
              </h3>
              <p className="text-sm text-slate-500 dark:text-slate-400">
                {activeEvent.location && activeEvent.date
                  ? `${activeEvent.location} • ${new Date(activeEvent.date).toLocaleDateString()}`
                  : activeEvent.location
                  ? activeEvent.location
                  : activeEvent.date
                  ? new Date(activeEvent.date).toLocaleDateString()
                  : null}
              </p>
            </div>
            {/* Right: CTA Button */}
            <div className="flex-shrink-0">
              <Button
                onClick={() => router.push("/rush")}
                variant="brand-primary"
                iconRight={<ChevronRight className="h-4 w-4" />}
                className="rounded-xl px-4 py-2 font-semibold"
              >
                Open Rush Mode
              </Button>
            </div>
          </div>
        ) : (
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            {/* Left: No Event Message */}
            <div className="flex-1 min-w-0">
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground mb-1">
                Active Event
              </p>
              <p className="text-sm text-slate-500 dark:text-slate-400">
                No active event selected
              </p>
            </div>
            {/* Right: CTA Button */}
            <div className="flex-shrink-0">
              <Button
                onClick={() => router.push("/rush")}
                variant="brand-primary"
                iconRight={<ChevronRight className="h-4 w-4" />}
                className="rounded-xl px-4 py-2 font-semibold"
              >
                Open Rush Mode
              </Button>
            </div>
          </div>
        )}
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

      {/* Stats Grid - 2-column layout with clickable cards */}
      <div className="w-full grid grid-cols-2 gap-3">
        <button
          onClick={() => router.push("/pnms")}
          className="flex flex-col items-start gap-2 rounded-xl border border-neutral-border dark:border-neutral-700 bg-white dark:bg-neutral-800 p-4 sm:p-5 shadow-sm min-h-[100px] transition-all cursor-pointer hover:shadow-md hover:border-brand-200 dark:hover:border-brand-700 active:scale-[0.98] touch-manipulation"
        >
          <div className="flex items-center gap-2">
            <IconWithBackground size="small" variant="neutral" icon={<FeatherUsers />} />
            <span className="text-caption-bold font-caption-bold text-subtext-color">
              Total PNMs
            </span>
          </div>
          <span className="text-heading-1 font-heading-1 text-default-font">
            {totalPnms}
          </span>
        </button>

        <button
          onClick={() => router.push("/events")}
          className="flex flex-col items-start gap-2 rounded-xl border border-neutral-border dark:border-neutral-700 bg-white dark:bg-neutral-800 p-4 sm:p-5 shadow-sm min-h-[100px] transition-all cursor-pointer hover:shadow-md hover:border-brand-200 dark:hover:border-brand-700 active:scale-[0.98] touch-manipulation"
        >
          <div className="flex items-center gap-2">
            <IconWithBackground size="small" variant="success" icon={<FeatherCalendar />} />
            <span className="text-caption-bold font-caption-bold text-subtext-color">
              Total Events
            </span>
          </div>
          <span className="text-heading-1 font-heading-1 text-default-font">
            {totalEvents}
          </span>
        </button>

        <button
          onClick={() => router.push("/events")}
          className="flex flex-col items-start gap-2 rounded-xl border border-neutral-border dark:border-neutral-700 bg-white dark:bg-neutral-800 p-4 sm:p-5 shadow-sm min-h-[100px] transition-all cursor-pointer hover:shadow-md hover:border-brand-200 dark:hover:border-brand-700 active:scale-[0.98] touch-manipulation col-span-2"
        >
          <div className="flex items-center gap-2">
            <IconWithBackground size="small" variant="warning" icon={<FeatherMapPin />} />
            <span className="text-caption-bold font-caption-bold text-subtext-color">
              Upcoming Events
            </span>
          </div>
          <span className="text-heading-1 font-heading-1 text-default-font">
            {upcomingEvents}
          </span>
        </button>
      </div>

      {/* Quick Actions - Mobile simplified, desktop full grid */}
      <div className="flex w-full flex-col items-start gap-3">
        <div className="flex flex-col items-start gap-0.5">
          <h2 className="text-heading-3 font-heading-3 text-default-font">
            Quick Actions
          </h2>
          <p className="text-caption font-caption text-subtext-color">
            Common tasks and shortcuts
          </p>
        </div>
        
        {/* Mobile: 2 large buttons + More dropdown */}
        <div className="w-full grid grid-cols-3 gap-3 md:hidden">
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
            onClick={() => router.push("/rush")}
            className="flex flex-col items-center justify-center gap-2 rounded-xl border-2 border-brand-200 dark:border-brand-700 bg-brand-50 dark:bg-brand-900/20 p-4 transition-all cursor-pointer hover:bg-brand-100 dark:hover:bg-brand-900/40 hover:shadow-md active:scale-[0.98] touch-manipulation"
          >
            <div className="flex h-11 w-11 flex-none items-center justify-center rounded-xl bg-brand-100 dark:bg-brand-800">
              <FeatherPlay className="h-5 w-5 text-brand-600 dark:text-brand-400" />
            </div>
            <span className="text-body-bold font-body-bold text-brand-700 dark:text-brand-300 text-center">
              Open Rush Mode
            </span>
          </button>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="flex flex-col items-center justify-center gap-2 rounded-xl border border-neutral-border dark:border-neutral-700 bg-white dark:bg-neutral-800 p-4 transition-all cursor-pointer hover:shadow-md active:scale-[0.98] touch-manipulation">
                <div className="flex h-11 w-11 flex-none items-center justify-center rounded-xl bg-neutral-100 dark:bg-neutral-700">
                  <MoreHorizontal className="h-5 w-5 text-neutral-600 dark:text-neutral-300" />
                </div>
                <span className="text-body-bold font-body-bold text-default-font text-center">
                  More
                </span>
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48">
              <DropdownMenuItem onClick={() => handleQuickAction("new-event")}>
                <FeatherCalendar className="h-4 w-4 mr-2" />
                New Event
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => handleQuickAction("all-pnms")}>
                <FeatherUsers className="h-4 w-4 mr-2" />
                All PNMs
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => handleQuickAction("export")}>
                <FeatherDownload className="h-4 w-4 mr-2" />
                Export
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        {/* Desktop: Full grid */}
        <div className="w-full hidden md:grid grid-cols-2 lg:grid-cols-4 gap-3">
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
