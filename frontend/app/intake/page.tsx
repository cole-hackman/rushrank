"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";
import { useToast } from "@/components/ToastProvider";
import { Label } from "@/components/ui/ui/label";
import { Input } from "@/components/ui/ui/input";
import { Progress } from "@/components/ui/progress";
import { cn, formatPhoneNumber } from "@/lib/utils";
import { Camera, CheckCircle2, AlertCircle } from "lucide-react";

export default function IntakePage() {
  const router = useRouter();
  const { toast } = useToast();
  const [chapterId, setChapterId] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [major, setMajor] = useState("");
  const [hometown, setHometown] = useState("");
  const [year, setYear] = useState("");
  const [funFact, setFunFact] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [currentStep, setCurrentStep] = useState<1 | 2>(1);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [questionnaireQuestions, setQuestionnaireQuestions] = useState<Array<{ id?: string; question: string; type: string; required: boolean }>>([]);
  const [questionnaireAnswers, setQuestionnaireAnswers] = useState<Record<string, string>>({});

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
            // Continue without questionnaire
          }
        }
      } catch (e: any) {
        toast({ title: "Failed to load chapter", description: e.message });
      }
    })();
  }, [toast]);

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
    
    // Validate all required fields
    if (!validateStep1()) {
      setCurrentStep(1);
      return;
    }
    
    setSubmitting(true);
    setErrors({});
    try {

      const created = await api<any>(`/pnms?chapter_id=${chapterId}`, {
        method: "POST",
        body: {
          name: name.trim(),
          email: email.trim(),
          phone: phone.trim(),
          major: major.trim(),
          hometown: hometown.trim() || null,
          year: year.trim() || null,
          photo_url: null,
          tags: [],
          fun_fact: funFact.trim() || null
        }
      });
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

      // Optional photo upload - don't fail the whole creation if this fails
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
            toast({ 
              title: "Photo upload skipped", 
              description: "PNM created but photo failed to upload. You can add it later." 
            });
          }
        } catch (photoError: any) {
          // Log but don't fail the whole operation
          console.error("Photo upload failed:", photoError);
          toast({ 
            title: "Photo upload failed", 
            description: "PNM created successfully, but photo couldn't be uploaded. Set up Supabase Storage bucket 'pnm-photos' to enable uploads." 
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
                    <Label htmlFor="year">Year</Label>
                    <select
                      id="year" 
                      value={year}
                      onChange={(e) => setYear(e.target.value)}
                      className="h-12 text-base px-4 rounded-lg border border-beta-gray/60 bg-white text-beta-navy focus:ring-2 focus:ring-beta-navy focus:border-beta-navy w-full"
                    >
                      <option value="">Select year</option>
                      <option value="1st">1st Year</option>
                      <option value="2nd">2nd Year</option>
                      <option value="3rd">3rd Year</option>
                      <option value="4th">4th Year</option>
                    </select>
                  </LabelInputContainer>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
                            // Reset file inputs
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
                  disabled={submitting || !chapterId}
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


