"use client";

import React, { useEffect, useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { FeatherCheck } from "@subframe/core";
import { FeatherCopy } from "@subframe/core";
import { FeatherEdit2 } from "@subframe/core";
import { FeatherFilter } from "@subframe/core";
import { FeatherMoreHorizontal } from "@subframe/core";
import { FeatherPlus } from "@subframe/core";
import { FeatherSearch } from "@subframe/core";
import { FeatherTag } from "@subframe/core";
import { FeatherTrash } from "@subframe/core";
import { FeatherTrendingUp } from "@subframe/core";
import { FeatherUsers } from "@subframe/core";
import * as SubframeCore from "@subframe/core";
import { Badge } from "@/ui/components/Badge";
import { Breadcrumbs } from "@/ui/components/Breadcrumbs";
import { Button } from "@/ui/components/Button";
import { DropdownMenu } from "@/ui/components/DropdownMenu";
import { IconButton } from "@/ui/components/IconButton";
import { TextField } from "@/ui/components/TextField";
import { api, getChapterId } from "@/lib/api";
import { useToast } from "@/components/ToastProvider";
import { TagForm } from "@/components/admin/TagForm";
import { BulkTagModal } from "@/components/admin/BulkTagModal";
import AdminProtected from "@/components/AdminProtected";

type Tag = {
  id: string;
  label: string;
  color?: string | null;
  chapter_id: string;
  pnm_count?: number;
};

type TagStats = {
  total_tags: number;
  most_used_tag: {
    id: string;
    label: string;
    usage_count: number;
  } | null;
  tagged_pnms_count: number;
};

// Helper to get badge variant from color
const getBadgeVariant = (color: string | null | undefined): "neutral" | "success" | "warning" | "error" => {
  if (!color) return "neutral";
  const c = color.toLowerCase();
  if (c.includes("10b981") || c.includes("green")) return "success";
  if (c.includes("f59e0b") || c.includes("orange") || c.includes("8b5cf6") || c.includes("purple")) return "warning";
  if (c.includes("ef4444") || c.includes("red")) return "error";
  return "neutral";
};

// Helper to get color name from hex
const getColorName = (color: string | null | undefined): string => {
  if (!color) return "Default";
  const c = color.toLowerCase();
  if (c.includes("3b82f6") || c.includes("blue")) return "Blue";
  if (c.includes("10b981") || c.includes("green")) return "Green";
  if (c.includes("f59e0b") || c.includes("orange")) return "Orange";
  if (c.includes("8b5cf6") || c.includes("purple")) return "Purple";
  if (c.includes("ef4444") || c.includes("red")) return "Red";
  if (c.includes("64748b") || c.includes("gray") || c.includes("grey")) return "Gray";
  return "Custom";
};

// Helper to get description placeholder
const getDescription = (label: string): string => {
  const lower = label.toLowerCase();
  if (lower.includes("lead")) return "PNMs who demonstrate strong leadership qualities";
  if (lower.includes("academ")) return "High GPA and strong academic performance";
  if (lower.includes("athlet")) return "Active in sports and athletic programs";
  if (lower.includes("social")) return "Strong social skills and networking ability";
  if (lower.includes("engineer")) return "Engineering majors and technical backgrounds";
  if (lower.includes("community") || lower.includes("service")) return "Active in volunteer work and community outreach";
  return `PNMs tagged with ${label}`;
};

export default function TagManagementPage() {
  const router = useRouter();
  const { toast } = useToast();
  const [chapterId, setChapterId] = useState<string | null>(null);
  const [tags, setTags] = useState<Tag[]>([]);
  const [tagStats, setTagStats] = useState<TagStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [editingTag, setEditingTag] = useState<Tag | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showBulkModal, setShowBulkModal] = useState(false);

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
    if (chapterId) {
      loadTags();
      loadTagStats();
    }
  }, [chapterId]);

  const loadTags = async () => {
    if (!chapterId) return;
    setLoading(true);
    try {
      const data = await api<Tag[]>(`/tags?chapter_id=${chapterId}`);
      setTags(data);
    } catch (e: any) {
      toast({ title: "Failed to load tags", description: e?.message });
    } finally {
      setLoading(false);
    }
  };

  const loadTagStats = async () => {
    if (!chapterId) return;
    try {
      const stats = await api<TagStats>(`/tags/stats?chapter_id=${chapterId}`);
      setTagStats(stats);
    } catch (e: any) {
      console.error("Failed to load tag stats:", e);
    }
  };

  const handleCreateTag = async (tagData: { label: string; color?: string }) => {
    if (!chapterId) return;
    try {
      await api<Tag>(`/tags?chapter_id=${chapterId}`, {
        method: "POST",
        body: tagData,
      });
      toast({ title: "Tag created successfully" });
      setShowCreateModal(false);
      await loadTags();
      await loadTagStats();
    } catch (e: any) {
      toast({ title: "Failed to create tag", description: e?.message });
      throw e;
    }
  };

  const handleUpdateTag = async (tagData: { label: string; color?: string }) => {
    if (!chapterId || !editingTag) return;
    try {
      await api<Tag>(`/tags/${editingTag.id}?chapter_id=${chapterId}`, {
        method: "PUT",
        body: tagData,
      });
      toast({ title: "Tag updated successfully" });
      setEditingTag(null);
      await loadTags();
      await loadTagStats();
    } catch (e: any) {
      toast({ title: "Failed to update tag", description: e?.message });
      throw e;
    }
  };

  const handleDeleteTag = async (tagId: string) => {
    if (!chapterId) return;
    if (!confirm("Are you sure you want to delete this tag? This will remove it from all PNMs.")) {
      return;
    }
    try {
      await api(`/tags/${tagId}?chapter_id=${chapterId}`, {
        method: "DELETE",
      });
      toast({ title: "Tag deleted successfully" });
      await loadTags();
      await loadTagStats();
    } catch (e: any) {
      toast({ title: "Failed to delete tag", description: e?.message });
    }
  };

  const handleDuplicateTag = async (tag: Tag) => {
    if (!chapterId) return;
    try {
      await api<Tag>(`/tags?chapter_id=${chapterId}`, {
        method: "POST",
        body: {
          label: `${tag.label} (Copy)`,
          color: tag.color,
        },
      });
      toast({ title: "Tag duplicated successfully" });
      await loadTags();
      await loadTagStats();
    } catch (e: any) {
      toast({ title: "Failed to duplicate tag", description: e?.message });
    }
  };

  const handleApplyTag = (tagId: string) => {
    // Navigate to PNMs page with tag filter
    router.push(`/pnms?tag=${tagId}`);
  };

  const filteredTags = useMemo(() => {
    if (!searchQuery.trim()) return tags;
    const query = searchQuery.toLowerCase();
    return tags.filter((tag) => tag.label.toLowerCase().includes(query));
  }, [tags, searchQuery]);

  return (
    <AdminProtected>
      <div className="flex w-full flex-col gap-6">
        <div className="flex w-full items-center justify-between">
          <Breadcrumbs>
            <Breadcrumbs.Item>Home</Breadcrumbs.Item>
            <Breadcrumbs.Divider />
            <Breadcrumbs.Item>Admin</Breadcrumbs.Item>
            <Breadcrumbs.Divider />
            <Breadcrumbs.Item active={true}>Tag Management</Breadcrumbs.Item>
          </Breadcrumbs>
          <Button
            icon={<FeatherPlus />}
            onClick={() => setShowCreateModal(true)}
          >
            Create Tag
          </Button>
        </div>
        <div className="flex w-full flex-col items-start gap-2">
          <span className="text-heading-1 font-heading-1 text-default-font">
            Tag Management
          </span>
          <span className="text-body font-body text-subtext-color">
            Organize and categorize PNMs with custom tags
          </span>
        </div>

        {/* Stats Cards */}
        {tagStats && (
          <div className="flex w-full items-start gap-4 flex-wrap">
            <div className="flex grow shrink-0 basis-0 items-center gap-6 rounded-md bg-[#162238ff] px-6 py-8">
              <div className="flex h-12 w-12 flex-none items-center justify-center rounded-md">
                <FeatherTag className="text-heading-2 font-heading-2 text-white" />
              </div>
              <div className="flex grow shrink-0 basis-0 flex-col items-start gap-1">
                <span className="text-heading-2 font-heading-2 text-white">
                  {tagStats.total_tags}
                </span>
                {/* The number was white but the label kept the default
                    near-black, so "Total Tags" sat at 1.24:1 on this card's
                    dark navy -- effectively invisible. Its two sibling cards
                    pair a light background with a dark label; this one is the
                    inverse and its label has to follow. */}
                <span className="text-body font-body text-white/80">
                  Total Tags
                </span>
              </div>
            </div>
            <div className="flex grow shrink-0 basis-0 items-center gap-6 rounded-md bg-brand-100 px-6 py-8">
              <div className="flex h-12 w-12 flex-none items-center justify-center rounded-md bg-brand-600">
                <FeatherTrendingUp className="text-heading-2 font-heading-2 text-white" />
              </div>
              <div className="flex grow shrink-0 basis-0 flex-col items-start gap-1">
                <span className="text-heading-2 font-heading-2 text-brand-700">
                  {tagStats.most_used_tag?.label || "—"}
                </span>
                <span className="text-body font-body text-brand-700">
                  Most Used Tag
                </span>
              </div>
            </div>
            <div className="flex grow shrink-0 basis-0 items-center gap-6 rounded-md bg-success-100 px-6 py-8">
              <div className="flex h-12 w-12 flex-none items-center justify-center rounded-md bg-success-600">
                <FeatherUsers className="text-heading-2 font-heading-2 text-white" />
              </div>
              <div className="flex grow shrink-0 basis-0 flex-col items-start gap-1">
                <span className="text-heading-2 font-heading-2 text-success-700">
                  {tagStats.tagged_pnms_count}
                </span>
                <span className="text-body font-body text-success-700">
                  Tagged PNMs
                </span>
              </div>
            </div>
          </div>
        )}

        {/* Search and Filter */}
        <div className="flex w-full items-center gap-4 border-b border-solid border-neutral-border pb-4">
          <div className="flex grow shrink-0 basis-0 items-center gap-2">
            <TextField
              variant="filled"
              label=""
              helpText=""
              icon={<FeatherSearch />}
            >
              <TextField.Input
                placeholder="Search tags..."
                value={searchQuery}
                onChange={(event: React.ChangeEvent<HTMLInputElement>) =>
                  setSearchQuery(event.target.value)
                }
              />
            </TextField>
          </div>
          <Button
            variant="neutral-secondary"
            icon={<FeatherFilter />}
            onClick={() => {
              toast({ title: "Filter", description: "Filter functionality coming soon" });
            }}
          >
            Filter
          </Button>
        </div>

        {/* Tags Grid */}
        {loading ? (
          <div className="flex items-center justify-center py-12 text-subtext-color">
            Loading tags...
          </div>
        ) : filteredTags.length === 0 ? (
          <div className="flex items-center justify-center py-12 text-subtext-color">
            {searchQuery ? "No tags found matching your search" : "No tags yet. Create your first tag to get started."}
          </div>
        ) : (
          <div className="w-full items-start gap-4 grid grid-cols-1">
            {filteredTags.map((tag) => (
              <div
                key={tag.id}
                className="flex grow shrink-0 basis-0 flex-col items-start gap-4 rounded-md border border-solid border-neutral-border bg-white px-4 py-4 shadow-sm"
              >
                <div className="flex w-full items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div
                      className="flex h-10 w-10 flex-none items-center justify-center rounded-md"
                      style={{ backgroundColor: tag.color || "#162238ff" }}
                    >
                      <FeatherTag className="text-body font-body text-white" />
                    </div>
                    <div className="flex flex-col items-start gap-1">
                      <span className="text-body-bold font-body-bold text-default-font">
                        {tag.label}
                      </span>
                      <Badge variant={getBadgeVariant(tag.color)}>
                        {getColorName(tag.color)}
                      </Badge>
                    </div>
                  </div>
                  <SubframeCore.DropdownMenu.Root>
                    <SubframeCore.DropdownMenu.Trigger asChild={true}>
                      <IconButton
                        size="small"
                        icon={<FeatherMoreHorizontal />}
                        onClick={() => { }}
                      />
                    </SubframeCore.DropdownMenu.Trigger>
                    <SubframeCore.DropdownMenu.Portal>
                      <SubframeCore.DropdownMenu.Content
                        side="bottom"
                        align="end"
                        sideOffset={4}
                        asChild={true}
                      >
                        <DropdownMenu>
                          <DropdownMenu.DropdownItem
                            icon={<FeatherEdit2 />}
                            onClick={() => setEditingTag(tag)}
                          >
                            Edit
                          </DropdownMenu.DropdownItem>
                          <DropdownMenu.DropdownItem
                            icon={<FeatherCopy />}
                            onClick={() => handleDuplicateTag(tag)}
                          >
                            Duplicate
                          </DropdownMenu.DropdownItem>
                          <DropdownMenu.DropdownItem
                            icon={<FeatherTrash />}
                            onClick={() => handleDeleteTag(tag.id)}
                          >
                            Delete
                          </DropdownMenu.DropdownItem>
                        </DropdownMenu>
                      </SubframeCore.DropdownMenu.Content>
                    </SubframeCore.DropdownMenu.Portal>
                  </SubframeCore.DropdownMenu.Root>
                </div>
                <span className="w-full text-caption font-caption text-subtext-color">
                  {getDescription(tag.label)}
                </span>
                <div className="flex w-full items-center justify-between border-t border-solid border-neutral-border pt-3">
                  <div className="flex items-center gap-2">
                    <FeatherUsers className="text-caption font-caption text-subtext-color" />
                    <span className="text-caption font-caption text-subtext-color">
                      {tag.pnm_count || 0} PNM{tag.pnm_count !== 1 ? "s" : ""}
                    </span>
                  </div>
                  <Button
                    variant="neutral-tertiary"
                    size="small"
                    onClick={() => handleApplyTag(tag.id)}
                  >
                    Apply
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Bulk Apply Tags */}
        {tags.length > 0 && (
          <div className="flex w-full flex-col items-start gap-4 rounded-md border border-solid border-neutral-border bg-white px-6 py-6 shadow-sm">
            <div className="flex w-full items-center justify-between">
              <div className="flex flex-col items-start gap-1">
                <span className="text-heading-3 font-heading-3 text-default-font">
                  Bulk Apply Tags
                </span>
                <span className="text-body font-body text-subtext-color">
                  Apply multiple tags to selected PNMs at once
                </span>
              </div>
              <Button
                icon={<FeatherCheck />}
                onClick={() => setShowBulkModal(true)}
              >
                Apply to Selected
              </Button>
            </div>
            <div className="flex w-full items-center gap-2 flex-wrap">
              {tags.slice(0, 6).map((tag) => (
                <Badge
                  key={tag.id}
                  variant={getBadgeVariant(tag.color)}
                  icon={<FeatherTag />}
                >
                  {tag.label}
                </Badge>
              ))}
              {tags.length > 6 && (
                <Badge variant="neutral">
                  +{tags.length - 6} more
                </Badge>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Create Tag Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="w-full max-w-md rounded-xl border border-neutral-border bg-white shadow-lg p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-default-font">Create New Tag</h2>
              <button
                onClick={() => setShowCreateModal(false)}
                className="text-subtext-color hover:text-default-font"
              >
                ×
              </button>
            </div>
            <TagForm
              onSubmit={handleCreateTag}
              onCancel={() => setShowCreateModal(false)}
            />
          </div>
        </div>
      )}

      {/* Edit Tag Modal */}
      {editingTag && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="w-full max-w-md rounded-xl border border-neutral-border bg-white shadow-lg p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-default-font">Edit Tag</h2>
              <button
                onClick={() => setEditingTag(null)}
                className="text-subtext-color hover:text-default-font"
              >
                ×
              </button>
            </div>
            <TagForm
              tag={editingTag}
              onSubmit={handleUpdateTag}
              onCancel={() => setEditingTag(null)}
            />
          </div>
        </div>
      )}

      {/* Bulk Tag Modal */}
      {showBulkModal && chapterId && (
        <BulkTagModal
          open={showBulkModal}
          onClose={() => setShowBulkModal(false)}
          selectedPnmIds={[]} // TODO: Get from PNMs page selection
          chapterId={chapterId}
          onComplete={() => {
            loadTags();
            loadTagStats();
          }}
        />
      )}
    </AdminProtected>
  );
}
