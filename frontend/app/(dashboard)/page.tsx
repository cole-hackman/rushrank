"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { FeatherCalendar } from "@subframe/core";
import { FeatherDownload } from "@subframe/core";
import { FeatherUserPlus } from "@subframe/core";
import { FeatherUsers } from "@subframe/core";
import { FeatherMapPin } from "@subframe/core";
import { IconWithBackground } from "@/ui/components/IconWithBackground";
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

  useEffect(() => {
    loadDashboardData();
  }, []);

  const loadDashboardData = async () => {
    try {
      setLoading(true);

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
        if (errorMsg.includes("timed out") || errorMsg.includes("timeout")) {
          toast({
            title: "Backend server not responding",
            description: "Please make sure the backend server is running on port 8000"
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

  if (loading) {
    return (
      <div className="container max-w-none flex h-full w-full flex-col items-center justify-center gap-6 bg-default-background py-6">
        <p className="text-body font-body text-subtext-color">Loading dashboard...</p>
        <p className="text-caption font-caption text-subtext-color">
          If this takes too long, check if the backend server is running
        </p>
      </div>
    );
  }

  return (
    <div className="container max-w-none flex h-full w-full flex-col items-start gap-6 bg-default-background px-4 py-6 sm:px-6">
      {/* Header */}
      <div className="flex w-full flex-col items-start gap-1">
        <h1 className="text-heading-1 font-heading-1 text-default-font">
          Dashboard
        </h1>
        <p className="text-body font-body text-subtext-color">
          Overview of your chapter's rush activities
        </p>
      </div>

      {/* Stats Grid - Mobile First */}
      <div className="w-full grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        <div className="flex flex-col items-start gap-3 rounded-xl border border-neutral-border bg-white p-5 shadow-sm">
          <div className="flex items-center gap-2.5">
            <IconWithBackground size="medium" variant="neutral" icon={<FeatherUsers />} />
            <span className="text-caption-bold font-caption-bold text-subtext-color">
              Total PNMs
            </span>
          </div>
          <span className="text-heading-1 font-heading-1 text-default-font">
            {totalPnms}
          </span>
        </div>

        <div className="flex flex-col items-start gap-3 rounded-xl border border-neutral-border bg-white p-5 shadow-sm">
          <div className="flex items-center gap-2.5">
            <IconWithBackground size="medium" variant="success" icon={<FeatherCalendar />} />
            <span className="text-caption-bold font-caption-bold text-subtext-color">
              Total Events
            </span>
          </div>
          <span className="text-heading-1 font-heading-1 text-default-font">
            {totalEvents}
          </span>
        </div>

        <div className="flex flex-col items-start gap-3 rounded-xl border border-neutral-border bg-white p-5 shadow-sm sm:col-span-2 lg:col-span-1">
          <div className="flex items-center gap-2.5">
            <IconWithBackground size="medium" variant="warning" icon={<FeatherMapPin />} />
            <span className="text-caption-bold font-caption-bold text-subtext-color">
              Upcoming Events
            </span>
          </div>
          <span className="text-heading-1 font-heading-1 text-default-font">
            {upcomingEvents}
          </span>
        </div>
      </div>

      {/* Quick Actions - Mobile Optimized */}
      <div className="flex w-full flex-col items-start gap-4">
        <div className="flex flex-col items-start gap-1">
          <h2 className="text-heading-2 font-heading-2 text-default-font">
            Quick Actions
          </h2>
          <p className="text-body font-body text-subtext-color">
            Common tasks and shortcuts
          </p>
        </div>
        <div className="w-full grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <button
            onClick={() => handleQuickAction("add-pnm")}
            className="flex flex-col items-center justify-center gap-3 rounded-xl border border-neutral-border bg-white p-6 transition-all cursor-pointer hover:shadow-md active:scale-[0.98] touch-manipulation"
          >
            <div className="flex h-14 w-14 flex-none items-center justify-center rounded-xl bg-brand-100">
              <FeatherUserPlus className="h-6 w-6 text-brand-600" />
            </div>
            <span className="text-body-bold font-body-bold text-default-font text-center">
              Add PNM
            </span>
          </button>

          <button
            onClick={() => handleQuickAction("new-event")}
            className="flex flex-col items-center justify-center gap-3 rounded-xl border border-neutral-border bg-white p-6 transition-all cursor-pointer hover:shadow-md active:scale-[0.98] touch-manipulation"
          >
            <div className="flex h-14 w-14 flex-none items-center justify-center rounded-xl bg-orange-100">
              <FeatherCalendar className="h-6 w-6 text-orange-600" />
            </div>
            <span className="text-body-bold font-body-bold text-default-font text-center">
              New Event
            </span>
          </button>

          <button
            onClick={() => handleQuickAction("all-pnms")}
            className="flex flex-col items-center justify-center gap-3 rounded-xl border border-neutral-border bg-white p-6 transition-all cursor-pointer hover:shadow-md active:scale-[0.98] touch-manipulation"
          >
            <div className="flex h-14 w-14 flex-none items-center justify-center rounded-xl bg-neutral-100">
              <FeatherUsers className="h-6 w-6 text-neutral-600" />
            </div>
            <span className="text-body-bold font-body-bold text-default-font text-center">
              All PNMs
            </span>
          </button>

          <button
            onClick={() => handleQuickAction("export")}
            className="flex flex-col items-center justify-center gap-3 rounded-xl border border-neutral-border bg-white p-6 transition-all cursor-pointer hover:shadow-md active:scale-[0.98] touch-manipulation"
          >
            <div className="flex h-14 w-14 flex-none items-center justify-center rounded-xl bg-neutral-100">
              <FeatherDownload className="h-6 w-6 text-neutral-600" />
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
