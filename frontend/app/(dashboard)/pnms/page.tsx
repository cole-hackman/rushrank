// PLAN: 1) Normalize table layout & spacing, 2) Fix showEmail/showPhone toggles & PNM.email/phone plumbing end-to-end, 3) Add basic responsiveness + empty state.

"use client";

import Link from "next/link";
import React from "react";
import { useEffect, useMemo, useState } from "react";
import { FeatherAlertTriangle } from "@subframe/core";
import { FeatherDownload } from "@subframe/core";
import { FeatherEye } from "@subframe/core";
import { FeatherFilter } from "@subframe/core";
import { FeatherSearch } from "@subframe/core";
import { FeatherTag } from "@subframe/core";
import { FeatherUsers } from "@subframe/core";
import { FeatherArrowLeftRight } from "@subframe/core";
import { FeatherTrash2 } from "@subframe/core";
import { FeatherImage } from "@subframe/core";
import { FeatherUserPlus } from "@subframe/core";
import { api, API_BASE } from "@/lib/api";
import { useToast } from "@/components/ToastProvider";
import { Breadcrumbs } from "@/ui/components/Breadcrumbs";
import { Button } from "@/ui/components/Button";
import { IconButton } from "@/ui/components/IconButton";
import { IconWithBackground } from "@/ui/components/IconWithBackground";
import { Table } from "@/ui/components/Table";
import { TextField } from "@/ui/components/TextField";
import { Checkbox } from "@/ui/components/Checkbox";
import { Badge } from "@/ui/components/Badge";
import { Avatar } from "@/ui/components/Avatar";
import { BulkTagModal } from "@/components/admin/BulkTagModal";
import { SkeletonTable } from "@/components/ui/SkeletonTable";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";

type PNM = {
  id: string;
  name: string;
  email?: string | null;
  phone?: string | null;
  major?: string | null;
  hometown?: string | null;
  year?: string | null;
  tags?: string[];
  photo_url?: string | null;
  attendance_count?: number;
  total_events?: number;
  yes_percentage?: number;
  favorite_count?: number;
  is_favorite?: boolean;
};


export default function PNMsPage() {
  const router = useRouter();
  const { toast } = useToast();
  const [chapterId, setChapterId] = useState<string | null>(null);
  const [pnms, setPnms] = useState<PNM[]>([]);
  const [search, setSearch] = useState("");
  const [allTags, setAllTags] = useState<string[]>([]);
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [showEmail, setShowEmail] = useState(true);
  const [showPhone, setShowPhone] = useState(true);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedPnmIds, setSelectedPnmIds] = useState<string[]>([]);
  const [showBulkTagModal, setShowBulkTagModal] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const chapters = await api<{ id: string; name: string }[]>("/chapters");
        const cid = chapters[0]?.id || null;
        setChapterId(cid);

        // Check admin status
        try {
          const profile = await api<{ memberships: Array<{ role: string }> }>("/me");
          const hasAdminRole = profile.memberships?.some((m) => m.role === "admin" || m.role === "ADMIN");
          setIsAdmin(hasAdminRole || false);
        } catch (e) {
          console.error("Failed to check admin status:", e);
          setIsAdmin(false);
        }
      } catch (e: any) {
        const errorMsg = e?.message || "Unable to fetch chapters";
        console.error("Failed to load chapters:", e);

        if (errorMsg.includes("Cannot connect to backend") || errorMsg.includes("Failed to fetch")) {
          toast({
            title: "Cannot connect to backend",
            description: `Backend server is not reachable. Please check if the server is running at ${process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:8000/api"}.`
          });
        } else if (errorMsg.includes("Authentication failed") || errorMsg.includes("401")) {
          toast({
            title: "Authentication failed",
            description: "Your session may have expired. Please try logging out and back in."
          });
        } else {
          toast({ title: "Failed to load chapter", description: errorMsg });
        }
      }
    })();
  }, [toast]);

  useEffect(() => {
    if (chapterId) {
      loadPnms();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chapterId, search, selectedTags]);

  const loadPnms = async () => {
    if (!chapterId) return;
    setLoading(true);
    setError(null);
    try {
      const query = new URLSearchParams();
      query.set("chapter_id", chapterId);
      if (search.trim()) query.set("search", search.trim());
      if (selectedTags.length > 0) query.set("tags", selectedTags.join(","));
      const data = await api<PNM[]>(`/pnms?${query.toString()}`);
      setPnms(data);

      const tags = new Set<string>();
      data.forEach((p) => (p.tags || []).forEach((t) => tags.add(t)));
      setAllTags(Array.from(tags).sort());
    } catch (e: any) {
      const message = e?.message || "Unable to load PNMs";
      setError(message);
      toast({ title: "Failed to load PNMs", description: message });
    } finally {
      setLoading(false);
    }
  };

  const filteredPnms = useMemo(() => {
    let data = pnms;
    const term = search.trim().toLowerCase();
    if (term) {
      data = data.filter((p) =>
        [p.name, p.major || "", p.hometown || "", p.email || "", p.phone || ""].some((value) =>
          value.toLowerCase().includes(term)
        )
      );
    }
    if (selectedTags.length) {
      data = data.filter((p) => selectedTags.some((tag) => (p.tags || []).includes(tag)));
    }
    return data;
  }, [pnms, search, selectedTags]);

  const stats = useMemo(() => {
    const total = pnms.length;
    return { total };
  }, [pnms]);

  const toggleTag = (tag: string) => {
    setSelectedTags((prev) =>
      prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]
    );
  };

  const handleExport = () => {
    const params = new URLSearchParams();
    if (selectedTags.length > 0) {
      params.set("tags", selectedTags.join(","));
    }
    if (search.trim()) {
      params.set("search", search.trim());
    }
    router.push(`/exports?${params.toString()}`);
  };

  const togglePnmSelection = (pnmId: string) => {
    setSelectedPnmIds((prev) =>
      prev.includes(pnmId) ? prev.filter((id) => id !== pnmId) : [...prev, pnmId]
    );
  };

  const toggleSelectAll = () => {
    if (selectedPnmIds.length === filteredPnms.length) {
      setSelectedPnmIds([]);
    } else {
      setSelectedPnmIds(filteredPnms.map((p) => p.id));
    }
  };

  const handleBulkTagComplete = () => {
    loadPnms();
    setSelectedPnmIds([]);
  };

  const handleCompare = () => {
    if (selectedPnmIds.length < 2 || selectedPnmIds.length > 5) {
      toast({ title: "Invalid selection", description: "Please select 2-5 PNMs to compare" });
      return;
    }
    router.push(`/compare?ids=${selectedPnmIds.join(",")}`);
  };

  const handleDeletePnm = async (pnmId: string, pnmName: string) => {
    if (!isAdmin) {
      toast({ title: "Access Denied", description: "Admin access required to delete PNMs" });
      return;
    }

    if (!confirm(`Are you sure you want to delete ${pnmName}? This action cannot be undone.`)) {
      return;
    }

    try {
      await api(`/pnms/${pnmId}`, { method: "DELETE" });
      toast({ title: "PNM deleted", description: `${pnmName} has been deleted` });
      await loadPnms();
      // Remove from selection if selected
      setSelectedPnmIds((prev) => prev.filter((id) => id !== pnmId));
    } catch (e: any) {
      toast({ title: "Failed to delete PNM", description: e?.message || "Unable to delete PNM" });
    }
  };

  const handleBulkDelete = async () => {
    if (!isAdmin) {
      toast({ title: "Access Denied", description: "Admin access required to delete PNMs" });
      return;
    }

    if (selectedPnmIds.length === 0) {
      toast({ title: "No selection", description: "Please select PNMs to delete" });
      return;
    }

    const count = selectedPnmIds.length;
    if (!confirm(`Are you sure you want to delete ${count} PNM${count !== 1 ? "s" : ""}? This action cannot be undone.`)) {
      return;
    }

    try {
      let successCount = 0;
      let errorCount = 0;

      for (const pnmId of selectedPnmIds) {
        try {
          await api(`/pnms/${pnmId}`, { method: "DELETE" });
          successCount++;
        } catch (e: any) {
          console.error(`Failed to delete PNM ${pnmId}:`, e);
          errorCount++;
        }
      }

      if (errorCount === 0) {
        toast({ title: "Success", description: `${successCount} PNM${successCount !== 1 ? "s" : ""} deleted` });
      } else {
        toast({ title: "Partial success", description: `${successCount} deleted, ${errorCount} failed` });
      }

      await loadPnms();
      setSelectedPnmIds([]);
    } catch (e: any) {
      toast({ title: "Bulk delete failed", description: e?.message || "Unable to delete PNMs" });
    }
  };

  const handleExportGraphic = async (pnmId: string, pnmName: string) => {
    try {
      toast({ title: "Generating graphic...", description: `Creating graphic for ${pnmName}` });
      const result = await api<{ url: string; message: string }>(
        `/exports/pnm-card/${pnmId}`,
        { method: "POST" }
      );
      if (result.url) {
        // Open the image URL in a new tab for download
        window.open(result.url, "_blank");
        toast({ title: "Graphic ready!", description: "Image opened in new tab" });
      }
    } catch (e: any) {
      toast({ title: "Export failed", description: e?.message || "Unable to generate graphic" });
    }
  };

  return (
    <div className="container max-w-none flex h-full w-full flex-col items-start gap-6 bg-default-background py-6">
      <div className="flex w-full flex-col items-start gap-1">
        <span className="text-heading-1 font-heading-1 text-default-font">
          PNMs
        </span>
        <span className="text-body font-body text-subtext-color">
          Manage and view all potential new members
        </span>
      </div>

      <div className="flex w-full items-center justify-between">
        <div className="flex items-center gap-2">
          {selectedPnmIds.length >= 2 && selectedPnmIds.length <= 5 && (
            <Button
              variant="neutral-secondary"
              icon={<FeatherArrowLeftRight />}
              onClick={handleCompare}
            >
              Compare ({selectedPnmIds.length})
            </Button>
          )}
          {selectedPnmIds.length > 0 && (
            <>
              <Button
                variant="neutral-secondary"
                icon={<FeatherTag />}
                onClick={() => setShowBulkTagModal(true)}
              >
                Bulk Tag ({selectedPnmIds.length})
              </Button>
              {isAdmin && (
                <Button
                  variant="destructive-secondary"
                  icon={<FeatherTrash2 />}
                  onClick={handleBulkDelete}
                >
                  Delete ({selectedPnmIds.length})
                </Button>
              )}
            </>
          )}
          <Button variant="neutral-secondary" icon={<FeatherDownload />} onClick={handleExport}>
            Export CSV
          </Button>
          <Link href="/exports">
            <Button variant="neutral-secondary" icon={<FeatherDownload />}>
              Export Graphics
            </Button>
          </Link>
          <Link href="/intake">
            <Button variant="brand-primary">New PNM</Button>
          </Link>
        </div>
      </div>

      <div className="w-full items-start gap-4 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4">
        <StatCard
          icon={<FeatherUsers />}
          label="Total PNMs"
          value={stats.total.toString()}
          tone="neutral"
        />
      </div>

      <div className="flex w-full flex-col gap-4 rounded-lg border border-solid border-neutral-border bg-white p-6 shadow-sm mt-4">
        <div className="flex flex-wrap items-center gap-4">
          <div className="min-w-[260px] flex-1">
            <TextField variant="filled" icon={<FeatherSearch />}>
              <TextField.Input
                placeholder="Search PNMs..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </TextField>
          </div>
          <div className="flex items-center gap-3">
            <Checkbox label="Show email" checked={showEmail} onCheckedChange={setShowEmail} />
            <Checkbox label="Show phone" checked={showPhone} onCheckedChange={setShowPhone} />
          </div>
          <div className="flex items-center gap-2 text-subtext-color">
            <FeatherFilter className="w-4 h-4" />
            <span className="text-caption-bold font-caption-bold">Filters</span>
          </div>
        </div>
        {/* Quick filter chips */}
        <div className="flex flex-wrap items-center gap-2">
          {allTags.length > 0 && (
            <div className="flex flex-wrap items-center gap-2">
              {allTags.map((tag) => (
                <button
                  key={tag}
                  onClick={() => toggleTag(tag)}
                  className={cn(
                    "rounded-full border px-3 py-1 text-caption font-caption-bold transition-colors",
                    selectedTags.includes(tag)
                      ? "border-brand-600 bg-brand-600 text-white"
                      : "border-neutral-border bg-white text-default-font hover:bg-neutral-50"
                  )}
                >
                  {tag}
                </button>
              ))}
              {selectedTags.length > 0 && (
                <Button
                  variant="neutral-tertiary"
                  size="small"
                  onClick={() => setSelectedTags([])}
                >
                  Clear filters
                </Button>
              )}
            </div>
          )}
        </div>

        <div className="mt-4 w-full rounded-xl border border-solid border-neutral-border bg-white dark:bg-neutral-800 shadow-sm overflow-hidden">
          {loading && (
            <SkeletonTable rows={8} columns={6} showCheckbox={true} />
          )}
          {error && !loading && (
            <div className="flex h-48 flex-col items-center justify-center gap-2 text-center text-subtext-color">
              <span className="text-body font-body">{error}</span>
              <Button variant="neutral-secondary" onClick={loadPnms}>
                Retry
              </Button>
            </div>
          )}
          {!loading && !error && pnms.length === 0 && (
            <div className="flex flex-col items-center justify-center gap-4 py-16 px-4 text-center">
              <div className="flex h-16 w-16 items-center justify-center rounded-full bg-neutral-100 dark:bg-neutral-800">
                <FeatherUsers className="h-8 w-8 text-neutral-400" />
              </div>
              <div className="flex flex-col gap-1">
                <p className="text-body-bold font-body-bold text-default-font">
                  No PNMs yet
                </p>
                <p className="text-caption text-subtext-color max-w-[280px]">
                  Add your first potential new member to get started
                </p>
              </div>
              <Link href="/rush">
                <Button variant="brand-primary" icon={<FeatherUserPlus />}>
                  Add PNM
                </Button>
              </Link>
            </div>
          )}
          {!loading && !error && pnms.length > 0 && (
            <div className="overflow-x-auto -mx-6 px-6">
              <Table
                className="min-w-[1200px] w-full"
                header={
                  <Table.HeaderRow>
                    <Table.HeaderCell className="w-[40px] min-w-[40px] text-center">
                      <input
                        type="checkbox"
                        checked={filteredPnms.length > 0 && selectedPnmIds.length === filteredPnms.length}
                        onChange={toggleSelectAll}
                        className="w-4 h-4 rounded border-beta-gray/50 text-beta-navy focus:ring-beta-navy focus:ring-offset-0 focus:ring-2"
                      />
                    </Table.HeaderCell>
                    <Table.HeaderCell className="w-[200px] min-w-[200px]">PNM</Table.HeaderCell>
                    <Table.HeaderCell className="w-[140px] min-w-[140px]">Major</Table.HeaderCell>
                    <Table.HeaderCell className="w-[140px] min-w-[140px]">Hometown</Table.HeaderCell>
                    {showEmail && <Table.HeaderCell className="w-[180px] min-w-[180px]">Email</Table.HeaderCell>}
                    {showPhone && <Table.HeaderCell className="w-[160px] min-w-[160px]">Phone</Table.HeaderCell>}
                    <Table.HeaderCell className="w-[180px] min-w-[180px]">Tags</Table.HeaderCell>
                    <Table.HeaderCell className="w-[120px] min-w-[120px]">Attendance</Table.HeaderCell>
                    <Table.HeaderCell className="w-[100px] min-w-[100px] text-right">Actions</Table.HeaderCell>
                  </Table.HeaderRow>
                }
              >
                {filteredPnms.map((pnm) => (
                  <Table.Row key={pnm.id} className="h-14">
                    <Table.Cell className="w-[40px] min-w-[40px] text-center">
                      <input
                        type="checkbox"
                        checked={selectedPnmIds.includes(pnm.id)}
                        onChange={() => togglePnmSelection(pnm.id)}
                        className="w-4 h-4 rounded border-beta-gray/50 text-beta-navy focus:ring-beta-navy focus:ring-offset-0 focus:ring-2"
                      />
                    </Table.Cell>
                    <Table.Cell className="w-[200px] min-w-[200px] !whitespace-normal">
                      <div className="flex items-center gap-3 min-w-0">
                        <Avatar image={pnm.photo_url || undefined} size="small">
                          {pnm.name.slice(0, 2).toUpperCase()}
                        </Avatar>
                        <div className="flex flex-col gap-0.5 min-w-0 flex-1">
                          <span className="text-body-bold font-body-bold text-default-font leading-tight truncate">{pnm.name}</span>
                          {pnm.year && (
                            <span className="text-caption font-caption text-subtext-color leading-tight">{pnm.year}</span>
                          )}
                        </div>
                      </div>
                    </Table.Cell>
                    <Table.Cell className="w-[140px] min-w-[140px] text-subtext-color whitespace-nowrap truncate" title={pnm.major || undefined}>
                      {pnm.major || "—"}
                    </Table.Cell>
                    <Table.Cell className="w-[140px] min-w-[140px] text-subtext-color whitespace-nowrap truncate" title={pnm.hometown || undefined}>
                      {pnm.hometown || "—"}
                    </Table.Cell>
                    {showEmail && (
                      <Table.Cell className="w-[180px] min-w-[180px] text-subtext-color whitespace-nowrap truncate" title={pnm.email || undefined}>
                        {pnm.email || "—"}
                      </Table.Cell>
                    )}
                    {showPhone && (
                      <Table.Cell className="w-[160px] min-w-[160px] text-subtext-color whitespace-nowrap truncate" title={pnm.phone || undefined}>
                        {pnm.phone || "—"}
                      </Table.Cell>
                    )}
                    <Table.Cell className="w-[180px] min-w-[180px] !whitespace-normal">
                      <div className="flex flex-wrap items-center gap-1.5">
                        {(pnm.tags || []).slice(0, 3).map((tag) => (
                          <Badge key={tag}>{tag}</Badge>
                        ))}
                        {(pnm.tags?.length || 0) > 3 && (
                          <Badge variant="neutral">+{(pnm.tags?.length || 0) - 3}</Badge>
                        )}
                        {(!pnm.tags || pnm.tags.length === 0) && (
                          <span className="text-caption font-caption text-subtext-color">—</span>
                        )}
                      </div>
                    </Table.Cell>
                    <Table.Cell className="w-[120px] min-w-[120px] text-subtext-color whitespace-nowrap">
                      {pnm.attendance_count || 0} / {pnm.total_events || 0}
                    </Table.Cell>
                    <Table.Cell className="w-[100px] min-w-[100px] text-right">
                      <div className="flex items-center justify-end gap-2">
                        <IconButton
                          size="small"
                          icon={<FeatherImage />}
                          onClick={() => handleExportGraphic(pnm.id, pnm.name)}
                          aria-label={`Export graphic for ${pnm.name}`}
                        />
                        <Link href={`/pnms/${pnm.id}`}>
                          <IconButton
                            size="small"
                            icon={<FeatherEye />}
                            aria-label={`View ${pnm.name}`}
                          />
                        </Link>
                        {isAdmin && (
                          <IconButton
                            size="small"
                            variant="destructive-secondary"
                            icon={<FeatherTrash2 />}
                            onClick={() => handleDeletePnm(pnm.id, pnm.name)}
                            aria-label={`Delete ${pnm.name}`}
                          />
                        )}
                      </div>
                    </Table.Cell>
                  </Table.Row>
                ))}
                {filteredPnms.length === 0 && pnms.length > 0 && (
                  <Table.Row>
                    <Table.Cell
                      colSpan={7 + (showEmail ? 1 : 0) + (showPhone ? 1 : 0)}
                      className="py-10 text-center text-subtext-color"
                    >
                      <span className="text-body font-body">
                        No PNMs match your filters.
                      </span>
                    </Table.Cell>
                  </Table.Row>
                )}
              </Table>
            </div>
          )}
        </div>

        <div className="text-caption font-caption text-subtext-color">
          Showing {filteredPnms.length} of {pnms.length} PNMs
        </div>

        <BulkTagModal
          open={showBulkTagModal}
          onClose={() => setShowBulkTagModal(false)}
          selectedPnmIds={selectedPnmIds}
          chapterId={chapterId}
          onComplete={handleBulkTagComplete}
        />
      </div>
    </div>
  );
}

function StatCard({
  icon,
  label,
  value,
  tone,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  tone: "neutral" | "success" | "brand" | "warning";
}) {
  return (
    <div className="flex flex-col items-start gap-3 rounded-lg border border-solid border-neutral-border bg-white px-6 py-4 shadow-sm">
      <div className="flex items-center gap-2">
        <IconWithBackground
          size="medium"
          variant={
            tone === "success"
              ? "success"
              : tone === "warning"
                ? "warning"
                : tone === "brand"
                  ? "brand"
                  : "neutral"
          }
          icon={icon}
        />
        <span className="text-caption-bold font-caption-bold text-subtext-color">
          {label}
        </span>
      </div>
      <span className="text-heading-1 font-heading-1 text-default-font">{value}</span>
    </div>
  );
}
