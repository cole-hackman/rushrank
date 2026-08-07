"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";
import { useToast } from "@/components/ToastProvider";

/**
 * AdminProtected - Route protection for admin-only pages
 * Checks /api/me for admin role in any membership
 * Redirects non-admins with toast message
 */
export default function AdminProtected({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const { toast } = useToast();
  const [ready, setReady] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const profile = await api<{ memberships: Array<{ role: string }> }>("/me");
        // `exec` is a real role now (0013 widened the CHECK); it was previously
        // unreachable, which is why exec-only routes behaved as admin-only.
        const hasAdminRole = profile.memberships?.some(
          (m) => ["admin", "exec"].includes(String(m.role).toLowerCase()),
        );
        setIsAdmin(hasAdminRole);
        if (!hasAdminRole) {
          toast({ title: "Access Denied", description: "Admin access required" });
          router.replace("/dashboard");
        }
      } catch (e: any) {
        console.error("Failed to check admin status:", e);
        toast({ title: "Access Denied", description: "Unable to verify admin status" });
        router.replace("/dashboard");
      } finally {
        setReady(true);
      }
    })();
  }, [router, toast]);

  if (!ready) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="text-beta-gray">Checking permissions...</div>
      </div>
    );
  }

  if (!isAdmin) {
    return null; // Will redirect
  }

  return <>{children}</>;
}

