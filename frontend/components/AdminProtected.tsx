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
        const hasAdminRole = profile.memberships?.some((m) => m.role === "admin" || m.role === "ADMIN");
        setIsAdmin(hasAdminRole);
        if (!hasAdminRole) {
          toast({ title: "Access Denied", description: "Admin access required" });
          router.replace("/");
        }
      } catch (e: any) {
        console.error("Failed to check admin status:", e);
        toast({ title: "Access Denied", description: "Unable to verify admin status" });
        router.replace("/");
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

