"use client";
import { useState, useEffect } from "react";
import { api } from "@/lib/api";
import { useToast } from "@/components/ToastProvider";
import { Button } from "@/components/ui/button";
import { X, Check } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * BulkTagModal - Bulk apply/remove tags from selected PNMs
 * Shows available tags with checkboxes, allows apply/remove operations
 */
type Tag = {
  id: string;
  label: string;
  color?: string | null;
};

interface BulkTagModalProps {
  open: boolean;
  onClose: () => void;
  selectedPnmIds: string[];
  chapterId: string | null;
  onComplete: () => void;
}

export function BulkTagModal({ open, onClose, selectedPnmIds, chapterId, onComplete }: BulkTagModalProps) {
  const { toast } = useToast();
  const [tags, setTags] = useState<Tag[]>([]);
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [operation, setOperation] = useState<"add" | "remove">("add");
  const [processing, setProcessing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [newTagLabel, setNewTagLabel] = useState("");
  const [showCreateTag, setShowCreateTag] = useState(false);
  const [creatingTag, setCreatingTag] = useState(false);

  useEffect(() => {
    if (open && chapterId) {
      loadTags();
      setSelectedTags([]);
      setNewTagLabel("");
      setShowCreateTag(false);
    }
  }, [open, chapterId]);

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

  const handleCreateTag = async () => {
    if (!chapterId || !newTagLabel.trim()) return;
    setCreatingTag(true);
    try {
      const newTag = await api<Tag>(`/tags?chapter_id=${chapterId}`, {
        method: "POST",
        body: { label: newTagLabel.trim(), color: "#6366f1" },
      });
      setTags([...tags, newTag]);
      setSelectedTags([...selectedTags, newTag.id]);
      setNewTagLabel("");
      setShowCreateTag(false);
      toast({ title: "Tag created", description: `Created tag "${newTag.label}"` });
    } catch (e: any) {
      toast({ title: "Failed to create tag", description: e?.message || "Unable to create tag" });
    } finally {
      setCreatingTag(false);
    }
  };

  const handleSubmit = async () => {
    if (!chapterId || selectedTags.length === 0 || selectedPnmIds.length === 0) return;
    setProcessing(true);
    try {
      let successCount = 0;
      let errorCount = 0;

      for (const pnmId of selectedPnmIds) {
        for (const tagId of selectedTags) {
          try {
            if (operation === "add") {
              await api(`/pnms/${pnmId}/tags/${tagId}`, { method: "POST" });
            } else {
              await api(`/pnms/${pnmId}/tags/${tagId}`, { method: "DELETE" });
            }
            successCount++;
          } catch (e: any) {
            console.error(`Failed to ${operation} tag ${tagId} to PNM ${pnmId}:`, e);
            errorCount++;
          }
        }
      }

      if (errorCount === 0) {
        toast({
          title: "Success",
          description: `${operation === "add" ? "Applied" : "Removed"} tags to ${selectedPnmIds.length} PNM(s)`,
        });
        onComplete();
        onClose();
      } else {
        toast({
          title: "Partial success",
          description: `${successCount} operations succeeded, ${errorCount} failed`,
        });
      }
    } catch (e: any) {
      toast({ title: "Operation failed", description: e?.message });
    } finally {
      setProcessing(false);
    }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="w-full max-w-md rounded-xl border border-beta-gray/30 bg-white shadow-lg">
        <div className="flex items-center justify-between border-b border-beta-gray/30 p-4">
          <h2 className="text-lg font-semibold text-beta-navy">
            Bulk Tag {selectedPnmIds.length} PNM{selectedPnmIds.length !== 1 ? "s" : ""}
          </h2>
          <button
            onClick={onClose}
            className="text-beta-gray hover:text-beta-navy"
            disabled={processing}
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="p-4 space-y-4">
          <div>
            <label className="text-sm font-semibold text-beta-navy mb-2 block">Operation</label>
            <div className="flex gap-2">
              <button
                onClick={() => setOperation("add")}
                className={cn(
                  "flex-1 rounded-lg border px-4 py-2 text-sm font-semibold transition-colors",
                  operation === "add"
                    ? "border-beta-navy bg-beta-navy text-white"
                    : "border-beta-gray/30 bg-white text-beta-navy hover:bg-beta-navy/5"
                )}
              >
                Add Tags
              </button>
              <button
                onClick={() => setOperation("remove")}
                className={cn(
                  "flex-1 rounded-lg border px-4 py-2 text-sm font-semibold transition-colors",
                  operation === "remove"
                    ? "border-red-600 bg-red-600 text-white"
                    : "border-beta-gray/30 bg-white text-beta-navy hover:bg-beta-navy/5"
                )}
              >
                Remove Tags
              </button>
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-sm font-semibold text-beta-navy">Select Tags</label>
              <button
                onClick={() => setShowCreateTag(!showCreateTag)}
                className="text-xs text-beta-navy hover:text-beta-navy/80 font-medium"
              >
                {showCreateTag ? "Cancel" : "+ Create Tag"}
              </button>
            </div>
            
            {showCreateTag && (
              <div className="mb-3 p-3 rounded-lg border border-beta-gray/30 bg-beta-navy/5">
                <input
                  type="text"
                  value={newTagLabel}
                  onChange={(e) => setNewTagLabel(e.target.value)}
                  placeholder="Enter tag name..."
                  className="w-full px-3 py-2 rounded border border-beta-gray/30 bg-white text-beta-navy text-sm focus:outline-none focus:ring-2 focus:ring-beta-navy focus:border-beta-navy"
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && newTagLabel.trim()) {
                      handleCreateTag();
                    }
                  }}
                />
                <div className="flex items-center justify-end gap-2 mt-2">
                  <button
                    onClick={() => {
                      setShowCreateTag(false);
                      setNewTagLabel("");
                    }}
                    className="text-xs text-beta-gray hover:text-beta-navy"
                    disabled={creatingTag}
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleCreateTag}
                    disabled={creatingTag || !newTagLabel.trim()}
                    className="px-3 py-1 text-xs font-semibold rounded bg-beta-navy text-white hover:bg-beta-navy/90 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {creatingTag ? "Creating..." : "Create"}
                  </button>
                </div>
              </div>
            )}

            {loading ? (
              <div className="text-center py-4 text-beta-gray">Loading tags...</div>
            ) : tags.length === 0 ? (
              <div className="text-center py-4 text-beta-gray">
                <p className="mb-2">No tags available.</p>
                <button
                  onClick={() => setShowCreateTag(true)}
                  className="text-xs text-beta-navy hover:text-beta-navy/80 font-medium underline"
                >
                  Create your first tag
                </button>
              </div>
            ) : (
              <div className="max-h-64 overflow-y-auto space-y-2">
                {tags.map((tag) => (
                  <label
                    key={tag.id}
                    className={cn(
                      "flex items-center gap-3 rounded-lg border p-3 cursor-pointer transition-colors",
                      selectedTags.includes(tag.id)
                        ? "border-beta-navy bg-beta-navy/5"
                        : "border-beta-gray/30 hover:border-beta-gray/60"
                    )}
                  >
                    <input
                      type="checkbox"
                      checked={selectedTags.includes(tag.id)}
                      onChange={(e) => {
                        if (e.target.checked) {
                          setSelectedTags([...selectedTags, tag.id]);
                        } else {
                          setSelectedTags(selectedTags.filter((id) => id !== tag.id));
                        }
                      }}
                      className="w-4 h-4 rounded border-beta-gray/50 text-beta-navy focus:ring-beta-navy"
                    />
                    <div
                      className="h-6 w-6 rounded border border-beta-gray/30 flex-shrink-0"
                      style={{ backgroundColor: tag.color || "#4ade80" }}
                    />
                    <span className="text-sm font-medium text-beta-navy">{tag.label}</span>
                  </label>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="flex items-center justify-end gap-2 border-t border-beta-gray/30 p-4">
          <Button variant="neutral-secondary" onClick={onClose} disabled={processing}>
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={processing || selectedTags.length === 0 || !chapterId}
          >
            {processing
              ? "Processing..."
              : operation === "add"
              ? `Add to ${selectedPnmIds.length} PNM${selectedPnmIds.length !== 1 ? "s" : ""}`
              : `Remove from ${selectedPnmIds.length} PNM${selectedPnmIds.length !== 1 ? "s" : ""}`}
          </Button>
        </div>
      </div>
    </div>
  );
}

