"use client";
import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { useToast } from "@/components/ToastProvider";
import Link from "next/link";
import { Users, Vote, Calendar, TrendingUp, UserPlus, CheckSquare, CalendarPlus, BarChart3, Download, FileText } from "lucide-react";
import { cn } from "@/lib/utils";
import { IconButton } from "@/components/subframe/IconButton";

type Stats = {
  total_pnms: number;
  active_rounds: number;
  upcoming_events: number;
  total_votes: number;
};

export default function DashboardPage() {
  const { toast } = useToast();
  const [stats, setStats] = useState<Stats>({
    total_pnms: 0,
    active_rounds: 0,
    upcoming_events: 0,
    total_votes: 0,
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const chapters = await api<{ id: string }[]>("/chapters");
        const cid = chapters[0]?.id;
        
        if (cid) {
          const pnms = await api<any[]>(`/pnms?chapter_id=${cid}`);
          const rounds = await api<any[]>(`/rounds?chapter_id=${cid}`);
          const events = await api<any[]>(`/events?chapter_id=${cid}`);
          
          const activeRounds = rounds.filter((r) => r.status === "ACTIVE").length;
          const upcomingEvents = events.filter((e) => e.is_active).length;
          
          setStats({
            total_pnms: pnms.length,
            active_rounds: activeRounds,
            upcoming_events: upcomingEvents,
            total_votes: 0, // TODO: aggregate from rounds
          });
        }
      } catch (e: any) {
        toast({ title: "Failed to load dashboard", description: e.message });
      } finally {
        setLoading(false);
      }
    })();
  }, [toast]);

  const cards = [
    {
      title: "Total PNMs",
      value: stats.total_pnms,
      icon: Users,
      color: "blue",
      href: "/pnms",
    },
    {
      title: "Active Rounds",
      value: stats.active_rounds,
      icon: Vote,
      color: "green",
      href: "/voting",
    },
    {
      title: "Upcoming Events",
      value: stats.upcoming_events,
      icon: Calendar,
      color: "purple",
      href: "/events",
    },
    {
      title: "Total Votes",
      value: stats.total_votes,
      icon: TrendingUp,
      color: "orange",
      href: "/results",
    },
  ];

  const colorClasses = {
    blue: "bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400",
    green: "bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400",
    purple: "bg-purple-100 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400",
    orange: "bg-orange-100 dark:bg-orange-900/30 text-orange-600 dark:text-orange-400",
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <p className="text-neutral-500">Loading...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-beta-navy dark:text-white">Dashboard</h1>
        <p className="text-muted-foreground mt-1">
          Overview of your chapter's rush activities
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {cards.map((card) => {
          const Icon = card.icon;
          return (
            <Link
              key={card.title}
              href={card.href as any}
              className="block group"
            >
              <div className="rounded-2xl bg-white dark:bg-neutral-900 border border-beta-gray/30 dark:border-neutral-800 p-6 hover:shadow-lg hover:border-beta-navy/30 transition-all hover:scale-105">
                <div className="flex items-center justify-between mb-4">
                  <div
                    className={cn(
                      "w-12 h-12 rounded-xl flex items-center justify-center",
                      colorClasses[card.color as keyof typeof colorClasses]
                    )}
                  >
                    <Icon className="w-6 h-6" />
                  </div>
                </div>
                <div className="text-3xl font-bold text-beta-navy dark:text-white mb-1">
                  {card.value}
                </div>
                <div className="text-sm text-muted-foreground">
                  {card.title}
                </div>
              </div>
            </Link>
          );
        })}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="rounded-xl bg-white dark:bg-neutral-900 border border-beta-gray/30 dark:border-neutral-800 p-6">
          <h2 className="text-xl font-semibold text-beta-navy dark:text-white mb-6">
            Quick Actions
          </h2>
          <div className="grid grid-cols-3 gap-4">
            <Link href="/intake" className="flex flex-col items-center gap-3 p-4 rounded-lg hover:bg-beta-navy/5 dark:hover:bg-neutral-800 transition-all group">
              <div className="w-14 h-14 rounded-xl bg-beta-navy/10 dark:bg-beta-navy/20 flex items-center justify-center group-hover:bg-beta-navy group-hover:scale-110 transition-all">
                <UserPlus className="w-7 h-7 text-beta-navy dark:text-blue-300 group-hover:text-white" />
              </div>
              <span className="text-sm font-medium text-beta-navy dark:text-white text-center">Add PNM</span>
            </Link>
            
            <Link href="/voting" className="flex flex-col items-center gap-3 p-4 rounded-lg hover:bg-beta-navy/5 dark:hover:bg-neutral-800 transition-all group">
              <div className="w-14 h-14 rounded-xl bg-beta-navy/10 dark:bg-beta-navy/20 flex items-center justify-center group-hover:bg-beta-navy group-hover:scale-110 transition-all">
                <CheckSquare className="w-7 h-7 text-beta-navy dark:text-blue-300 group-hover:text-white" />
              </div>
              <span className="text-sm font-medium text-beta-navy dark:text-white text-center">Vote</span>
            </Link>
            
            <Link href="/events" className="flex flex-col items-center gap-3 p-4 rounded-lg hover:bg-beta-navy/5 dark:hover:bg-neutral-800 transition-all group">
              <div className="w-14 h-14 rounded-xl bg-beta-navy/10 dark:bg-beta-navy/20 flex items-center justify-center group-hover:bg-beta-navy group-hover:scale-110 transition-all">
                <CalendarPlus className="w-7 h-7 text-beta-navy dark:text-blue-300 group-hover:text-white" />
              </div>
              <span className="text-sm font-medium text-beta-navy dark:text-white text-center">New Event</span>
            </Link>
            
            <Link href="/results" className="flex flex-col items-center gap-3 p-4 rounded-lg hover:bg-beta-navy/5 dark:hover:bg-neutral-800 transition-all group">
              <div className="w-14 h-14 rounded-xl bg-beta-navy/10 dark:bg-beta-navy/20 flex items-center justify-center group-hover:bg-beta-navy group-hover:scale-110 transition-all">
                <BarChart3 className="w-7 h-7 text-beta-navy dark:text-blue-300 group-hover:text-white" />
              </div>
              <span className="text-sm font-medium text-beta-navy dark:text-white text-center">Results</span>
            </Link>
            
            <Link href="/pnms" className="flex flex-col items-center gap-3 p-4 rounded-lg hover:bg-beta-navy/5 dark:hover:bg-neutral-800 transition-all group">
              <div className="w-14 h-14 rounded-xl bg-beta-navy/10 dark:bg-beta-navy/20 flex items-center justify-center group-hover:bg-beta-navy group-hover:scale-110 transition-all">
                <Users className="w-7 h-7 text-beta-navy dark:text-blue-300 group-hover:text-white" />
              </div>
              <span className="text-sm font-medium text-beta-navy dark:text-white text-center">All PNMs</span>
            </Link>
            
            <button className="flex flex-col items-center gap-3 p-4 rounded-lg hover:bg-beta-navy/5 dark:hover:bg-neutral-800 transition-all group">
              <div className="w-14 h-14 rounded-xl bg-beta-navy/10 dark:bg-beta-navy/20 flex items-center justify-center group-hover:bg-beta-navy group-hover:scale-110 transition-all">
                <Download className="w-7 h-7 text-beta-navy dark:text-blue-300 group-hover:text-white" />
              </div>
              <span className="text-sm font-medium text-beta-navy dark:text-white text-center">Export</span>
            </button>
          </div>
        </div>

        <div className="rounded-xl bg-white dark:bg-neutral-900 border border-beta-gray/30 dark:border-neutral-800 p-6">
          <h2 className="text-xl font-semibold text-beta-navy dark:text-white mb-4">
            Recent Activity
          </h2>
          <div className="space-y-3 text-sm text-muted-foreground">
            <p>No recent activity to display.</p>
            <p className="text-xs">Activity will appear here as members interact with the system.</p>
          </div>
        </div>
      </div>
    </div>
  );
}

