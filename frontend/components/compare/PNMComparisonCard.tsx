"use client";
/**
 * PNMComparisonCard - Individual PNM card in comparison view
 * Shows key stats and information for side-by-side comparison
 */
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Star, Users, CheckCircle2, XCircle, HelpCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import Link from "next/link";

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

interface PNMComparisonCardProps {
  pnm: PNMDetails;
  loading?: boolean;
}

export function PNMComparisonCard({ pnm, loading = false }: PNMComparisonCardProps) {
  if (loading) {
    return (
      <div className="flex flex-col gap-4 rounded-xl border border-beta-gray/30 bg-white p-6 shadow-sm">
        <div className="h-32 w-full animate-pulse rounded-lg bg-beta-gray/20" />
        <div className="h-4 w-3/4 animate-pulse rounded bg-beta-gray/20" />
        <div className="h-4 w-1/2 animate-pulse rounded bg-beta-gray/20" />
      </div>
    );
  }

  const formatPercent = (value?: number) =>
    typeof value === "number" ? `${Math.round(value)}%` : "—";

  return (
    <div className="flex flex-col gap-4 rounded-xl border border-beta-gray/30 bg-white p-6 shadow-sm">
      {/* Header */}
      <Link href={`/pnms/${pnm.id}`} className="flex items-center gap-4 hover:opacity-80 transition-opacity">
        <Avatar image={pnm.photo_url || undefined} size="medium">
          {pnm.name.slice(0, 2).toUpperCase()}
        </Avatar>
        <div className="flex-1 min-w-0">
          <h3 className="text-lg font-semibold text-beta-navy truncate">{pnm.name}</h3>
          {pnm.major && <p className="text-sm text-beta-gray">{pnm.major}</p>}
          {pnm.year && <p className="text-xs text-beta-gray">{pnm.year}</p>}
        </div>
      </Link>

      {/* Tags */}
      {pnm.tags && pnm.tags.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {pnm.tags.slice(0, 5).map((tag) => (
            <Badge key={tag} variant="neutral">
              {tag}
            </Badge>
          ))}
          {pnm.tags.length > 5 && (
            <Badge variant="neutral">+{pnm.tags.length - 5}</Badge>
          )}
        </div>
      )}

      {/* Stats Grid */}
      <div className="grid grid-cols-2 gap-3">
        {/* Yes Percentage */}
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 text-green-600" />
            <span className="text-xs font-semibold text-beta-gray">Yes %</span>
          </div>
          <div className="flex items-center gap-2">
            <Progress className="h-2 flex-1" value={pnm.yes_percentage || 0} />
            <span className="text-sm font-semibold text-beta-navy">
              {formatPercent(pnm.yes_percentage)}
            </span>
          </div>
        </div>

        {/* Favorites */}
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-2">
            <Star className="h-4 w-4 text-yellow-500" />
            <span className="text-xs font-semibold text-beta-gray">Favorites</span>
          </div>
          <span className="text-lg font-bold text-beta-navy">{pnm.favorite_count ?? 0}</span>
        </div>

        {/* Attendance */}
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-2">
            <Users className="h-4 w-4 text-blue-600" />
            <span className="text-xs font-semibold text-beta-gray">Attendance</span>
          </div>
          <span className="text-sm font-semibold text-beta-navy">
            {pnm.attendance_count || 0} / {pnm.total_events || 0}
          </span>
        </div>

        {/* Vote Breakdown */}
        {pnm.voteBreakdown && (
          <div className="flex flex-col gap-1">
            <div className="flex items-center gap-2">
              <HelpCircle className="h-4 w-4 text-beta-gray" />
              <span className="text-xs font-semibold text-beta-gray">Votes</span>
            </div>
            <div className="flex gap-1 text-xs">
              <span className="text-green-600 font-medium">{pnm.voteBreakdown.yes}Y</span>
              <span className="text-red-600 font-medium">{pnm.voteBreakdown.no}N</span>
              <span className="text-beta-gray font-medium">{pnm.voteBreakdown.unknown}?</span>
            </div>
          </div>
        )}
      </div>

      {/* Recent Notes */}
      {pnm.recentNotes && pnm.recentNotes.length > 0 && (
        <div className="border-t border-beta-gray/20 pt-4">
          <h4 className="text-xs font-semibold text-beta-gray mb-2">Recent Notes</h4>
          <div className="space-y-2">
            {pnm.recentNotes.slice(0, 2).map((note) => (
              <div key={note.id} className="text-xs text-beta-gray line-clamp-2">
                {note.body}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Hometown */}
      {pnm.hometown && (
        <div className="text-xs text-beta-gray">
          <span className="font-semibold">Hometown:</span> {pnm.hometown}
        </div>
      )}
    </div>
  );
}

