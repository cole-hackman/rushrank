"use client";
/**
 * Comparison Page
 * 
 * Features:
 * - Side-by-side comparison of 2-5 PNMs
 * - Responsive grid layout
 * - Shows key stats, vote breakdown, notes
 * - Export functionality
 */
import { useEffect, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { api, getChapterId } from "@/lib/api";
import { useToast } from "@/components/ToastProvider";
import { Button } from "@/ui/components/Button";
import { PNMComparisonCard } from "@/components/compare/PNMComparisonCard";
import { ArrowLeft, Download } from "lucide-react";
import { cn } from "@/lib/utils";

type PNMDetails = {
  id: string;
  name: string;
  major?: string | null;
  year?: string | null;
  hometown?: string | null;
  photo_url?: string | null;
  tags?: string[];
  attendance_count?: number;
  total_events?: number;
  yes_percentage?: number;
  favorite_count?: number;
  voteBreakdown?: {
    yes: number;
    no: number;
    unknown: number;
  };
  recentNotes?: Array<{
    id: string;
    body: string;
    created_at: string;
  }>;
};

export default function ComparePage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const { toast } = useToast();
  const [pnms, setPnms] = useState<PNMDetails[]>([]);
  const [loading, setLoading] = useState(true);
  const [chapterId, setChapterId] = useState<string | null>(null);

  const idsParam = searchParams.get("ids");
  const pnmIds = idsParam ? idsParam.split(",").filter(Boolean) : [];

  useEffect(() => {
    (async () => {
      try {
        const cid = await getChapterId();
        setChapterId(cid);
      } catch (e: any) {
        toast({ title: "Failed to load chapter", description: e?.message });
      }
    })();
  }, [toast]);

  useEffect(() => {
    if (pnmIds.length === 0) {
      toast({ title: "No PNMs selected", description: "Please select 2-5 PNMs to compare" });
      router.push("/pnms");
      return;
    }

    if (pnmIds.length < 2 || pnmIds.length > 5) {
      toast({
        title: "Invalid selection",
        description: "Please select 2-5 PNMs to compare",
      });
      router.push("/pnms");
      return;
    }

    if (chapterId) {
      loadComparisonData();
    }
  }, [pnmIds, chapterId]);

  const loadComparisonData = async () => {
    if (!chapterId || pnmIds.length === 0) return;

    setLoading(true);
    try {
      // Fetch PNM details in parallel
      const pnmPromises = pnmIds.map(async (id) => {
        try {
          const pnm = await api<any>(`/pnms/${id}`);
          return pnm;
        } catch (e: any) {
          console.error(`Failed to load PNM ${id}:`, e);
          return null;
        }
      });

      const pnmData = await Promise.all(pnmPromises);
      const validPnms = pnmData.filter((p) => p !== null);

      // Fetch additional data for each PNM
      const enrichedPromises = validPnms.map(async (pnm) => {
        try {
          // Fetch notes
          const notes = await api<any[]>(`/pnms/${pnm.id}/notes`).catch(() => []);

          // Fetch vote breakdown (we'll need to get this from rounds/results)
          // For now, we'll use the yes_percentage from the PNM list endpoint
          const allPnms = await api<any[]>(`/pnms?chapter_id=${chapterId}`).catch(() => []);
          const pnmWithStats = allPnms.find((p) => p.id === pnm.id);

          return {
            ...pnm,
            attendance_count: pnmWithStats?.attendance_count || 0,
            total_events: pnmWithStats?.total_events || 0,
            yes_percentage: pnmWithStats?.yes_percentage || 0,
            favorite_count: pnmWithStats?.favorite_count || 0,
            recentNotes: notes.slice(0, 2).map((n) => ({
              id: n.id,
              body: n.body,
              created_at: n.created_at,
            })),
          };
        } catch (e) {
          console.error(`Failed to enrich PNM ${pnm.id}:`, e);
          return {
            ...pnm,
            attendance_count: 0,
            total_events: 0,
            yes_percentage: 0,
            favorite_count: 0,
            recentNotes: [],
          };
        }
      });

      const enrichedPnms = await Promise.all(enrichedPromises);
      setPnms(enrichedPnms);
    } catch (e: any) {
      toast({ title: "Failed to load comparison data", description: e?.message });
    } finally {
      setLoading(false);
    }
  };

  const handleExport = () => {
    const params = new URLSearchParams();
    params.set("ids", pnmIds.join(","));
    router.push(`/exports?${params.toString()}`);
  };

  if (pnmIds.length === 0 || pnmIds.length < 2 || pnmIds.length > 5) {
    return null; // Will redirect
  }

  return (
    <div className="flex w-full flex-col gap-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <button
            onClick={() => router.push("/pnms")}
            className="rounded-lg p-2 text-beta-gray hover:bg-beta-navy/10 hover:text-beta-navy"
          >
            <ArrowLeft className="h-5 w-5" />
          </button>
          <div>
            <h1 className="text-2xl font-bold text-beta-navy">Compare PNMs</h1>
            <p className="text-sm text-beta-gray mt-1">
              Comparing {pnms.length} PNM{pnms.length !== 1 ? "s" : ""}
            </p>
          </div>
        </div>
        <Button icon={<Download className="h-4 w-4" />} onClick={handleExport}>
          Export
        </Button>
      </div>

      {/* Comparison Grid */}
      {loading ? (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5">
          {pnmIds.map((id) => (
            <PNMComparisonCard key={id} pnm={{} as PNMDetails} loading={true} />
          ))}
        </div>
      ) : pnms.length === 0 ? (
        <div className="flex h-48 items-center justify-center rounded-xl border border-beta-gray/30 bg-white">
          <div className="text-center text-beta-gray">
            <p>Failed to load PNM data</p>
            <Button
              variant="neutral-secondary"
              onClick={loadComparisonData}
              className="mt-4"
            >
              Retry
            </Button>
          </div>
        </div>
      ) : (
        <div
          className={cn(
            "grid gap-4",
            pnms.length === 2 && "grid-cols-1 md:grid-cols-2",
            pnms.length === 3 && "grid-cols-1 md:grid-cols-2 lg:grid-cols-3",
            pnms.length === 4 && "grid-cols-1 md:grid-cols-2 lg:grid-cols-4",
            pnms.length === 5 && "grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5"
          )}
        >
          {pnms.map((pnm) => (
            <PNMComparisonCard key={pnm.id} pnm={pnm} />
          ))}
        </div>
      )}
    </div>
  );
}

