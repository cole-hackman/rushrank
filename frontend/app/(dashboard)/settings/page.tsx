"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { FeatherTrash } from "@subframe/core";
import { Badge } from "@/ui/components/Badge";
import { Breadcrumbs } from "@/ui/components/Breadcrumbs";
import { Button } from "@/ui/components/Button";
import { Checkbox } from "@/ui/components/Checkbox";
import { IconButton } from "@/ui/components/IconButton";
import { TextField } from "@/ui/components/TextField";
import { api } from "@/lib/api";
import { useToast } from "@/components/ToastProvider";
import AdminProtected from "@/components/AdminProtected";

type Questionnaire = {
  id: string;
  chapter_id: string;
  name: string;
  schema: any;
  active: boolean;
  created_at: string;
};

type QuestionField = {
  id?: string;
  question: string;
  type: string;
  required: boolean;
};

export default function SettingsPage() {
  const router = useRouter();
  const { toast } = useToast();
  const [chapterId, setChapterId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  // Questionnaire Builder
  const [questionnaires, setQuestionnaires] = useState<Questionnaire[]>([]);
  const [questions, setQuestions] = useState<QuestionField[]>([]);
  const [newQuestion, setNewQuestion] = useState({ text: "", type: "text", required: false });

  // Export graphics state
  const [exportingGraphics, setExportingGraphics] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      const chapters = await api<{ id: string; name: string }[]>("/chapters");
      const cid = chapters[0]?.id;
      setChapterId(cid || null);

      if (cid) {
        await loadQuestionnaires(cid);
      }
    } catch (e: any) {
      toast({
        title: "Failed to load settings",
        description: e?.message || "Unable to load data",
      });
    } finally {
      setLoading(false);
    }
  };

  const loadQuestionnaires = async (cid: string) => {
    try {
      const data = await api<Questionnaire[]>(`/questionnaires?chapter_id=${cid}`);
      setQuestionnaires(data);
      // Parse questions from first active questionnaire schema
      const active = data.find((q) => q.active);
      if (active?.schema?.questions) {
        setQuestions(active.schema.questions || []);
      } else {
        setQuestions([]);
      }
    } catch (e: any) {
      console.error("Failed to load questionnaires:", e);
    }
  };

  const handleAddQuestion = async () => {
    if (!chapterId || !newQuestion.text.trim()) {
      toast({ title: "Error", description: "Question text is required" });
      return;
    }

    // Ensure we have an active questionnaire
    let activeQuestionnaire = questionnaires.find((q) => q.active);

    if (!activeQuestionnaire) {
      // Create a new questionnaire if none exists
      try {
        activeQuestionnaire = await api<Questionnaire>(`/questionnaires?chapter_id=${chapterId}`, {
          method: "POST",
          body: {
            name: "Default Questionnaire",
            schema: { questions: [] },
            active: true,
          },
        });
        setQuestionnaires([...questionnaires, activeQuestionnaire]);
      } catch (e: any) {
        toast({
          title: "Error",
          description: "Failed to create questionnaire. Please try again.",
        });
        return;
      }
    }

    try {
      const updatedQuestions = [
        ...questions,
        {
          id: `q_${Date.now()}`,
          question: newQuestion.text,
          type: newQuestion.type,
          required: newQuestion.required,
        },
      ];

      await api(`/questionnaires/${activeQuestionnaire.id}?chapter_id=${chapterId}`, {
        method: "PUT",
        body: {
          name: activeQuestionnaire.name,
          schema: {
            questions: updatedQuestions,
          },
          active: activeQuestionnaire.active,
        },
      });

      toast({ title: "Success", description: "Question added successfully" });
      setNewQuestion({ text: "", type: "text", required: false });
      await loadQuestionnaires(chapterId);
    } catch (e: any) {
      toast({
        title: "Failed to add question",
        description: e?.message || "Unable to add question. Please try again.",
      });
    }
  };

  const handleDeleteQuestion = async (questionIndex: number) => {
    if (!chapterId || questionnaires.length === 0) return;

    const activeQuestionnaire = questionnaires.find((q) => q.active) || questionnaires[0];
    if (!activeQuestionnaire) {
      toast({ title: "Error", description: "No active questionnaire found" });
      return;
    }

    try {
      const updatedQuestions = questions.filter((_, idx) => idx !== questionIndex);

      await api(`/questionnaires/${activeQuestionnaire.id}?chapter_id=${chapterId}`, {
        method: "PUT",
        body: {
          name: activeQuestionnaire.name,
          schema: {
            questions: updatedQuestions,
          },
          active: activeQuestionnaire.active,
        },
      });

      toast({ title: "Success", description: "Question deleted successfully" });
      await loadQuestionnaires(chapterId);
    } catch (e: any) {
      toast({
        title: "Failed to delete question",
        description: e?.message || "Unable to delete question. Please try again.",
      });
    }
  };

  return (
    <AdminProtected>
      <div className="flex w-full flex-col gap-6">
        <div className="flex w-full flex-col items-start">
          <Breadcrumbs>
            <Breadcrumbs.Item>Home</Breadcrumbs.Item>
            <Breadcrumbs.Divider />
            <Breadcrumbs.Item active={true}>Settings</Breadcrumbs.Item>
          </Breadcrumbs>
        </div>

        <div className="flex w-full items-center justify-between">
          <div className="flex flex-col items-start gap-1">
            <span className="text-heading-1 font-heading-1 text-default-font">
              Settings
            </span>
            <span className="text-body font-body text-subtext-color">
              Manage PNM intake form questions and access other admin features
            </span>
          </div>
        </div>

        {/* Quick Links */}
        <div className="flex w-full flex-col items-start gap-4 rounded-md border border-solid border-neutral-border bg-white px-6 py-6 shadow-sm">
          <span className="text-heading-2 font-heading-2 text-default-font">
            Admin Pages
          </span>
          <div className="flex w-full items-start gap-4 flex-wrap">
            <Button
              variant="neutral-secondary"
              onClick={() => router.push("/admin/users")}
            >
              User Management
            </Button>
            <Button
              variant="neutral-secondary"
              onClick={() => router.push("/admin/tags")}
            >
              Tag Management
            </Button>
            <Button
              variant="neutral-secondary"
              onClick={() => router.push("/admin/analytics")}
            >
              Analytics
            </Button>
          </div>
        </div>

        {/* Export PNM Graphics */}
        <div className="flex w-full flex-col items-start gap-4 rounded-md border border-solid border-neutral-border bg-white px-6 py-6 shadow-sm">
          <div className="flex w-full items-center justify-between">
            <div className="flex flex-col items-start gap-1">
              <span className="text-heading-2 font-heading-2 text-default-font">
                Export PNM Graphics
              </span>
              <span className="text-body font-body text-subtext-color">
                Generate Instagram-ready graphics for all PNMs (1080×1350 portrait)
              </span>
            </div>
          </div>
          <div className="flex h-px w-full flex-none flex-col items-center gap-2 bg-neutral-border" />
          <div className="flex w-full items-center gap-4">
            <Button
              variant="brand-primary"
              onClick={async () => {
                if (!chapterId) {
                  toast({ title: "Error", description: "No chapter found" });
                  return;
                }
                setExportingGraphics(true);
                try {
                  const result = await api<{ url: string; message: string }>(
                    "/exports/pnm-cards/bulk",
                    {
                      method: "POST",
                      body: { chapter_id: chapterId },
                      timeout: 120000, // 2 minute timeout for large exports
                    }
                  );
                  if (result.url) {
                    // Trigger download
                    const link = document.createElement("a");
                    link.href = result.url;
                    link.download = `pnm_graphics_${new Date().toISOString().split("T")[0]}.zip`;
                    document.body.appendChild(link);
                    link.click();
                    document.body.removeChild(link);
                    toast({
                      title: "Export Complete",
                      description: "ZIP file download started",
                    });
                  }
                } catch (e: any) {
                  toast({
                    title: "Export Failed",
                    description: e?.message || "Failed to generate graphics",
                  });
                } finally {
                  setExportingGraphics(false);
                }
              }}
              disabled={exportingGraphics || !chapterId}
            >
              {exportingGraphics ? (
                <>
                  <span className="animate-spin mr-2">⏳</span>
                  Generating...
                </>
              ) : (
                "Export All PNM Graphics"
              )}
            </Button>
            {exportingGraphics && (
              <span className="text-caption font-caption text-subtext-color">
                This may take a minute for large chapters...
              </span>
            )}
          </div>
        </div>

        {/* Questionnaire Builder */}
        <div className="flex w-full flex-col items-start gap-6 rounded-md border border-solid border-neutral-border bg-white px-8 py-8 shadow-sm">
          <div className="flex w-full items-center justify-between">
            <div className="flex flex-col items-start gap-1">
              <span className="text-heading-2 font-heading-2 text-default-font">
                PNM Intake Form Questions
              </span>
              <span className="text-body font-body text-subtext-color">
                Customize the additional questions shown on the PNM intake form
              </span>
            </div>
          </div>

          <div className="flex h-px w-full flex-none flex-col items-center gap-2 bg-neutral-border" />

          {loading ? (
            <div className="flex h-48 items-center justify-center text-subtext-color w-full">
              Loading questions...
            </div>
          ) : questions.length === 0 ? (
            <div className="flex w-full flex-col items-center justify-center gap-2 rounded-md border border-dashed border-neutral-border bg-neutral-50 px-6 py-12">
              <span className="text-body font-body text-subtext-color text-center">
                No custom questions yet. Add your first question below.
              </span>
            </div>
          ) : (
            <div className="flex w-full flex-col items-start gap-3">
              {questions.map((q, idx) => (
                <div
                  key={idx}
                  className="flex w-full items-center gap-4 rounded-md border border-solid border-neutral-border bg-white px-6 py-4"
                >
                  <div className="flex grow shrink-0 basis-0 flex-col items-start gap-1">
                    <span className="text-body-bold font-body-bold text-default-font">
                      {q.question}
                    </span>
                    <span className="text-caption font-caption text-subtext-color">
                      {q.type} • {q.required ? "Required" : "Optional"}
                    </span>
                  </div>
                  <div className="flex items-center gap-1">
                    <IconButton
                      size="small"
                      icon={<FeatherTrash />}
                      onClick={() => handleDeleteQuestion(idx)}
                    />
                  </div>
                </div>
              ))}
            </div>
          )}

          <div className="flex w-full flex-col items-start gap-4 rounded-md border border-solid border-neutral-border bg-neutral-50 px-6 py-6">
            <span className="text-body-bold font-body-bold text-default-font">
              Add New Question
            </span>
            <div className="flex w-full items-start gap-4 flex-wrap">
              <TextField
                className="min-w-[320px] flex-1"
                label="Question Text"
                helpText=""
              >
                <TextField.Input
                  placeholder=""
                  value={newQuestion.text}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                    setNewQuestion({ ...newQuestion, text: e.target.value })
                  }
                />
              </TextField>
              <div className="flex flex-col items-start gap-2 max-w-[240px] flex-none">
                <label className="text-caption-bold font-caption-bold text-default-font">
                  Field Type
                </label>
                <select
                  value={newQuestion.type}
                  onChange={(e) =>
                    setNewQuestion({ ...newQuestion, type: e.target.value })
                  }
                  className="h-12 w-full rounded-lg border border-beta-gray/60 px-4 bg-white text-beta-navy focus:ring-2 focus:ring-beta-navy focus:border-beta-navy"
                >
                  <option value="text">Text</option>
                  <option value="textarea">Textarea</option>
                  <option value="number">Number</option>
                  <option value="email">Email</option>
                </select>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Checkbox
                label="Required field"
                checked={newQuestion.required}
                onCheckedChange={(checked: boolean) =>
                  setNewQuestion({ ...newQuestion, required: checked })
                }
              />
            </div>
            <div className="flex w-full items-center justify-end gap-2">
              <Button
                variant="neutral-secondary"
                onClick={() =>
                  setNewQuestion({ text: "", type: "text", required: false })
                }
              >
                Clear
              </Button>
              <Button onClick={handleAddQuestion}>Add Question</Button>
            </div>
          </div>
        </div>
      </div>
    </AdminProtected>
  );
}
