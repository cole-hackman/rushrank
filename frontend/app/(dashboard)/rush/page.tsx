// PLAN (RUSH tab):
// 1) Create /rush route with two big actions: Add PNM, Check In (mobile-first).
// 2) Reuse existing PNM intake form for Add PNM, with a "hand to PNM" flow.
// 3) Implement Check In with two modes: Scan QR and Manual List, wired to attendance endpoints.
// 4) Keep backend contracts and DB schema unchanged.

"use client";
import { useState } from "react";
import { UserPlus, CheckCircle2 } from "lucide-react";
import { AddPnmView } from "@/components/rush/AddPnmView";
import { CheckInView } from "@/components/rush/CheckInView";
import { cn } from "@/lib/utils";

type View = "home" | "add-pnm" | "check-in";

export default function RushPage() {
  const [currentView, setCurrentView] = useState<View>("home");

  if (currentView === "add-pnm") {
    return <AddPnmView onBack={() => setCurrentView("home")} />;
  }

  if (currentView === "check-in") {
    return <CheckInView onBack={() => setCurrentView("home")} />;
  }

  return (
    <div className="container max-w-none flex h-full w-full flex-col items-start gap-6 bg-default-background py-6">
      <div className="flex w-full flex-col items-start gap-1">
        <span className="text-heading-1 font-heading-1 text-default-font">
          RUSH
        </span>
        <span className="text-body font-body text-subtext-color">
          Use this screen during rush events to quickly add PNMs and check them in.
        </span>
      </div>

      <div className="flex flex-col gap-4 w-full md:grid md:grid-cols-2 md:max-w-3xl md:mx-auto">
        <button
          onClick={() => setCurrentView("add-pnm")}
          className={cn(
            "flex flex-col items-center justify-center gap-4 p-8 rounded-xl border-2 border-beta-gray/30",
            "bg-white dark:bg-black hover:bg-beta-navy/5 hover:border-beta-navy/50",
            "transition-all shadow-sm hover:shadow-md",
            "min-h-[200px] md:min-h-[240px]",
            "focus:outline-none focus:ring-2 focus:ring-beta-navy focus:ring-offset-2"
          )}
        >
          <div className="w-16 h-16 rounded-full bg-beta-navy/10 flex items-center justify-center">
            <UserPlus className="h-8 w-8 text-beta-navy" />
          </div>
          <div className="text-center">
            <h3 className="text-xl font-semibold text-beta-navy dark:text-neutral-200 mb-2">
              Add PNM
            </h3>
            <p className="text-sm text-beta-gray">
              Hand the phone to the PNM to fill out their information
            </p>
          </div>
        </button>

        <button
          onClick={() => setCurrentView("check-in")}
          className={cn(
            "flex flex-col items-center justify-center gap-4 p-8 rounded-xl border-2 border-beta-gray/30",
            "bg-white dark:bg-black hover:bg-beta-navy/5 hover:border-beta-navy/50",
            "transition-all shadow-sm hover:shadow-md",
            "min-h-[200px] md:min-h-[240px]",
            "focus:outline-none focus:ring-2 focus:ring-beta-navy focus:ring-offset-2"
          )}
        >
          <div className="w-16 h-16 rounded-full bg-beta-navy/10 flex items-center justify-center">
            <CheckCircle2 className="h-8 w-8 text-beta-navy" />
          </div>
          <div className="text-center">
            <h3 className="text-xl font-semibold text-beta-navy dark:text-neutral-200 mb-2">
              Check In
            </h3>
            <p className="text-sm text-beta-gray">
              Scan QR code or select from list
            </p>
          </div>
        </button>
      </div>
    </div>
  );
}

