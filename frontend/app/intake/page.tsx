"use client";
import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { api } from "@/lib/api";
import { useToast } from "@/components/ToastProvider";
import { Label } from "@/components/ui/ui/label";
import { Input } from "@/components/ui/ui/input";
import { Progress } from "@/components/ui/progress";
import { cn, formatPhoneNumber } from "@/lib/utils";
import { Camera, CheckCircle2, AlertCircle, Upload } from "lucide-react";

export default function IntakePage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { toast } = useToast();
  const [chapterId, setChapterId] = useState<string | null>(null);
  const [chapterName, setChapterName] = useState<string | null>(null);
  const isPublicLink = Boolean(searchParams?.get("chapter"));
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [major, setMajor] = useState("");
  const [hometown, setHometown] = useState("");
  const [year, setYear] = useState("");
  const [celebrityCrush, setCelebrityCrush] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [currentStep, setCurrentStep] = useState<1 | 2>(1);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [questionnaireQuestions, setQuestionnaireQuestions] = useState<Array<{ id?: string; question: string; type: string; required: boolean }>>([]);
  const [questionnaireAnswers, setQuestionnaireAnswers] = useState<Record<string, string>>({});

  // This form is handed to a PNM at a rush table, so it has to work while
  // logged out. It used to resolve the chapter by calling the *authenticated*
  // /chapters endpoint, which 401s for an anonymous visitor -- leaving
  // chapterId null and the submit button permanently disabled. The chapter now
  // comes from the URL (?chapter=<uuid>), with the authenticated lookup kept as
  // a fallback for a brother who opens the page from inside the app.
  useEffect(() => {
    (async () => {
      const fromUrl = searchParams?.get("chapter");
      if (fromUrl) {
        try {
          const chapter = await api<{ id: string; name: string }>(`/public/chapters/${fromUrl}`);
          setChapterId(chapter.id);
          setChapterName(chapter.name);
          return;
        } catch (e: any) {
          toast({ title: "Chapter not found", description: "Check the link and try again." });
          return;
        }
      }

      try {
        const chapters = await api<{ id: string; name: string }[]>("/chapters");
        const cid = chapters[0]?.id || null;
        setChapterId(cid);
        setChapterName(chapters[0]?.name ?? null);

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
      } catch {
        toast({
          title: "Open this form from your chapter's link",
          description: "Ask a brother for the intake link, which includes the chapter code.",
        });
      }
    })();
  }, [searchParams, toast]);

  useEffect(() => {
    if (file) {
      const url = URL.createObjectURL(file);
      setPreview(url);
      return () => URL.revokeObjectURL(url);
    }
  }, [file]);

  const validateStep1 = (): boolean => {
    const newErrors: Record<string, string> = {};
    if (!name.trim()) {
      newErrors.name = "Name is required";
    }
    if (!email.trim()) {
      newErrors.email = "Email is required";
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      newErrors.email = "Please enter a valid email address";
    }
    if (!phone.trim()) {
      newErrors.phone = "Phone number is required";
    }
    if (!major.trim()) {
      newErrors.major = "Major is required";
    }
    if (!year.trim()) {
      newErrors.year = "Year is required";
    }
    if (!hometown.trim()) {
      newErrors.hometown = "Hometown is required";
    }
    // Optional on the public form: it is a fun-fact prompt, not a reason to
    // turn away a PNM standing in front of you.
    if (!isPublicLink && !celebrityCrush.trim()) {
      newErrors.celebrityCrush = "Celebrity Crush is required";
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

  // A photo is strongly encouraged -- the PPTX export and voting cards are much
  // worse without one -- but blocking submission on it loses the PNM entirely
  // when a camera permission is denied at a rush table. Encourage, don't gate.
  const validateStep2 = (): boolean => {
    setErrors({});
    return true;
  };

  // Check if form is valid for button state
  const isFormValid = (): boolean => {
    if (!chapterId) return false;
    if (!name.trim()) return false;
    if (!email.trim()) return false;
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) return false;
    if (!phone.trim()) return false;
    if (!major.trim()) return false;
    if (!year.trim()) return false;
    if (!hometown.trim()) return false;
    if (!isPublicLink && !celebrityCrush.trim()) return false;

    // Check questionnaire required fields
    for (let idx = 0; idx < questionnaireQuestions.length; idx++) {
      const q = questionnaireQuestions[idx];
      if (q.required) {
        const fieldId = `questionnaire-${q.id || idx}`;
        if (!questionnaireAnswers[fieldId] || !questionnaireAnswers[fieldId].trim()) {
          return false;
        }
      }
    }

    return true;
  };

  const handleNext = () => {
    if (validateStep1()) {
      setCurrentStep(2);
      setErrors({});
    }
  };

  const handleBack = () => {
    setCurrentStep(1);
    setErrors({});
  };

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!chapterId) {
      toast({ title: "No chapter", description: "Join a chapter first" });
      return;
    }

    // Validate step 1 again
    if (!validateStep1()) {
      setCurrentStep(1);
      return;
    }

    // Validate step 2
    if (!validateStep2()) {
      return;
    }

    setSubmitting(true);
    setErrors({});
    try {

      const created = await api<any>(
        isPublicLink
          ? `/public/chapters/${chapterId}/intake`
          : `/pnms?chapter_id=${chapterId}`,
        {
        method: "POST",
        body: {
          name: name.trim(),
          email: email.trim(),
          phone: phone.trim(),
          major: major.trim(),
          hometown: hometown.trim(), // Now required
          year: year.trim(), // Now required
          photo_url: null,
          tags: [],
          fun_fact: celebrityCrush.trim() // Map to legacy field name
        }
      },
      );
      const pnmId = created.id as string;

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
          // Don't fail the whole operation if questionnaire save fails
        }
      }

      // Photo upload
      if (file) {
        try {
          const up = await api<{ path: string; signed_url: string }>(`/pnms/upload-url`, {
            method: "POST",
            body: { pnm_id: pnmId, filename: file.name }
          });
          const res = await fetch(up.signed_url, {
            method: "PUT",
            headers: { "Content-Type": file.type || "application/octet-stream" },
            body: file
          });
          if (res.ok) {
            const base = process.env.NEXT_PUBLIC_SUPABASE_URL;
            if (base) {
              const publicUrl = `${base}/storage/v1/object/public/pnm-photos/${up.path}`;
              const current = await api<any>(`/pnms/${pnmId}`);
              await api(`/pnms/${pnmId}`, {
                method: "PUT",
                body: { ...current, photo_url: publicUrl }
              });
            }
          } else {
            throw new Error("Upload failed");
          }
        } catch (photoError: any) {
          console.error("Photo upload failed:", photoError);
          toast({
            title: "Photo upload failed",
            description: "PNM created but photo upload failed. Please try adding it later."
          });
        }
      }

      toast({ title: "PNM created successfully!" });
      setSuccess(true);
      setTimeout(() => {
        router.replace("/pnms");
      }, 2000);
    } catch (e: any) {
      console.error("PNM creation error:", e);
      const errorMessage = e?.message || e?.toString() || "Unknown error occurred";
      toast({
        title: "Intake failed",
        description: errorMessage.includes("admin")
          ? "You need admin access to create PNMs. Please contact your chapter administrator."
          : errorMessage
      });
    } finally {
      setSubmitting(false);
    }
  }

  if (success) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-beta-surface dark:from-neutral-950 dark:to-neutral-900 py-12 px-4">
        <div className="max-w-md w-full mx-auto rounded-2xl p-8 text-center bg-white dark:bg-black border border-beta-gray/30 shadow-lg">
          <div className="mb-6">
            <div className="w-20 h-20 mx-auto rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center mb-4">
              <CheckCircle2 className="w-12 h-12 text-green-600 dark:text-green-400" />
            </div>
            <h2 className="font-bold text-2xl text-beta-navy dark:text-neutral-200 mb-2">
              Success!
            </h2>
            <p className="text-beta-gray">
              PNM has been added successfully.
            </p>
            <p className="text-sm text-beta-gray mt-2">
              Redirecting to PNMs page...
            </p>
          </div>
          <Progress value={100} className="h-2" />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-beta-surface dark:from-neutral-950 dark:to-neutral-900 py-6 md:py-12 px-4">
      <div className="max-w-2xl w-full mx-auto rounded-2xl p-6 md:p-8 shadow-lg bg-white dark:bg-black border border-beta-gray/30 dark:border-neutral-800">
        {/* Header */}
        <div className="mb-6">
          <h2 className="font-bold text-2xl text-beta-navy dark:text-neutral-200">
            PNM Intake Form
          </h2>
          <p className="text-muted-foreground text-sm max-w-sm mt-2">
            Add a new potential new member to the system
          </p>
        </div>

        {/* Progress Indicator */}
        <div className="mb-6">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-semibold text-beta-navy">
              Step {currentStep} of 2
            </span>
            <span className="text-xs text-beta-gray">
              {currentStep === 1 ? "Personal Info" : "Photo & Details"}
            </span>
          </div>
          <Progress value={(currentStep / 2) * 100} className="h-2" />
        </div>

        <form className="space-y-6" onSubmit={onSubmit}>
          {/* Step 1: Personal Info */}
          {currentStep === 1 && (
            <div className="space-y-6">
              <div className="space-y-4">
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

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <LabelInputContainer>
                    <Label htmlFor="email">Email *</Label>
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
                      required
                    />
                    {errors.email && (
                      <div className="flex items-center gap-1.5 text-red-600 text-sm mt-1">
                        <AlertCircle className="h-4 w-4" />
                        <span>{errors.email}</span>
                      </div>
                    )}
                  </LabelInputContainer>

                  <LabelInputContainer>
                    <Label htmlFor="phone">Phone *</Label>
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
                      required
                    />
                    {errors.phone && (
                      <div className="flex items-center gap-1.5 text-red-600 text-sm mt-1">
                        <AlertCircle className="h-4 w-4" />
                        <span>{errors.phone}</span>
                      </div>
                    )}
                  </LabelInputContainer>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
                    <Label htmlFor="year">Year *</Label>
                    <select
                      id="year"
                      value={year}
                      onChange={(e) => {
                        setYear(e.target.value);
                        if (errors.year) setErrors({ ...errors, year: "" });
                      }}
                      className={cn(
                        "h-12 text-base px-4 rounded-lg border border-beta-gray/60 bg-white text-beta-navy focus:ring-2 focus:ring-beta-navy focus:border-beta-navy w-full",
                        errors.year && "border-red-500 focus:border-red-500 focus:ring-red-500"
                      )}
                      required
                    >
                      <option value="">Select year</option>
                      <option value="1st">1st Year</option>
                      <option value="2nd">2nd Year</option>
                      <option value="3rd">3rd Year</option>
                      <option value="4th">4th Year</option>
                    </select>
                    {errors.year && (
                      <div className="flex items-center gap-1.5 text-red-600 text-sm mt-1">
                        <AlertCircle className="h-4 w-4" />
                        <span>{errors.year}</span>
                      </div>
                    )}
                  </LabelInputContainer>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <LabelInputContainer>
                    <Label htmlFor="hometown">Hometown *</Label>
                    <Input
                      id="hometown"
                      placeholder=""
                      type="text"
                      value={hometown}
                      onChange={(e) => {
                        setHometown(e.target.value);
                        if (errors.hometown) setErrors({ ...errors, hometown: "" });
                      }}
                      className={cn(
                        "h-12 text-base py-4",
                        errors.hometown && "border-red-500 focus:border-red-500 focus:ring-red-500"
                      )}
                      required
                    />
                    {errors.hometown && (
                      <div className="flex items-center gap-1.5 text-red-600 text-sm mt-1">
                        <AlertCircle className="h-4 w-4" />
                        <span>{errors.hometown}</span>
                      </div>
                    )}
                  </LabelInputContainer>

                  <LabelInputContainer>
                    <Label htmlFor="celebrityCrush">Celebrity Crush *</Label>
                    <Input
                      id="celebrityCrush"
                      placeholder=""
                      type="text"
                      value={celebrityCrush}
                      onChange={(e) => {
                        setCelebrityCrush(e.target.value);
                        if (errors.celebrityCrush) setErrors({ ...errors, celebrityCrush: "" });
                      }}
                      className={cn(
                        "h-12 text-base py-4",
                        errors.celebrityCrush && "border-red-500 focus:border-red-500 focus:ring-red-500"
                      )}
                      required
                    />
                    {errors.celebrityCrush && (
                      <div className="flex items-center gap-1.5 text-red-600 text-sm mt-1">
                        <AlertCircle className="h-4 w-4" />
                        <span>{errors.celebrityCrush}</span>
                      </div>
                    )}
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
                          ) : q.type === "number" ? (
                            <Input
                              id={fieldId}
                              type="number"
                              value={questionnaireAnswers[fieldId] || ""}
                              onChange={(e) => setQuestionnaireAnswers({ ...questionnaireAnswers, [fieldId]: e.target.value })}
                              className={cn(
                                "h-12 text-base py-4",
                                errors[fieldId] && "border-red-500 focus:border-red-500 focus:ring-red-500"
                              )}
                              required={q.required}
                              placeholder=""
                            />
                          ) : (
                            <Input
                              id={fieldId}
                              type="text"
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

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={handleNext}
                  className="flex-1 bg-beta-navy hover:bg-beta-navy/90 text-white rounded-lg h-12 font-medium shadow-sm transition-all focus:outline-none focus:ring-2 focus:ring-beta-navy focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed min-h-[44px]"
                >
                  Next: Photo & Details →
                </button>
              </div>
            </div>
          )}

          {/* Step 2: Photo & Details */}
          {currentStep === 2 && (
            <div className="space-y-6">
              <div className="space-y-4">
                <LabelInputContainer>
                  <Label htmlFor="photo">Photo *</Label>
                  <div className="space-y-3">
                    <label className="flex-1 block">
                      <input
                        type="file"
                        accept="image/*"
                        capture="environment"
                        onChange={async (e) => {
                          const selectedFile = e.target.files?.[0];
                          if (selectedFile) {
                            setFile(selectedFile);
                            const newErrors = { ...errors };
                            delete newErrors.file;
                            setErrors(newErrors);

                            // On iOS, photos taken with capture attribute should save automatically
                            // For other platforms, try to save if File System Access API is available
                            if (selectedFile && 'showSaveFilePicker' in window && !/iPhone|iPad|iPod/i.test(navigator.userAgent)) {
                              try {
                                const fileHandle = await (window as any).showSaveFilePicker({
                                  suggestedName: `PNM_${Date.now()}.jpg`,
                                  types: [{
                                    description: 'Image files',
                                    accept: { 'image/*': ['.jpg', '.jpeg', '.png'] }
                                  }]
                                });
                                const writable = await fileHandle.createWritable();
                                await writable.write(selectedFile);
                                await writable.close();
                              } catch (err: any) {
                                // User cancelled or API not available - that's okay
                                if (err.name !== 'AbortError') {
                                  console.log('Could not save to device:', err);
                                }
                              }
                            }
                          }
                        }}
                        className="hidden"
                        id="photo-upload"
                      />
                      <div className={cn(
                        "flex items-center justify-center gap-2 rounded-lg border border-dashed border-beta-gray/60 bg-white px-4 py-8 text-sm font-medium text-beta-navy hover:bg-beta-navy/5 cursor-pointer transition-colors min-h-[120px]",
                        errors.file && "border-red-500 bg-red-50"
                      )}>
                        <div className="flex flex-col items-center gap-2">
                          <Upload className="h-8 w-8 text-beta-gray" />
                          <span className="text-base">Upload Photo</span>
                          <span className="text-xs text-beta-gray">Take photo or choose from library</span>
                        </div>
                      </div>
                    </label>

                    {preview && (
                      <div className="relative w-full max-w-xs mx-auto aspect-square rounded-lg overflow-hidden border-2 border-beta-gray/30 shadow-sm">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={preview} alt="Preview" className="w-full h-full object-cover" />
                        <button
                          type="button"
                          onClick={() => {
                            setFile(null);
                            setPreview(null);
                            const uploadInput = document.getElementById("photo-upload") as HTMLInputElement;
                            if (uploadInput) uploadInput.value = "";
                          }}
                          className="absolute top-2 right-2 bg-red-600 text-white rounded-full p-1.5 hover:bg-red-700 transition-colors min-h-[44px] min-w-[44px] flex items-center justify-center"
                          aria-label="Remove photo"
                        >
                          ×
                        </button>
                      </div>
                    )}
                    {errors.file && (
                      <div className="flex items-center gap-1.5 text-red-600 text-sm mt-1 justify-center">
                        <AlertCircle className="h-4 w-4" />
                        <span>{errors.file}</span>
                      </div>
                    )}
                    {/* iOS Photo Save Guidance */}
                    {preview && /iPhone|iPad|iPod/i.test(navigator.userAgent) && (
                      <div className="mt-3 p-3 rounded-lg bg-blue-50 border border-blue-200">
                        <p className="text-sm text-blue-800 font-medium mb-2">📱 Save to Camera Roll</p>
                        <p className="text-xs text-blue-700 mb-2">
                          Photos taken via browser don't auto-save on iOS. Long-press the image above, then tap "Add to Photos" to save a copy.
                        </p>
                      </div>
                    )}
                  </div>
                </LabelInputContainer>
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={handleBack}
                  className="flex-1 bg-white border border-beta-gray/30 hover:bg-beta-navy/5 text-beta-navy rounded-lg h-12 font-medium shadow-sm transition-all focus:outline-none focus:ring-2 focus:ring-beta-navy focus:ring-offset-2 min-h-[44px]"
                >
                  ← Back
                </button>
                <button
                  type="submit"
                  disabled={submitting || !chapterId || !isFormValid()}
                  className="flex-1 bg-beta-navy hover:bg-beta-navy/90 text-white rounded-lg h-12 font-medium shadow-sm transition-all focus:outline-none focus:ring-2 focus:ring-beta-navy focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed min-h-[44px]"
                >
                  {submitting ? "Creating..." : "Add PNM"}
                </button>
              </div>
            </div>
          )}
        </form>
      </div>
    </div>
  );
}

const BottomGradient = () => {
  return (
    <>
      <span className="group-hover/btn:opacity-100 block transition duration-500 opacity-0 absolute h-px w-full -bottom-px inset-x-0 bg-gradient-to-r from-transparent via-cyan-500 to-transparent" />
      <span className="group-hover/btn:opacity-100 blur-sm block transition duration-500 opacity-0 absolute h-px w-1/2 mx-auto -bottom-px inset-x-10 bg-gradient-to-r from-transparent via-indigo-500 to-transparent" />
    </>
  );
};

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
