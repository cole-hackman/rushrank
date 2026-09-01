"use client";

import React, { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import {
  Book,
  Calendar,
  Download,
  EyeOff,
  MapPin,
  MessageSquare,
  Users,
  Loader2,
} from "lucide-react";
import { api, API_BASE, getContacts, type ContactEntry, type ContactSummary } from "@/lib/api";
import { MetButton } from "@/components/pnm/MetButton";
import { useToast } from "@/components/ToastProvider";
import { Breadcrumbs } from "@/ui/components/Breadcrumbs";
import { Button } from "@/ui/components/Button";
import { Badge } from "@/ui/components/Badge";
import { Avatar } from "@/ui/components/Avatar";
import { IconButton } from "@/ui/components/IconButton";
import { IconWithBackground } from "@/ui/components/IconWithBackground";
import { Tabs } from "@/ui/components/Tabs";
import { TextArea } from "@/ui/components/TextArea";
import { downloadFileForMobile } from "@/lib/utils";

type PNM = {
  id: string;
  name: string;
  major?: string | null;
  hometown?: string | null;
  year?: string | null;
  tags?: string[];
  photo_url?: string | null;
  yes_percentage?: number;
  attendance_count?: number;
  total_events?: number;
  favorite_count?: number;
};

type AttendanceEvent = {
  id: string;
  event_name: string;
  event_date: string;
  checked_in_at?: string;
  status?: string;
};

// Matches the backend Note model (GET/POST /pnms/{id}/notes). This page used to
// call /pnms/{id}/comments with a `text` field -- an endpoint that never existed,
// so the list silently rendered empty and posting always 404'd.
type Comment = {
  id: string;
  author?: string | null;
  created_at: string;
  body: string;
  anonymous?: boolean;
};

type TabKey = "comments" | "attendance";

export default function PNMProfilePage() {
  const { id } = useParams<{ id: string }>();
  const { toast } = useToast();
  const [pnm, setPnm] = useState<PNM | null>(null);
  const [attendance, setAttendance] = useState<AttendanceEvent[]>([]);
  const [comments, setComments] = useState<Comment[]>([]);
  const [newComment, setNewComment] = useState("");
  const [anonymous, setAnonymous] = useState(false);
  const [activeTab, setActiveTab] = useState<TabKey>("comments");
  const [loading, setLoading] = useState(true);
  const [posting, setPosting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    loadProfile();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const [coverage, setCoverage] = useState<(ContactSummary & { contacts: ContactEntry[] }) | null>(null);

  const loadProfile = async () => {
    setLoading(true);
    setError(null);
    try {
      const [pnmData, attendanceData, commentsData, coverageData] = await Promise.all([
        api<PNM>(`/pnms/${id}`),
        api<AttendanceEvent[]>(`/pnms/${id}/attendance`).catch(() => [] as AttendanceEvent[]),
        api<Comment[]>(`/pnms/${id}/notes`).catch(() => [] as Comment[]),
        getContacts(String(id)).catch(() => null),
      ]);

      setPnm(pnmData);
      setAttendance(attendanceData || []);
      setComments(commentsData || []);
      setCoverage(coverageData);
    } catch (e: any) {
      const message = e?.message || "Unable to load PNM profile";
      setError(message);
      toast({ title: "Failed to load PNM", description: message });
    } finally {
      setLoading(false);
    }
  };

  const handleExportGraphic = async () => {
    if (!id || !pnm) return;
    try {
      toast({ title: "Generating...", description: "Creating PNM card image (this may take a moment)" });
      const response = await api<{ url: string }>(`/exports/pnm-card/${id}`, {
        method: "POST",
        timeout: 60000,  // 60 second timeout for graphics generation
      });

      if (response.url) {
        // Detect Safari - Safari has issues with blob downloads and download attribute
        const isSafari = /^((?!chrome|android).)*safari/i.test(navigator.userAgent);

        if (isSafari) {
          // For Safari: open the image URL directly in a new tab
          // User can then long-press or right-click to save
          const newTab = window.open(response.url, "_blank");
          if (!newTab) {
            // Popup was blocked, use same window
            window.location.href = response.url;
          }
          toast({
            title: "Image opened!",
            description: "Long-press or right-click to save the image"
          });
        } else {
          // For Chrome/Firefox: use blob download approach
          const filename = `${pnm.name.replace(/\s+/g, "_")}_graphic.png`;
          const downloaded = await downloadFileForMobile(response.url, filename);
          if (downloaded) {
            toast({ title: "Image downloaded!", description: "Check your downloads folder" });
          } else {
            // Fallback: open in same window
            window.location.href = response.url;
            toast({ title: "Opening image...", description: "File should open for download" });
          }
        }
      } else {
        toast({ title: "Export failed", description: "No image URL returned" });
      }
    } catch (e: any) {
      toast({ title: "Export failed", description: e?.message || "Unable to generate image" });
    }
  };

  const handlePostComment = async () => {
    if (!newComment.trim() || !id) return;
    setPosting(true);
    try {
      const created = await api<Comment>(`/pnms/${id}/notes`, {
        method: "POST",
        body: { pnm_id: id, body: newComment.trim(), anonymous },
      });
      setComments((prev) => [
        {
          ...created,
          body: newComment.trim(),
          created_at: created.created_at || new Date().toISOString(),
          anonymous,
        },
        ...prev,
      ]);
      setNewComment("");
      setAnonymous(false);
      toast({ title: "Comment posted" });
    } catch (e: any) {
      toast({ title: "Failed to post comment", description: e?.message || "Please try again" });
    } finally {
      setPosting(false);
    }
  };

  const yesRate = useMemo(
    () => (pnm?.yes_percentage !== undefined ? `${pnm.yes_percentage}%` : "—"),
    [pnm?.yes_percentage]
  );

  if (loading) {
    return (
      <div className="flex h-[70vh] items-center justify-center text-beta-gray">
        <Loader2 className="mr-2 h-5 w-5 animate-spin" />
        Loading profile...
      </div>
    );
  }

  if (error || !pnm) {
    return (
      <div className="flex h-[70vh] flex-col items-center justify-center gap-3 text-beta-gray">
        <span>{error || "PNM not found"}</span>
        <Button variant="neutral-secondary" onClick={loadProfile}>
          Retry
        </Button>
      </div>
    );
  }

  return (
    <div className="flex h-full w-full flex-col gap-6">
      <div className="flex items-center justify-between">
        <Breadcrumbs>
          <Breadcrumbs.Item>PNMs</Breadcrumbs.Item>
          <Breadcrumbs.Divider />
          <Breadcrumbs.Item active>{pnm.name}</Breadcrumbs.Item>
        </Breadcrumbs>
        <div className="flex items-center gap-2">
          <Button variant="neutral-secondary" icon={<Download className="w-4 h-4" />} onClick={handleExportGraphic}>
            Export Image
          </Button>
        </div>
      </div>

      <div className="flex w-full gap-6 lg:flex-row flex-col">
        <div className="w-full max-w-md space-y-4">
          <div className="rounded-xl border border-beta-gray/30 bg-white p-6 shadow-sm">
            <div className="aspect-square w-full overflow-hidden rounded-lg bg-neutral-100">
              {pnm.photo_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={pnm.photo_url}
                  alt={pnm.name}
                  className="h-full w-full object-cover"
                />
              ) : (
                <div className="flex h-full items-center justify-center text-5xl font-bold text-beta-gray">
                  {pnm.name.slice(0, 2).toUpperCase()}
                </div>
              )}
            </div>
            <div className="mt-4 space-y-2">
              <h2 className="text-2xl font-bold text-beta-navy">{pnm.name}</h2>
              <div className="space-y-1 text-sm text-beta-gray">
                {pnm.hometown && (
                  <div className="flex items-center gap-2">
                    <MapPin className="h-4 w-4" />
                    <span>{pnm.hometown}</span>
                  </div>
                )}
                {pnm.major && (
                  <div className="flex items-center gap-2">
                    <Book className="h-4 w-4" />
                    <span>{pnm.major}</span>
                  </div>
                )}
                {pnm.year && (
                  <div className="flex items-center gap-2">
                    <Calendar className="h-4 w-4" />
                    <span>{pnm.year}</span>
                  </div>
                )}
              </div>
              {pnm.tags && pnm.tags.length > 0 && (
                <div className="flex flex-wrap gap-2 pt-2">
                  {pnm.tags.map((tag) => (
                    <Badge key={tag}>{tag}</Badge>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div className="rounded-xl border border-beta-gray/30 bg-white p-6 shadow-sm">
            <span className="text-sm font-semibold text-beta-navy">Quick Stats</span>
            <div className="mt-4 space-y-3 text-sm text-beta-gray">
              <StatRow label="Yes Rate" value={yesRate} />
              <StatRow
                label="Events Attended"
                value={`${pnm.attendance_count || 0} of ${pnm.total_events || 0}`}
              />
              <StatRow label="Favorites" value={(pnm.favorite_count || 0).toString()} />
            </div>
          </div>

          {/* Who has actually met him. Names rather than a number, because
              "ask Devin" is what makes someone walk over and get a second
              opinion before the vote -- a count on its own prompts nothing. */}
          <div className="rounded-xl border border-beta-gray/30 bg-white p-6 shadow-sm">
            <div className="flex items-center justify-between gap-2">
              <span className="text-sm font-semibold text-beta-navy">Who&apos;s met him</span>
              <MetButton
                size="compact"
                pnmId={String(id)}
                metByMe={Boolean(coverage?.met_by_me)}
                metCount={coverage?.met_count ?? 0}
                onChange={(next) =>
                  setCoverage((current) =>
                    current
                      ? { ...current, met_by_me: next.met_by_me, met_count: next.met_count }
                      : current,
                  )
                }
              />
            </div>

            {coverage && coverage.contacts.length > 0 ? (
              <ul className="mt-4 space-y-2 text-sm text-beta-gray">
                {coverage.contacts.map((contact) => (
                  <li key={contact.user_id} className="flex items-baseline justify-between gap-2">
                    <span className="truncate text-beta-navy">{contact.name ?? "A brother"}</span>
                    {contact.event_name && (
                      <span className="shrink-0 text-xs">{contact.event_name}</span>
                    )}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-4 text-sm text-beta-gray">
                Nobody has logged a conversation with him yet. If you have, tap above — it&apos;s
                what tells the chapter whether a vote on him means anything.
              </p>
            )}
          </div>
        </div>

        <div className="flex-1 space-y-4">
          <Tabs>
            <Tabs.Item active={activeTab === "comments"} onClick={() => setActiveTab("comments")}>
              Notes & Comments
            </Tabs.Item>
            <Tabs.Item active={activeTab === "attendance"} onClick={() => setActiveTab("attendance")}>
              Attendance
            </Tabs.Item>
          </Tabs>

          {activeTab === "comments" && (
            <div className="flex flex-col gap-4 rounded-xl border border-beta-gray/30 bg-white p-6 shadow-sm">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <MessageSquare className="h-4 w-4 text-beta-navy" />
                  <span className="text-lg font-semibold text-beta-navy">Comments</span>
                </div>
                <div className="flex items-center gap-2 text-sm text-beta-gray">
                  <EyeOff className="h-4 w-4" />
                  <span>Anonymous mode</span>
                </div>
              </div>

              <div className="flex flex-col gap-3">
                {comments.length === 0 && (
                  <div className="rounded-lg border border-dashed border-beta-gray/50 p-6 text-center text-beta-gray">
                    No comments yet.
                  </div>
                )}
                {comments.map((comment) => (
                  <div
                    key={comment.id}
                    className="flex flex-col gap-2 border-b border-beta-gray/20 pb-3 last:border-none"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Avatar size="small">{(comment.author || "BR").slice(0, 2)}</Avatar>
                        <div className="flex flex-col">
                          <span className="text-sm font-semibold text-beta-navy">
                            {comment.anonymous ? "Anonymous" : comment.author || "Brother"}
                          </span>
                          <span className="text-xs text-beta-gray">
                            {new Date(comment.created_at).toLocaleString()}
                          </span>
                        </div>
                      </div>
                    </div>
                    <p className="text-sm text-beta-navy">{comment.body}</p>
                  </div>
                ))}
              </div>

              <div className="flex flex-col gap-2">
                <TextArea label="" helpText="">
                  <TextArea.Input
                    value={newComment}
                    placeholder="Add a comment..."
                    onChange={(e) => setNewComment(e.target.value)}
                  />
                </TextArea>
                <div className="flex items-center justify-between text-sm text-beta-gray">
                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={anonymous}
                      onChange={(e) => setAnonymous(e.target.checked)}
                      className="h-4 w-4 rounded border-beta-gray/60 text-beta-navy focus:ring-beta-navy"
                    />
                    Post anonymously
                  </label>
                  <Button size="small" onClick={handlePostComment} disabled={posting}>
                    {posting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    Post Comment
                  </Button>
                </div>
              </div>
            </div>
          )}

          {activeTab === "attendance" && (
            <div className="rounded-xl border border-beta-gray/30 bg-white p-6 shadow-sm">
              <div className="flex items-center gap-2">
                <Users className="h-4 w-4 text-beta-navy" />
                <span className="text-lg font-semibold text-beta-navy">Attendance History</span>
              </div>
              <div className="mt-4 divide-y divide-beta-gray/20">
                {attendance.length === 0 && (
                  <div className="py-8 text-center text-beta-gray">No attendance recorded.</div>
                )}
                {attendance.map((event) => (
                  <div key={event.id} className="flex items-center justify-between py-4">
                    <div className="flex items-center gap-3">
                      <IconWithBackground size="small" variant="success" />
                      <div className="flex flex-col">
                        <span className="text-sm font-semibold text-beta-navy">
                          {event.event_name}
                        </span>
                        <span className="text-xs text-beta-gray">
                          {new Date(event.event_date).toLocaleDateString()}
                        </span>
                      </div>
                    </div>
                    <span className="text-sm text-beta-gray">
                      {event.checked_in_at
                        ? new Date(event.checked_in_at).toLocaleTimeString([], {
                          hour: "2-digit",
                          minute: "2-digit",
                        })
                        : event.status || "—"}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function StatRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between rounded-md bg-neutral-50 px-3 py-2">
      <span className="text-sm text-beta-gray">{label}</span>
      <span className="text-sm font-semibold text-beta-navy">{value}</span>
    </div>
  );
}
