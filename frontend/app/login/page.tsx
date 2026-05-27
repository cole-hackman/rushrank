"use client";

import React, { useState, useEffect, Suspense } from "react";
import { Button } from "@/ui/components/Button";
import { TextField } from "@/ui/components/TextField";
import { useRouter, useSearchParams } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import ToastProvider, { useToast } from "@/components/ToastProvider";

function RushRankLogin() {
  return (
    <ToastProvider>
      <Suspense fallback={<div className="flex h-screen items-center justify-center">Loading...</div>}>
        <LoginInner />
      </Suspense>
    </ToastProvider>
  );
}

function LoginInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { toast } = useToast();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [isResetting, setIsResetting] = useState(false);
  const devMode = !supabase;

  // Check if we're in password reset mode
  useEffect(() => {
    // Check URL hash for recovery token (Supabase puts it in the hash)
    const hash = window.location.hash;
    const hasRecoveryToken = hash.includes("type=recovery") || hash.includes("access_token=");

    if (hasRecoveryToken || searchParams.get("reset") === "true") {
      setIsResetting(true);

      // If there's a recovery token in the hash, Supabase needs to process it
      // This happens automatically when the page loads if Supabase client is initialized
      if (hasRecoveryToken && supabase) {
        // Supabase will automatically extract the token from the hash
        // We just need to show the reset form
        // Clear the hash after processing to clean up the URL
        window.history.replaceState(null, "", window.location.pathname + "?reset=true");
      }
    }
  }, [searchParams, supabase]);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    if (devMode) {
      localStorage.setItem("access_token", "dev-token");
      localStorage.setItem("user_email", email || "dev@rushrank.local");
      toast({ title: "Signed in (dev)", description: "Using local token" });
      router.replace("/");
      return;
    }

    try {
      const { data, error } = await supabase!.auth.signInWithPassword({ email, password });
      if (error || !data.session?.access_token) {
        toast({
          title: "Login failed",
          description: error?.message || "Unknown error",
        });
        return;
      }
      localStorage.setItem("access_token", data.session.access_token);
      localStorage.setItem("user_email", email);
      toast({ title: "Signed in" });
      router.replace("/");
    } catch (err: any) {
      toast({
        title: "Login failed",
        description: err?.message || "An error occurred",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleForgotPassword = async () => {
    if (!email) {
      toast({
        title: "Email required",
        description: "Please enter your email address first",
      });
      return;
    }

    if (devMode) {
      toast({
        title: "Dev mode",
        description: "Password reset not available in dev mode",
      });
      return;
    }

    try {
      const { error } = await supabase!.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/login?reset=true`,
      });
      if (error) {
        toast({
          title: "Reset failed",
          description: error.message,
        });
      } else {
        toast({
          title: "Reset email sent",
          description: "Check your email for password reset instructions",
        });
      }
    } catch (err: any) {
      toast({
        title: "Reset failed",
        description: err?.message || "An error occurred",
      });
    }
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!newPassword || newPassword.length < 6) {
      toast({
        title: "Invalid password",
        description: "Password must be at least 6 characters",
      });
      return;
    }

    if (newPassword !== confirmPassword) {
      toast({
        title: "Passwords don't match",
        description: "New password and confirmation must match",
      });
      return;
    }

    setLoading(true);
    try {
      // First, check if we have a recovery session (from the email link)
      const { data: { session } } = await supabase!.auth.getSession();

      if (!session) {
        // Try to get session from URL hash if it exists
        const hash = window.location.hash;
        if (hash.includes("access_token=")) {
          // Supabase should have processed this, but let's make sure
          // The session should be available now
        } else {
          toast({
            title: "Invalid reset link",
            description: "Please use the link from your password reset email, or request a new one.",
          });
          setLoading(false);
          return;
        }
      }

      // Update password - Supabase will use the recovery session if available
      const { error } = await supabase!.auth.updateUser({
        password: newPassword
      });

      if (error) {
        toast({
          title: "Reset failed",
          description: error.message || "Unable to reset password. Please request a new reset link.",
        });
        return;
      }

      toast({
        title: "Password updated",
        description: "Your password has been changed successfully. You can now sign in.",
      });

      // Clear the reset state and redirect to login
      setIsResetting(false);
      setNewPassword("");
      setConfirmPassword("");
      // Clear URL params
      window.history.replaceState(null, "", "/login");
      router.replace("/login");
    } catch (err: any) {
      toast({
        title: "Reset failed",
        description: err?.message || "An error occurred. Please try requesting a new reset link.",
      });
    } finally {
      setLoading(false);
    }
  };

  // Show password reset form if in reset mode
  if (isResetting) {
    return (
      <div className="flex w-full flex-col items-center justify-center bg-neutral-50 h-screen">
        <div className="flex w-full max-w-[384px] flex-col items-center gap-8 rounded-md border border-solid border-neutral-border bg-white px-12 py-12 shadow-md">
          <div className="flex flex-col items-center gap-2">
            <img
              className="h-16 w-16 flex-none object-cover rounded-full"
              src="/logo.png"
              alt="RushRank"
            />
            <span className="text-heading-1 font-heading-1 text-default-font">Reset Password</span>
            <span className="text-body font-body text-subtext-color text-center">
              Enter your new password
            </span>
          </div>
          <form onSubmit={handleResetPassword} className="flex w-full flex-col items-start gap-6">
            <TextField className="h-auto w-full flex-none" label="New Password" helpText="Must be at least 6 characters">
              <TextField.Input
                type="password"
                placeholder="Enter new password"
                value={newPassword}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setNewPassword(e.target.value)}
                required
              />
            </TextField>
            <TextField className="h-auto w-full flex-none" label="Confirm Password" helpText="">
              <TextField.Input
                type="password"
                placeholder="Confirm new password"
                value={confirmPassword}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setConfirmPassword(e.target.value)}
                required
              />
            </TextField>
            <div className="flex w-full flex-col items-center gap-3">
              <Button
                className="h-10 w-full flex-none"
                size="large"
                type="submit"
                disabled={loading}
              >
                {loading ? "Updating..." : "Update Password"}
              </Button>
              <Button
                className="h-auto w-auto flex-none"
                variant="brand-tertiary"
                size="small"
                onClick={() => {
                  setIsResetting(false);
                  router.replace("/login");
                }}
                type="button"
              >
                Back to Sign In
              </Button>
            </div>
          </form>
          <span className="text-caption font-caption text-subtext-color">
            RushRank
          </span>
        </div>
      </div>
    );
  }

  return (
    <div className="flex w-full flex-col items-center justify-center bg-neutral-50 h-screen">
      <div className="flex w-full max-w-[384px] flex-col items-center gap-8 rounded-md border border-solid border-neutral-border bg-white px-12 py-12 shadow-md">
        <div className="flex flex-col items-center gap-2">
          <img
            className="h-16 w-16 flex-none object-cover rounded-full"
            src="/logo.png"
            alt="RushRank"
          />
          <span className="text-heading-1 font-heading-1 text-default-font">RushRank</span>
          <span className="text-body font-body text-subtext-color text-center">
            Sign in to your account
          </span>
        </div>
        <form onSubmit={onSubmit} className="flex w-full flex-col items-start gap-6">
          <TextField className="h-auto w-full flex-none" label="Email" helpText="">
            <TextField.Input
              type="email"
              placeholder="your.email@example.com"
              value={email}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => setEmail(e.target.value)}
              required
            />
          </TextField>
          <TextField className="h-auto w-full flex-none" label="Password" helpText="">
            <TextField.Input
              type="password"
              placeholder="Enter your password"
              value={password}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => setPassword(e.target.value)}
              required
            />
          </TextField>
          <div className="flex w-full flex-col items-center gap-3">
            <Button
              className="h-10 w-full flex-none"
              size="large"
              type="submit"
              disabled={loading}
            >
              {loading ? "Signing in..." : "Sign in"}
            </Button>
            <Button
              className="h-auto w-auto flex-none"
              variant="brand-tertiary"
              size="small"
              onClick={handleForgotPassword}
              type="button"
            >
              Forgot password?
            </Button>
          </div>
        </form>
        {devMode && (
          <span className="text-caption font-caption text-subtext-color">
            Dev mode: Supabase env not set
          </span>
        )}
        <span className="text-caption font-caption text-subtext-color">
          RushRank
        </span>
      </div>
    </div>
  );
}

export default RushRankLogin;
