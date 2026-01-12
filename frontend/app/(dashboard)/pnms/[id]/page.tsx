"use client";
import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { api } from "@/lib/api";
import { useToast } from "@/components/ToastProvider";
import { MapPin, Book, Calendar, Download, Edit, EyeOff, Trash2, CheckCircle, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { Avatar } from "@/components/subframe/Avatar";
import { Badge } from "@/components/subframe/Badge";
import { Button } from "@/components/subframe/Button";
import { IconButton } from "@/components/subframe/IconButton";
import { Tabs } from "@/components/subframe/Tabs";
import { TextArea } from "@/components/subframe/TextArea";
import { IconWithBackground } from "@/components/subframe/IconWithBackground";

type PNM = {
  id: string;
  name: string;
  major?: string;
  hometown?: string;
  year?: string;
  tags?: string[];
  photo_url?: string | null;
  yes_percentage?: number;
  attendance_count?: number;
  total_events?: number;
  favorite_count?: number;
};

type Comment = {
  id: string;
  text: string;
  created_at: string;
  user_id?: string;
  anonymous: boolean;
};

type AttendanceEvent = {
  id: string;
  event_id: string;
  event_name: string;
  event_date: string;
  checked_in_at: string;
  attended: boolean;
};

type QuestionnaireResponse = {
  question: string;
  answer: string;
};

type Tab = "comments" | "attendance" | "questionnaire";

export default function PNMProfilePage() {
  const params = useParams();
  const { toast } = useToast();
  const [pnm, setPnm] = useState<PNM | null>(null);
  const [activeTab, setActiveTab] = useState<Tab>("comments");
  const [comments, setComments] = useState<Comment[]>([]);
  const [attendance, setAttendance] = useState<AttendanceEvent[]>([]);
  const [questionnaire, setQuestionnaire] = useState<QuestionnaireResponse[]>([]);
  const [newComment, setNewComment] = useState("");
  const [anonymousComment, setAnonymousComment] = useState(false);

  useEffect(() => {
    const pnmId = params?.id as string;
    if (!pnmId) return;

    (async () => {
      try {
        const data = await api<PNM>(`/pnms/${pnmId}`);
        setPnm(data);
        
        // Load comments (notes) from backend
        try {
          const notesData = await api<any[]>(`/pnms/${pnmId}/notes`);
          setComments(
            notesData.map((note) => ({
              id: note.id,
              text: note.text,
              created_at: note.created_at,
              user_id: note.user_id,
              anonymous: note.anonymous || false
            }))
          );
        } catch (e) {
          // Notes might not exist yet
          setComments([]);
        }
        
        // Load attendance history
        try {
          const attendanceData = await api<any[]>(`/pnms/${pnmId}/attendance`);
          setAttendance(
            attendanceData.map((a) => ({
              id: a.id,
              event_id: a.event_id,
              event_name: a.event_name || "Unknown Event",
              event_date: a.event_date || a.created_at,
              checked_in_at: a.checked_in_at,
              attended: true
            }))
          );
        } catch (e) {
          setAttendance([]);
        }
        
        // Load questionnaire responses
        try {
          const questionnaireData = await api<any>(`/pnms/${pnmId}/questionnaire`);
          if (questionnaireData?.answers) {
            const responses: QuestionnaireResponse[] = Object.entries(questionnaireData.answers).map(
              ([q, a]) => ({
                question: q,
                answer: String(a)
              })
            );
            setQuestionnaire(responses);
          }
        } catch (e) {
          setQuestionnaire([]);
        }
      } catch (e: any) {
        toast({ title: "Failed to load PNM", description: e.message });
      }
    })();
  }, [params?.id, toast]);

  const handlePostComment = async () => {
    if (!newComment.trim() || !pnm) return;
    
    try {
      const response = await api<Comment>(`/pnms/${pnm.id}/notes`, {
        method: "POST",
        body: {
          pnm_id: pnm.id,
          text: newComment,
          anonymous: anonymousComment,
          tags: []
        }
      });
      
      setComments([
        {
          id: response.id,
          text: newComment,
          created_at: new Date().toISOString(),
          anonymous: anonymousComment
        },
        ...comments
      ]);
      setNewComment("");
      setAnonymousComment(false);
      toast({ title: "Comment posted" });
    } catch (e: any) {
      toast({ title: "Failed to post comment", description: e.message });
    }
  };

  const handleDeleteComment = async (commentId: string) => {
    if (!confirm("Delete this comment?")) return;
    
    try {
      await api(`/notes/${commentId}`, { method: "DELETE" });
      setComments((prev) => prev.filter((c) => c.id !== commentId));
      toast({ title: "Comment deleted" });
    } catch (e: any) {
      toast({ title: "Failed to delete comment", description: e.message });
    }
  };

  if (!pnm) {
    return (
      <div className="flex items-center justify-center h-96">
        <p className="text-neutral-500">Loading...</p>
      </div>
    );
  }

  const timeAgo = (date: string) => {
    const seconds = Math.floor((Date.now() - new Date(date).getTime()) / 1000);
    if (seconds < 3600) return `${Math.floor(seconds / 60)} hours ago`;
    if (seconds < 86400) return `${Math.floor(seconds / 3600)} hours ago`;
    return `${Math.floor(seconds / 86400)} days ago`;
  };

  const handleExportGraphic = async () => {
    if (!pnm) return;
    try {
      const result = await api<{ url: string }>(`/pnms/${pnm.id}/share-card`, { method: "GET" });
      if (result.url) {
        window.open(result.url, "_blank");
      }
    } catch (e: any) {
      toast({ title: "Export failed", description: e.message });
    }
  };

  return (
    <div className="flex w-full gap-8 mobile:flex-col">
      {/* Left Sidebar - Profile Info */}
      <div className="w-96 flex-none space-y-6 mobile:w-full">
        {/* Profile Card */}
        <div className="rounded-xl border border-beta-gray/30 dark:border-neutral-800 bg-white dark:bg-neutral-900 p-6 space-y-4">
          <div className="aspect-square w-full rounded-xl overflow-hidden bg-neutral-100 dark:bg-neutral-800">
            {pnm.photo_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={pnm.photo_url} alt={pnm.name} className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-6xl font-bold text-neutral-300">
                {pnm.name.slice(0, 2).toUpperCase()}
              </div>
            )}
          </div>

            <div className="space-y-4">
            <div className="space-y-2">
              <h2 className="text-2xl font-bold text-beta-navy dark:text-white">
                {pnm.name}
              </h2>
              <div className="space-y-1">
                {pnm.hometown && (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <MapPin className="w-4 h-4 text-beta-navy/60" />
                    {pnm.hometown}
                  </div>
                )}
                {pnm.major && (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Book className="w-4 h-4 text-beta-navy/60" />
                    {pnm.major}
                  </div>
                )}
                {pnm.year && (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Calendar className="w-4 h-4 text-beta-navy/60" />
                    {pnm.year}
                  </div>
                )}
              </div>
            </div>

            {pnm.tags && pnm.tags.length > 0 && (
              <div className="flex items-center gap-2 flex-wrap">
                {pnm.tags.map((tag) => (
                  <span
                    key={tag}
                    className="px-2 py-1 rounded-full bg-beta-navy/10 text-beta-navy dark:bg-beta-navy/20 dark:text-blue-300 text-xs font-medium"
                  >
                    {tag}
                  </span>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Quick Stats */}
        <div className="rounded-xl border border-beta-gray/30 dark:border-neutral-800 bg-white dark:bg-neutral-900 p-6 space-y-2">
          <h3 className="font-semibold text-beta-navy dark:text-white">Quick Stats</h3>
          <div className="space-y-3 pt-2">
            <div className="flex items-center justify-between py-2">
              <span className="text-sm text-neutral-600 dark:text-neutral-400">Yes Rate</span>
              <span className="text-sm font-semibold text-neutral-900 dark:text-white">
                {pnm.yes_percentage !== undefined ? `${pnm.yes_percentage}%` : "—"}
              </span>
            </div>
            <div className="flex items-center justify-between py-2">
              <span className="text-sm text-neutral-600 dark:text-neutral-400">Events Attended</span>
              <span className="text-sm font-semibold text-neutral-900 dark:text-white">
                {pnm.attendance_count || 0} of {pnm.total_events || 6}
              </span>
            </div>
            <div className="flex items-center justify-between py-2">
              <span className="text-sm text-neutral-600 dark:text-neutral-400">Favorites</span>
              <span className="text-sm font-semibold text-neutral-900 dark:text-white">
                {pnm.favorite_count || 0}
              </span>
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="flex gap-2">
          <Button variant="neutral-secondary" icon={<Edit className="w-4 h-4" />} className="flex-1">
            Edit
          </Button>
          <Button icon={<Download className="w-4 h-4" />} className="flex-1" onClick={handleExportGraphic}>
            Export
          </Button>
        </div>
      </div>

      {/* Right Content - Tabs */}
      <div className="flex-1 space-y-6">
        {/* Tabs */}
        <Tabs>
          <Tabs.Item active={activeTab === "comments"} onClick={() => setActiveTab("comments")}>
            Notes & Comments
          </Tabs.Item>
          <Tabs.Item active={activeTab === "attendance"} onClick={() => setActiveTab("attendance")}>
            Attendance
          </Tabs.Item>
          <Tabs.Item active={activeTab === "questionnaire"} onClick={() => setActiveTab("questionnaire")}>
            Questionnaire
          </Tabs.Item>
        </Tabs>

        {/* Comments Tab */}
        {activeTab === "comments" && (
          <div className="space-y-4">
            <div className="rounded-xl border border-beta-gray/30 dark:border-neutral-800 bg-white dark:bg-neutral-900 p-6 space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold text-beta-navy dark:text-white">Comments</h3>
                <div className="flex items-center gap-2 text-xs text-neutral-500">
                  <EyeOff className="w-4 h-4" />
                  Anonymous mode
                </div>
              </div>

              <div className="space-y-4">
                {comments.map((comment) => (
                  <div
                    key={comment.id}
                    className="border-b border-neutral-200 dark:border-neutral-800 pb-4 last:border-0"
                  >
                    <div className="flex items-start justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <Avatar size="small">BR</Avatar>
                        <div>
                          <div className="text-sm font-semibold text-beta-navy dark:text-white">
                            {comment.anonymous ? "Brother (Anonymous)" : "Brother Name"}
                          </div>
                          <div className="text-xs text-muted-foreground">{timeAgo(comment.created_at)}</div>
                        </div>
                      </div>
                      <IconButton
                        size="small"
                        icon={<Trash2 className="w-4 h-4" />}
                        onClick={() => handleDeleteComment(comment.id)}
                      />
                    </div>
                    <p className="text-sm text-neutral-700 dark:text-neutral-300">{comment.text}</p>
                  </div>
                ))}
              </div>

              <div className="space-y-2 pt-4">
                <TextArea>
                  <TextArea.Input
                    value={newComment}
                    onChange={(e) => setNewComment(e.target.value)}
                    placeholder="Add a comment..."
                  />
                </TextArea>
                <div className="flex items-center justify-between">
                  <label className="flex items-center gap-2 text-xs text-muted-foreground cursor-pointer">
                    <input
                      type="checkbox"
                      checked={anonymousComment}
                      onChange={(e) => setAnonymousComment(e.target.checked)}
                      className="rounded border-beta-gray/50 text-beta-navy focus:ring-beta-navy"
                    />
                    <EyeOff className="w-3 h-3" />
                    Post anonymously
                  </label>
                  <Button size="small" onClick={handlePostComment}>
                    Post Comment
                  </Button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Attendance Tab */}
        {activeTab === "attendance" && (
          <div className="rounded-xl border border-beta-gray/30 dark:border-neutral-800 bg-white dark:bg-neutral-900 p-6">
            <h3 className="text-lg font-semibold text-beta-navy dark:text-white mb-4">
              Attendance History
            </h3>
            <div className="space-y-0">
              {attendance.length === 0 && (
                <p className="text-sm text-neutral-500 py-8 text-center">
                  No attendance records yet.
                </p>
              )}
              {attendance.map((event) => (
                <div
                  key={event.id}
                  className="flex items-center justify-between border-b border-beta-gray/20 dark:border-neutral-800 py-4 last:border-0"
                >
                  <div className="flex items-center gap-3">
                    <IconWithBackground
                      variant="success"
                      size="small"
                      icon={<CheckCircle className="w-4 h-4" />}
                    />
                    <div>
                      <div className="text-sm font-semibold text-neutral-900 dark:text-white">
                        {event.event_name}
                      </div>
                      <div className="text-xs text-neutral-500">
                        {new Date(event.event_date).toLocaleDateString()}
                      </div>
                    </div>
                  </div>
                  <span className="text-sm text-neutral-600 dark:text-neutral-400">
                    {new Date(event.checked_in_at).toLocaleTimeString([], { 
                      hour: '2-digit', 
                      minute: '2-digit' 
                    })}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Questionnaire Tab */}
        {activeTab === "questionnaire" && (
          <div className="rounded-xl border border-beta-gray/30 dark:border-neutral-800 bg-white dark:bg-neutral-900 p-6">
            <h3 className="text-lg font-semibold text-beta-navy dark:text-white mb-4">
              Questionnaire Responses
            </h3>
            <div className="space-y-4">
              {questionnaire.length === 0 && (
                <p className="text-sm text-neutral-500 py-8 text-center">
                  No questionnaire responses yet.
                </p>
              )}
              {questionnaire.map((item, i) => (
                <div
                  key={i}
                  className="rounded-lg bg-neutral-50 dark:bg-neutral-800/50 p-4 space-y-2"
                >
                  <div className="text-sm font-semibold text-neutral-900 dark:text-white">
                    {item.question}
                  </div>
                  <div className="text-sm text-neutral-600 dark:text-neutral-400">
                    {item.answer}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
