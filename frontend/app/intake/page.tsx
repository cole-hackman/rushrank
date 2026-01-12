"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";
import { useToast } from "@/components/ToastProvider";
import { Label } from "@/components/ui/ui/label";
import { Input } from "@/components/ui/ui/input";
import { cn } from "@/lib/utils";
import { Camera, CheckCircle2 } from "lucide-react";

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

  useEffect(() => {
    (async () => {
      try {
        const chapters = await api<{ id: string; name: string }[]>("/chapters");
        setChapterId(chapters[0]?.id || null);
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

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!chapterId) {
      toast({ title: "No chapter", description: "Join a chapter first" });
      return;
    }
    setSubmitting(true);
    try {
      const created = await api<any>(`/pnms?chapter_id=${chapterId}`, {
        method: "POST",
        body: {
          name,
          email: email || null,
          phone: phone || null,
          major,
          hometown,
          year,
          photo_url: null,
          tags: [],
          walkout_song: null,
          weirdest_talent: funFact || null,
          chick_fil_a_order: null
        }
      });
      const pnmId = created.id as string;

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
      toast({ title: "Intake failed", description: e.message });
    } finally {
      setSubmitting(false);
    }
  }

  if (success) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-beta-surface dark:from-neutral-950 dark:to-neutral-900">
        <div className="max-w-md w-full mx-auto rounded-2xl p-8 text-center">
          <CheckCircle2 className="w-16 h-16 text-green-500 mx-auto mb-4" />
          <h2 className="font-bold text-2xl text-beta-navy dark:text-neutral-200 mb-2">
            Success!
          </h2>
          <p className="text-muted-foreground">
            PNM has been added. Redirecting...
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-beta-surface dark:from-neutral-950 dark:to-neutral-900 py-12 px-4">
      <div className="max-w-2xl w-full mx-auto rounded-2xl p-4 md:p-8 shadow-lg bg-white dark:bg-black border border-beta-gray/30 dark:border-neutral-800">
        <h2 className="font-bold text-2xl text-beta-navy dark:text-neutral-200">
          PNM Intake Form
        </h2>
        <p className="text-muted-foreground text-sm max-w-sm mt-2">
          Add a new potential new member to the system
        </p>

        <form className="my-8" onSubmit={onSubmit}>
          <div className="flex flex-col md:flex-row space-y-2 md:space-y-0 md:space-x-2 mb-4">
            <LabelInputContainer>
              <Label htmlFor="name">Full Name *</Label>
              <Input 
                id="name" 
                placeholder="John Doe" 
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
              />
            </LabelInputContainer>
            <LabelInputContainer>
              <Label htmlFor="year">Year</Label>
              <Input 
                id="year" 
                placeholder="Sophomore" 
                type="text"
                value={year}
                onChange={(e) => setYear(e.target.value)}
              />
            </LabelInputContainer>
          </div>

          <div className="flex flex-col md:flex-row space-y-2 md:space-y-0 md:space-x-2 mb-4">
            <LabelInputContainer>
              <Label htmlFor="email">Email</Label>
              <Input 
                id="email" 
                placeholder="john@example.com" 
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </LabelInputContainer>
            <LabelInputContainer>
              <Label htmlFor="phone">Phone</Label>
              <Input 
                id="phone" 
                placeholder="(555) 123-4567" 
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
              />
            </LabelInputContainer>
          </div>

          <div className="flex flex-col md:flex-row space-y-2 md:space-y-0 md:space-x-2 mb-4">
            <LabelInputContainer>
              <Label htmlFor="major">Major *</Label>
              <Input 
                id="major" 
                placeholder="Computer Science" 
                type="text"
                value={major}
                onChange={(e) => setMajor(e.target.value)}
                required
              />
            </LabelInputContainer>
            <LabelInputContainer>
              <Label htmlFor="hometown">Hometown</Label>
              <Input 
                id="hometown" 
                placeholder="Austin, TX" 
                type="text"
                value={hometown}
                onChange={(e) => setHometown(e.target.value)}
              />
            </LabelInputContainer>
          </div>

          <LabelInputContainer className="mb-4">
            <Label htmlFor="funfact">Fun Fact / Interesting Detail</Label>
            <Input 
              id="funfact" 
              placeholder="Plays guitar and speaks 3 languages" 
              type="text"
              value={funFact}
              onChange={(e) => setFunFact(e.target.value)}
            />
          </LabelInputContainer>

          <LabelInputContainer className="mb-6">
            <Label htmlFor="photo">Photo</Label>
            <div className="relative">
              <Input 
                id="photo" 
                type="file"
                accept="image/*"
                capture="environment"
                onChange={(e) => setFile(e.target.files?.[0] || null)}
                className="cursor-pointer"
              />
              <Camera className="absolute right-3 top-3 w-5 h-5 text-neutral-400 pointer-events-none" />
            </div>
            {preview && (
              <div className="mt-2 relative w-32 h-32 rounded-lg overflow-hidden border border-neutral-200 dark:border-neutral-800">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={preview} alt="Preview" className="w-full h-full object-cover" />
              </div>
            )}
          </LabelInputContainer>

          <button
            className="bg-beta-navy relative group/btn hover:bg-beta-navy/90 block w-full text-white rounded-md h-10 font-medium shadow-sm transition-all focus:outline-none focus:ring-2 focus:ring-beta-navy focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed"
            type="submit"
            disabled={submitting || !chapterId}
          >
            {submitting ? "Creating..." : "Add PNM"} &rarr;
            <BottomGradient />
          </button>
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


