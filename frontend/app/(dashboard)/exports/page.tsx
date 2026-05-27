"use client";
/**
 * Export Center Page
 * 
 * Features:
 * - Export All PNMs
 * - Export Filtered PNMs (from PNMs page filters)
 * - Export Comparison Set (from compare page)
 * - Export Event Attendance
 * - PNM Graphics (bulk export)
 */
import { useEffect, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { api, getChapterId, exportPnmsPptx, triggerBlobDownload } from "@/lib/api";
import { useToast } from "@/components/ToastProvider";
import { Button } from "@/ui/components/Button";
import { IconWithBackground } from "@/ui/components/IconWithBackground";
import {
  Download,
  FileText,
  Users,
  GitCompare,
  Calendar,
  Image as ImageIcon,
  ArrowLeft,
} from "lucide-react";
import {
  exportAllPnms,
  exportFilteredPnms,
  exportEventAttendance,
} from "@/lib/export";
import { downloadFileForMobile } from "@/lib/utils";

type Event = {
  id: string;
  name: string;
  date: string;
  location?: string | null;
};


export default function ExportsPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { toast } = useToast();
  const [chapterId, setChapterId] = useState<string | null>(null);
  const [events, setEvents] = useState<Event[]>([]);
  const [loading, setLoading] = useState(false);
  const [graphicsLoading, setGraphicsLoading] = useState(false);
  const [pptxExporting, setPptxExporting] = useState(false);

  // Get filters from URL params
  const filterTags = searchParams.get("tags")?.split(",").filter(Boolean) || [];
  const filterSearch = searchParams.get("search") || "";
  const compareIds = searchParams.get("ids")?.split(",").filter(Boolean) || [];
  const eventId = searchParams.get("eventId") || "";

  useEffect(() => {
    (async () => {
      try {
        const cid = await getChapterId();
        setChapterId(cid);
        if (cid) {
          // Load events
          const eventsData = await api<Event[]>(`/events?chapter_id=${cid}`).catch(() => []);
          setEvents(eventsData);
        }
      } catch (e: any) {
        toast({ title: "Failed to load data", description: e?.message });
      }
    })();
  }, [toast]);

  const handleExportAllPnms = async () => {
    if (!chapterId) {
      toast({ title: "No chapter", description: "Unable to export" });
      return;
    }
    setLoading(true);
    try {
      await exportAllPnms(chapterId);
      toast({ title: "Export started", description: "PNMs CSV download started" });
    } catch (e: any) {
      toast({ title: "Export failed", description: e?.message || "Failed to export PNMs" });
    } finally {
      setLoading(false);
    }
  };

  const handleExportFiltered = async () => {
    if (!chapterId) {
      toast({ title: "No chapter", description: "Unable to export" });
      return;
    }
    setLoading(true);
    try {
      await exportFilteredPnms(chapterId, {
        search: filterSearch,
        tags: filterTags,
      });
      toast({ title: "Export started", description: "Filtered PNMs CSV download started" });
    } catch (e: any) {
      toast({ title: "Export failed", description: e?.message || "Failed to export filtered PNMs" });
    } finally {
      setLoading(false);
    }
  };

  const handleExportComparison = async () => {
    if (!chapterId || compareIds.length === 0) {
      toast({ title: "No PNMs selected", description: "Select PNMs to compare first" });
      return;
    }
    setLoading(true);
    try {
      await exportFilteredPnms(chapterId, { ids: compareIds });
      toast({ title: "Export started", description: "Comparison set CSV download started" });
    } catch (e: any) {
      toast({ title: "Export failed", description: e?.message || "Failed to export comparison" });
    } finally {
      setLoading(false);
    }
  };

  const handleExportAllPnmsImages = async (e?: React.MouseEvent) => {
    e?.preventDefault();
    e?.stopPropagation();

    if (!chapterId) {
      toast({ title: "No chapter", description: "Unable to export" });
      return;
    }
    setGraphicsLoading(true);
    try {
      toast({ title: "Generating ZIP...", description: "This may take a few minutes" });
      const response = await api<{ url: string; message: string }>(`/exports/pnm-cards/bulk`, {
        method: "POST",
        body: { chapter_id: chapterId },
        timeout: 120000,  // 2 minute timeout for bulk graphics generation
      });

      if (response.url) {
        // Use blob download approach for mobile Safari compatibility
        const filename = `pnm_graphics_${new Date().toISOString().split("T")[0]}.zip`;
        const downloaded = await downloadFileForMobile(response.url, filename);
        if (downloaded) {
          toast({ title: "ZIP downloaded!", description: "Check your downloads folder" });
        } else {
          // Fallback: open in same window
          window.location.href = response.url;
          toast({ title: "Opening download...", description: "File should start downloading" });
        }
      } else {
        toast({ title: "Export failed", description: "No download URL returned" });
      }
    } catch (e: any) {
      toast({ title: "Export failed", description: e?.message || "Failed to generate images" });
    } finally {
      setGraphicsLoading(false);
    }
  };

  const handleExportEvent = async (eventIdToExport: string) => {
    setLoading(true);
    try {
      const attendance = await api<any[]>(`/events/${eventIdToExport}/attendance`);
      await exportEventAttendance(eventIdToExport, attendance);
      toast({ title: "Export started", description: "Event attendance CSV download started" });
    } catch (e: any) {
      toast({ title: "Export failed", description: e?.message || "Failed to export attendance" });
    } finally {
      setLoading(false);
    }
  };

  const handleExportAllPptx = async () => {
    setPptxExporting(true);
    toast({ title: "Building your deck…", description: "About 10s for 30 PNMs" });
    try {
      const { blob, filename } = await exportPnmsPptx({});
      triggerBlobDownload(blob, filename);
      toast({ title: "Deck ready", description: filename });
    } catch (e: any) {
      toast({ title: "Export failed", description: e?.message || "Unable to build deck" });
    } finally {
      setPptxExporting(false);
    }
  };

  return (
    <div className="flex w-full flex-col gap-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <button
          onClick={() => router.back()}
          className="rounded-lg p-2 text-beta-gray hover:bg-beta-navy/10 hover:text-beta-navy"
        >
          <ArrowLeft className="h-5 w-5" />
        </button>
        <div>
          <h1 className="text-2xl font-bold text-beta-navy">Export Center</h1>
          <p className="text-sm text-beta-gray mt-1">Export data in CSV format</p>
        </div>
      </div>

      {/* Export Sections */}
      <div className="grid gap-6 md:grid-cols-2">
        {/* Export All PNMs */}
        <div className="rounded-xl border border-beta-gray/30 bg-white p-6 shadow-sm">
          <div className="flex items-start justify-between mb-4">
            <div className="flex items-center gap-3">
              <IconWithBackground variant="neutral" size="small" icon={<Users className="h-5 w-5" />} />
              <div>
                <h2 className="text-lg font-semibold text-beta-navy">Export All PNMs</h2>
                <p className="text-sm text-beta-gray">Download all PNMs in your chapter</p>
              </div>
            </div>
          </div>
          <Button
            icon={<Download className="h-4 w-4" />}
            onClick={handleExportAllPnms}
            disabled={loading || graphicsLoading || !chapterId}
            className="w-full"
            type="button"
          >
            {loading ? "Exporting..." : "Export All PNMs"}
          </Button>
        </div>

        {/* Export Filtered PNMs */}
        <div className="rounded-xl border border-beta-gray/30 bg-white p-6 shadow-sm">
          <div className="flex items-start justify-between mb-4">
            <div className="flex items-center gap-3">
              <IconWithBackground variant="neutral" size="small" icon={<FileText className="h-5 w-5" />} />
              <div>
                <h2 className="text-lg font-semibold text-beta-navy">Export Filtered PNMs</h2>
                <p className="text-sm text-beta-gray">
                  {filterTags.length > 0 || filterSearch
                    ? `Exporting with ${filterTags.length} tag filter(s)${filterSearch ? " and search" : ""}`
                    : "No filters applied. Go to PNMs page to filter first."}
                </p>
              </div>
            </div>
          </div>
          <Button
            variant="neutral-secondary"
            icon={<Download className="h-4 w-4" />}
            onClick={handleExportFiltered}
            disabled={loading || graphicsLoading || !chapterId || (filterTags.length === 0 && !filterSearch)}
            className="w-full"
            type="button"
          >
            {loading ? "Exporting..." : "Export Filtered"}
          </Button>
        </div>

        {/* Export Comparison Set */}
        {compareIds.length > 0 && (
          <div className="rounded-xl border border-beta-gray/30 bg-white p-6 shadow-sm">
            <div className="flex items-start justify-between mb-4">
              <div className="flex items-center gap-3">
                <IconWithBackground variant="neutral" size="small" icon={<GitCompare className="h-5 w-5" />} />
                <div>
                  <h2 className="text-lg font-semibold text-beta-navy">Export Comparison Set</h2>
                  <p className="text-sm text-beta-gray">
                    Export {compareIds.length} PNM{compareIds.length !== 1 ? "s" : ""} from comparison
                  </p>
                </div>
              </div>
            </div>
            <Button
              variant="neutral-secondary"
              icon={<Download className="h-4 w-4" />}
              onClick={handleExportComparison}
              disabled={loading || !chapterId}
              className="w-full"
            >
              {loading ? "Exporting..." : "Export Comparison"}
            </Button>
          </div>
        )}

        {/* Export Event Attendance */}
        <div className="rounded-xl border border-beta-gray/30 bg-white p-6 shadow-sm">
          <div className="flex items-start justify-between mb-4">
            <div className="flex items-center gap-3">
              <IconWithBackground variant="success" size="small" icon={<Calendar className="h-5 w-5" />} />
              <div>
                <h2 className="text-lg font-semibold text-beta-navy">Export Event Attendance</h2>
                <p className="text-sm text-beta-gray">Export attendance list for an event</p>
              </div>
            </div>
          </div>
          {events.length === 0 ? (
            <div className="text-sm text-beta-gray py-2">No events available</div>
          ) : (
            <div className="space-y-2">
              {events.slice(0, 5).map((event) => (
                <Button
                  key={event.id}
                  variant="neutral-secondary"
                  size="small"
                  icon={<Download className="h-3 w-3" />}
                  onClick={() => handleExportEvent(event.id)}
                  disabled={loading}
                  className="w-full justify-start"
                >
                  {event.name}
                  {eventId === event.id && " (Current)"}
                </Button>
              ))}
            </div>
          )}
        </div>

        {/* PNM Graphics */}
        <div className="rounded-xl border border-beta-gray/30 bg-white p-6 shadow-sm">
          <div className="flex items-start justify-between mb-4">
            <div className="flex items-center gap-3">
              <IconWithBackground variant="neutral" size="small" icon={<ImageIcon className="h-5 w-5" strokeWidth={2} />} />
              <div>
                <h2 className="text-lg font-semibold text-beta-navy">PNM Graphics</h2>
                <p className="text-sm text-beta-gray">Generate 4:5 ratio (1080x1350) PNG share cards</p>
              </div>
            </div>
          </div>
          <div className="space-y-3">
            <Button
              variant="neutral-secondary"
              icon={<Download className="h-4 w-4" />}
              onClick={handleExportAllPnmsImages}
              disabled={graphicsLoading || loading || !chapterId}
              className="w-full"
              type="button"
            >
              {graphicsLoading ? "Generating..." : "Export All PNM Images (ZIP)"}
            </Button>
            <p className="text-xs text-beta-gray">
              Generates images for all PNMs in your chapter and downloads as a ZIP file. Each image includes name, major, hometown, year, and fun fact.
            </p>
          </div>
        </div>

        {/* PNM Slideshow (PowerPoint) */}
        <div className="rounded-xl border border-beta-gray/30 bg-white p-6 shadow-sm">
          <div className="flex items-start justify-between mb-4">
            <div className="flex items-center gap-3">
              <IconWithBackground variant="neutral" size="small" icon={<FileText className="h-5 w-5" />} />
              <div>
                <h2 className="text-lg font-semibold text-beta-navy">PNM Slideshow (PowerPoint)</h2>
                <p className="text-sm text-beta-gray">One slide per PNM with photo, info, votes, and latest note</p>
              </div>
            </div>
          </div>
          <div className="space-y-3">
            <Button
              variant="neutral-secondary"
              icon={<Download className="h-4 w-4" />}
              onClick={handleExportAllPptx}
              disabled={pptxExporting || loading || !chapterId}
              className="w-full"
              type="button"
            >
              {pptxExporting ? "Building…" : "Download .pptx"}
            </Button>
            <p className="text-xs text-beta-gray">
              Creates a PowerPoint presentation with one slide per PNM. Slide includes photo, major, hometown, year, voting stats, and the latest chapter note. Opens in PowerPoint, Keynote, or Google Slides.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

