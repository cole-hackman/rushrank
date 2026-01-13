"use client";
import { useRef, useState, useEffect } from "react";
import { api, API_BASE } from "@/lib/api";
import { useToast } from "@/components/ToastProvider";
import { Label } from "@/components/ui/ui/label";
import { Input } from "@/components/ui/ui/input";
import { Button } from "@/ui/components/Button";
import { ArrowLeft, CheckCircle2, QrCode, AlertCircle, Camera } from "lucide-react";
import { cn, formatPhoneNumber } from "@/lib/utils";

interface AddPnmViewProps {
  onBack: () => void;
}

export function AddPnmView({ onBack }: AddPnmViewProps) {
  const { toast } = useToast();
  const [chapterId, setChapterId] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [major, setMajor] = useState("");
  const [hometown, setHometown] = useState("");
  const [year, setYear] = useState("");
  const [funFact, setFunFact] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [createdPnmId, setCreatedPnmId] = useState<string | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [questionnaireQuestions, setQuestionnaireQuestions] = useState<Array<{ id?: string; question: string; type: string; required: boolean }>>([]);
  const [questionnaireAnswers, setQuestionnaireAnswers] = useState<Record<string, string>>({});
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const chapters = await api<{ id: string; name: string }[]>("/chapters");
        const cid = chapters[0]?.id || null;
        setChapterId(cid);

        // Load active questionnaire
        if (cid) {
          try {
            const questionnaires = await api<Array<{ id: string; schema: any; active: boolean }>>(`/questionnaires?chapter_id=${cid}`);
            const active = questionnaires.find((q) => q.active);
            if (active?.schema?.questions) {
              setQuestionnaireQuestions(active.schema.questions || []);
            }
          } catch (e) {
            console.error("Failed to load questionnaire:", e);
          }
        }
      } catch (e: any) {
        toast({ title: "Failed to load chapter", description: e.message });
      }
    })();
  }, [toast]);

  // Handle file preview URL
  useEffect(() => {
    if (file) {
      const url = URL.createObjectURL(file);
      setPreview(url);
      return () => URL.revokeObjectURL(url);
    }
  }, [file]);

  const validate = (): boolean => {
    const newErrors: Record<string, string> = {};
    if (!name.trim()) {
      newErrors.name = "Name is required";
    }
    if (!email.trim() && !phone.trim()) {
      newErrors.email = "Email or phone is required";
      newErrors.phone = "Email or phone is required";
    } else if (email.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      newErrors.email = "Please enter a valid email address";
    }
    if (!major.trim()) {
      newErrors.major = "Major is required";
    }

    // Validate questionnaire required fields
    questionnaireQuestions.forEach((q, idx) => {
      if (q.required) {
        const fieldId = `questionnaire-${q.id || idx}`;
        if (!questionnaireAnswers[fieldId] || !questionnaireAnswers[fieldId].trim()) {
          newErrors[fieldId] = `${q.question} is required`;
        }
      }
    });

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!chapterId) {
      toast({ title: "No chapter", description: "Join a chapter first" });
      return;
    }

    if (!validate()) {
      return;
    }

    setSubmitting(true);
    setErrors({});
    try {
      const created = await api<any>(`/pnms?chapter_id=${chapterId}`, {
        method: "POST",
        body: {
          name: name.trim(),
          email: email.trim() || null,
          phone: phone.trim() || null,
          major: major.trim(),
          hometown: hometown.trim() || null,
          year: year.trim() || null,
          photo_url: null,
          tags: [],
          fun_fact: funFact.trim() || null
        }
      });
      const pnmId = created.id as string;
      setCreatedPnmId(pnmId);

      // Save questionnaire answers if any
      if (questionnaireQuestions.length > 0 && Object.keys(questionnaireAnswers).length > 0) {
        try {
          const questionnaires = await api<Array<{ id: string; active: boolean }>>(`/questionnaires?chapter_id=${chapterId}`);
          const activeQuestionnaire = questionnaires.find((q) => q.active);
          if (activeQuestionnaire) {
            await api(`/pnms/${pnmId}/answers`, {
              method: "POST",
              body: {
                questionnaire_id: activeQuestionnaire.id,
                answers: questionnaireAnswers
              }
            });
          }
        } catch (e) {
          console.error("Failed to save questionnaire answers:", e);
        }
      }

      // Optional photo upload - don't fail the whole creation if this fails
      // Optional photo upload
      if (file) {
        try {
          const formData = new FormData();
          formData.append("file", file);

          const token = localStorage.getItem("access_token");
          const res = await fetch(`${API_BASE}/pnms/${pnmId}/upload-photo`, {
            method: "POST",
            body: formData,
            headers: token ? { Authorization: `Bearer ${token}` } : {}
          });

          if (!res.ok) {
            const text = await res.text();
            console.error("Photo upload failed:", text);
            toast({ title: "Photo upload failed", description: "PNM was added but photo failed to upload" });
          } else {
            // Success - no need to update PNM again as backend does it
            // Just logging for debug
            console.log("Photo uploaded successfully via proxy");
          }
        } catch (photoError: any) {
          console.error("Photo upload error:", photoError);
          toast({ title: "Photo upload error", description: "PNM was added but photo failed to upload" });
        }
      }

      toast({ title: "PNM added successfully!" });
      setSuccess(true);
    } catch (e: any) {
      console.error("PNM creation error:", e);
      const errorMessage = e?.message || e?.toString() || "Unknown error occurred";
      toast({
        title: "Failed to add PNM",
        description: errorMessage.includes("admin")
          ? "You need admin access to create PNMs. Please contact your chapter administrator."
          : errorMessage
      });
    } finally {
      setSubmitting(false);
    }
  }

  const handleAddAnother = () => {
    setName("");
    setEmail("");
    setPhone("");
    setMajor("");
    setHometown("");
    setYear("");
    setFunFact("");
    setQuestionnaireAnswers({});
    setFile(null);
    setPreview(null);
    setSuccess(false);
    setCreatedPnmId(null);
    setErrors({});
  };

  if (success) {
    return (
      <div className="container max-w-none flex h-full w-full flex-col items-start gap-6 bg-default-background py-6">
        <div className="w-full max-w-2xl mx-auto">
          <div className="rounded-xl border border-beta-gray/30 bg-white dark:bg-black p-8 text-center shadow-sm">
            <div className="mb-6">
              <div className="w-20 h-20 mx-auto rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center mb-4">
                <CheckCircle2 className="w-12 h-12 text-green-600 dark:text-green-400" />
              </div>
              <h2 className="font-bold text-2xl text-beta-navy dark:text-neutral-200 mb-2">
                PNM Added ✅
              </h2>
              <p className="text-beta-gray">
                The PNM has been successfully added to the system.
              </p>
            </div>
            <div className="flex flex-col gap-3">
              <Button
                onClick={handleAddAnother}
                size="large"
                className="w-full min-h-[48px] text-base"
              >
                Add Another PNM
              </Button>
              <Button
                onClick={onBack}
                variant="neutral-secondary"
                size="large"
                className="w-full min-h-[48px] text-base"
              >
                Back to Rush
              </Button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="container max-w-none flex h-full w-full flex-col items-start gap-6 bg-default-background py-6">
      <div className="w-full max-w-2xl mx-auto">
        {/* Header */}
        <div className="mb-6">
          <button
            onClick={onBack}
            className="flex items-center gap-2 text-beta-gray hover:text-beta-navy mb-4 min-h-[44px]"
          >
            <ArrowLeft className="h-5 w-5" />
            <span>Back</span>
          </button>
          <h2 className="font-bold text-2xl text-beta-navy dark:text-neutral-200 mb-2">
            Add PNM
          </h2>
          <p className="text-muted-foreground text-sm">
            Hand this screen to the PNM to fill out their information
          </p>
        </div>

        <form className="space-y-6" onSubmit={onSubmit}>
          <div className="rounded-xl border border-beta-gray/30 bg-white dark:bg-black p-6 space-y-4">
            <LabelInputContainer>
              <Label htmlFor="name">Full Name *</Label>
              <Input
                id="name"
                placeholder=""
                type="text"
                value={name}
                onChange={(e) => {
                  setName(e.target.value);
                  if (errors.name) setErrors({ ...errors, name: "" });
                }}
                className={cn(
                  "h-12 text-base py-4",
                  errors.name && "border-red-500 focus:border-red-500 focus:ring-red-500"
                )}
                required
              />
              {errors.name && (
                <div className="flex items-center gap-1.5 text-red-600 text-sm mt-1">
                  <AlertCircle className="h-4 w-4" />
                  <span>{errors.name}</span>
                </div>
              )}
            </LabelInputContainer>

            <div className="grid grid-cols-1 gap-4">
              <LabelInputContainer>
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  placeholder=""
                  type="email"
                  value={email}
                  onChange={(e) => {
                    setEmail(e.target.value);
                    if (errors.email) setErrors({ ...errors, email: "" });
                  }}
                  className={cn(
                    "h-12 text-base py-4",
                    errors.email && "border-red-500 focus:border-red-500 focus:ring-red-500"
                  )}
                />
                {errors.email && (
                  <div className="flex items-center gap-1.5 text-red-600 text-sm mt-1">
                    <AlertCircle className="h-4 w-4" />
                    <span>{errors.email}</span>
                  </div>
                )}
              </LabelInputContainer>

              <LabelInputContainer>
                <Label htmlFor="phone">Phone</Label>
                <Input
                  id="phone"
                  placeholder=""
                  type="tel"
                  value={phone}
                  onChange={(e) => {
                    const formatted = formatPhoneNumber(e.target.value);
                    setPhone(formatted);
                    if (errors.phone) setErrors({ ...errors, phone: "" });
                  }}
                  className={cn(
                    "h-12 text-base py-4",
                    errors.phone && "border-red-500 focus:border-red-500 focus:ring-red-500"
                  )}
                />
                {errors.phone && (
                  <div className="flex items-center gap-1.5 text-red-600 text-sm mt-1">
                    <AlertCircle className="h-4 w-4" />
                    <span>{errors.phone}</span>
                  </div>
                )}
              </LabelInputContainer>
            </div>

            <div className="grid grid-cols-1 gap-4">
              <LabelInputContainer>
                <Label htmlFor="major">Major *</Label>
                <Input
                  id="major"
                  placeholder=""
                  type="text"
                  value={major}
                  onChange={(e) => {
                    setMajor(e.target.value);
                    if (errors.major) setErrors({ ...errors, major: "" });
                  }}
                  className={cn(
                    "h-12 text-base py-4",
                    errors.major && "border-red-500 focus:border-red-500 focus:ring-red-500"
                  )}
                  required
                />
                {errors.major && (
                  <div className="flex items-center gap-1.5 text-red-600 text-sm mt-1">
                    <AlertCircle className="h-4 w-4" />
                    <span>{errors.major}</span>
                  </div>
                )}
              </LabelInputContainer>

              <LabelInputContainer>
                <Label htmlFor="year">Year</Label>
                <select
                  id="year"
                  value={year}
                  onChange={(e) => setYear(e.target.value)}
                  className="h-12 text-base px-4 rounded-lg border border-beta-gray/60 bg-white text-beta-navy focus:ring-2 focus:ring-beta-navy focus:border-beta-navy"
                >
                  <option value="">Select year</option>
                  <option value="1st">1st Year</option>
                  <option value="2nd">2nd Year</option>
                  <option value="3rd">3rd Year</option>
                  <option value="4th">4th Year</option>
                </select>
              </LabelInputContainer>
            </div>

            <div className="grid grid-cols-1 gap-4">
              <LabelInputContainer>
                <Label htmlFor="hometown">Hometown</Label>
                <Input
                  id="hometown"
                  placeholder=""
                  type="text"
                  value={hometown}
                  onChange={(e) => setHometown(e.target.value)}
                  className="h-12 text-base py-4"
                />
              </LabelInputContainer>

              <LabelInputContainer>
                <Label htmlFor="funfact">Fun Fact</Label>
                <Input
                  id="funfact"
                  placeholder=""
                  type="text"
                  value={funFact}
                  onChange={(e) => setFunFact(e.target.value)}
                  className="h-12 text-base py-4"
                />
              </LabelInputContainer>
            </div>

            {/* Dynamic questionnaire fields */}
            {questionnaireQuestions.length > 0 && (
              <div className="space-y-4 mt-4 pt-4 border-t border-beta-gray/30">
                <h3 className="text-lg font-semibold text-beta-navy">Additional Information</h3>
                {questionnaireQuestions.map((q, idx) => {
                  const fieldId = `questionnaire-${q.id || idx}`;
                  return (
                    <LabelInputContainer key={fieldId}>
                      <Label htmlFor={fieldId}>
                        {q.question} {q.required && "*"}
                      </Label>
                      {q.type === "textarea" ? (
                        <textarea
                          id={fieldId}
                          value={questionnaireAnswers[fieldId] || ""}
                          onChange={(e) => setQuestionnaireAnswers({ ...questionnaireAnswers, [fieldId]: e.target.value })}
                          className={cn(
                            "w-full rounded-lg border border-beta-gray/60 px-4 py-3 text-base text-beta-navy focus:ring-2 focus:ring-beta-navy focus:border-beta-navy min-h-[100px]",
                            errors[fieldId] && "border-red-500 focus:border-red-500 focus:ring-red-500"
                          )}
                          required={q.required}
                          placeholder=""
                        />
                      ) : (
                        <Input
                          id={fieldId}
                          type={q.type === "number" ? "number" : "text"}
                          value={questionnaireAnswers[fieldId] || ""}
                          onChange={(e) => setQuestionnaireAnswers({ ...questionnaireAnswers, [fieldId]: e.target.value })}
                          className={cn(
                            "h-12 text-base py-4",
                            errors[fieldId] && "border-red-500 focus:border-red-500 focus:ring-red-500"
                          )}
                          required={q.required}
                          placeholder=""
                        />
                      )}
                      {errors[fieldId] && (
                        <div className="flex items-center gap-1.5 text-red-600 text-sm mt-1">
                          <AlertCircle className="h-4 w-4" />
                          <span>{errors[fieldId]}</span>
                        </div>
                      )}
                    </LabelInputContainer>
                  );
                })}
              </div>
            )}
          </div>

          {/* Photo Upload Section */}
          <div className="rounded-xl border border-beta-gray/30 bg-white dark:bg-black p-6 space-y-4">
            <LabelInputContainer>
              <Label htmlFor="photo">Photo (Optional)</Label>
              <div className="space-y-3">
                <div className="flex flex-col sm:flex-row gap-2">
                  <label className="flex-1">
                    <input
                      type="file"
                      accept="image/*"
                      capture="environment"
                      onChange={(e) => {
                        const selectedFile = e.target.files?.[0];
                        if (selectedFile) {
                          setFile(selectedFile);
                        }
                      }}
                      className="hidden"
                      id="photo-camera"
                    />
                    <div className="flex items-center justify-center gap-2 rounded-lg border border-beta-gray/60 bg-white px-4 py-3 text-sm font-medium text-beta-navy hover:bg-beta-navy/5 cursor-pointer transition-colors min-h-[44px]">
                      <Camera className="h-4 w-4" />
                      <span>Take Photo</span>
                    </div>
                  </label>
                  <label className="flex-1">
                    <input
                      type="file"
                      accept="image/*"
                      onChange={(e) => {
                        const selectedFile = e.target.files?.[0];
                        if (selectedFile) {
                          setFile(selectedFile);
                        }
                      }}
                      className="hidden"
                      id="photo-gallery"
                    />
                    <div className="flex items-center justify-center gap-2 rounded-lg border border-beta-gray/60 bg-white px-4 py-3 text-sm font-medium text-beta-navy hover:bg-beta-navy/5 cursor-pointer transition-colors min-h-[44px]">
                      <span>Choose from Gallery</span>
                    </div>
                  </label>
                </div>
                {preview && (
                  <div className="relative w-full max-w-xs aspect-square rounded-lg overflow-hidden border-2 border-beta-gray/30 shadow-sm">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={preview} alt="Preview" className="w-full h-full object-cover" />
                    <button
                      type="button"
                      onClick={() => {
                        setFile(null);
                        setPreview(null);
                        const cameraInput = document.getElementById("photo-camera") as HTMLInputElement;
                        const galleryInput = document.getElementById("photo-gallery") as HTMLInputElement;
                        if (cameraInput) cameraInput.value = "";
                        if (galleryInput) galleryInput.value = "";
                      }}
                      className="absolute top-2 right-2 bg-red-600 text-white rounded-full p-1.5 hover:bg-red-700 transition-colors min-h-[44px] min-w-[44px] flex items-center justify-center"
                      aria-label="Remove photo"
                    >
                      ×
                    </button>
                  </div>
                )}
                {file && (
                  <p className="text-xs text-beta-gray">
                    Selected: {file.name}
                  </p>
                )}
              </div>
            </LabelInputContainer>
          </div>

          <div className="flex gap-3">
            <Button
              type="button"
              onClick={onBack}
              variant="neutral-secondary"
              size="large"
              className="flex-1 min-h-[48px] text-base"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={submitting || !chapterId}
              size="large"
              className="flex-1 min-h-[48px] text-base"
            >
              {submitting ? "Adding..." : "Add PNM"}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}

const LabelInputContainer = ({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) => {
  return (
    <div className={cn("flex flex-col space-y-2 w-full", className)}>
      {children}
    </div>
  );
};

