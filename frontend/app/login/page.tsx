"use client";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import ToastProvider, { useToast } from "@/components/ToastProvider";

export default function LoginPage() {
  return (
    <ToastProvider>
      <LoginInner />
    </ToastProvider>
  );
}

function LoginInner() {
  const router = useRouter();
  const { toast } = useToast();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const devMode = !supabase;

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (devMode) {
      localStorage.setItem("access_token", "dev-token");
      localStorage.setItem("user_email", email || "dev@rushrank.local");
      toast({ title: "Signed in (dev)", description: "Using local token" });
      router.replace("/pnms");
      return;
    }
    const { data, error } = await supabase!.auth.signInWithPassword({ email, password });
    if (error || !data.session?.access_token) {
      toast({ title: "Login failed", description: error?.message || "Unknown error" });
      return;
    }
    localStorage.setItem("access_token", data.session.access_token);
    localStorage.setItem("user_email", email);
    toast({ title: "Signed in" });
    router.replace("/pnms");
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="w-full max-w-sm rounded-lg border bg-white p-6 shadow">
        <h1 className="text-xl font-bold mb-4">Sign in to RushRank</h1>
        <form onSubmit={onSubmit} className="space-y-3">
          <div>
            <label className="text-sm">Email</label>
            <Input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
          </div>
          <div>
            <label className="text-sm">Password</label>
            <Input type="password" required value={password} onChange={(e) => setPassword(e.target.value)} />
          </div>
          <Button type="submit" className="w-full">Sign in</Button>
          {devMode && <div className="text-xs text-gray-500">Dev mode: Supabase env not set</div>}
        </form>
      </div>
    </div>
  );
}

