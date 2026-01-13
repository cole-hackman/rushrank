"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";
import { useToast } from "@/components/ToastProvider";
import { Button } from "@/ui/components/Button";
import { TextField } from "@/ui/components/TextField";
import { Breadcrumbs } from "@/ui/components/Breadcrumbs";

type UserProfile = {
  id: string;
  email: string;
  name?: string | null;
};

export default function ProfilePage() {
  const router = useRouter();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  useEffect(() => {
    loadProfile();
  }, []);

  const loadProfile = async () => {
    try {
      setLoading(true);
      const data = await api<{ id: string; email: string; name?: string | null; memberships: Array<{ role: string }> }>("/me");
      setProfile(data);
      setName(data.name || "");
      setEmail(data.email || "");
    } catch (e: any) {
      toast({ title: "Failed to load profile", description: e?.message || "Unable to load user profile" });
    } finally {
      setLoading(false);
    }
  };

  const handleSaveProfile = async () => {
    if (!profile) return;

    // Check if there are any changes
    const nameChanged = name.trim() && name.trim() !== profile.name;
    const emailChanged = email.trim() && email.trim() !== profile.email;

    if (!nameChanged && !emailChanged) {
      toast({ title: "No changes", description: "No changes to save" });
      return;
    }

    setSaving(true);
    try {
      // Update user metadata via Supabase auth
      const { supabase } = await import("@/lib/supabaseClient");
      if (!supabase) {
        toast({ title: "Configuration error", description: "Supabase is not configured. Please contact an administrator." });
        return;
      }

      const updates: { email?: string; data?: { name?: string } } = {};

      if (emailChanged) {
        updates.email = email.trim();
      }

      if (nameChanged) {
        updates.data = { name: name.trim() };
      }

      const { error } = await supabase.auth.updateUser(updates);

      if (error) {
        throw error;
      }

      toast({
        title: "Profile updated",
        description: emailChanged
          ? "Your profile has been updated. Check your email to confirm the new address."
          : "Your profile information has been updated"
      });
      await loadProfile();
    } catch (e: any) {
      toast({ title: "Failed to update profile", description: e?.message || "Unable to update profile" });
    } finally {
      setSaving(false);
    }
  };

  const handleChangePassword = async () => {
    if (!newPassword || newPassword.length < 6) {
      toast({ title: "Invalid password", description: "Password must be at least 6 characters" });
      return;
    }

    if (newPassword !== confirmPassword) {
      toast({ title: "Passwords don't match", description: "New password and confirmation must match" });
      return;
    }

    setSaving(true);
    try {
      // Update password via Supabase
      const { supabase } = await import("@/lib/supabaseClient");
      if (!supabase) {
        toast({ title: "Configuration error", description: "Supabase is not configured. Please contact an administrator." });
        return;
      }
      const { error } = await supabase.auth.updateUser({
        password: newPassword
      });

      if (error) {
        throw error;
      }

      toast({ title: "Password updated", description: "Your password has been changed successfully" });
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
    } catch (e: any) {
      toast({ title: "Failed to update password", description: e?.message || "Unable to update password" });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="container max-w-none flex h-full w-full flex-col items-center justify-center gap-6 bg-default-background py-6">
        <p className="text-body font-body text-subtext-color">Loading profile...</p>
      </div>
    );
  }

  return (
    <div className="container max-w-none flex h-full w-full flex-col items-start gap-6 bg-default-background py-6">
      <Breadcrumbs>
        <Breadcrumbs.Item>Home</Breadcrumbs.Item>
        <Breadcrumbs.Divider />
        <Breadcrumbs.Item active={true}>Profile</Breadcrumbs.Item>
      </Breadcrumbs>

      <div className="flex w-full flex-col items-start gap-1">
        <span className="text-heading-1 font-heading-1 text-default-font">
          Profile Settings
        </span>
        <span className="text-body font-body text-subtext-color">
          Manage your account information and preferences
        </span>
      </div>

      <div className="flex w-full flex-col gap-6 rounded-lg border border-solid border-neutral-border bg-white p-6 shadow-sm">
        <div className="flex w-full flex-col items-start gap-1">
          <span className="text-heading-2 font-heading-2 text-default-font">
            Personal Information
          </span>
          <span className="text-body font-body text-subtext-color">
            Update your name and email address
          </span>
        </div>

        <div className="flex w-full flex-col gap-4">
          <TextField label="Name" helpText="Your display name">
            <TextField.Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Enter your name"
            />
          </TextField>

          <TextField label="Email" helpText="Your email address">
            <TextField.Input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Enter your email"
            />
          </TextField>

          <div className="flex w-full items-center justify-end gap-2">
            <Button
              variant="neutral-secondary"
              onClick={() => {
                setName(profile?.name || "");
                setEmail(profile?.email || "");
              }}
            >
              Cancel
            </Button>
            <Button onClick={handleSaveProfile} disabled={saving}>
              {saving ? "Saving..." : "Save Changes"}
            </Button>
          </div>
        </div>
      </div>

      <div className="flex w-full flex-col gap-6 rounded-lg border border-solid border-neutral-border bg-white p-6 shadow-sm">
        <div className="flex w-full flex-col items-start gap-1">
          <span className="text-heading-2 font-heading-2 text-default-font">
            Change Password
          </span>
          <span className="text-body font-body text-subtext-color">
            Update your password to keep your account secure
          </span>
        </div>

        <div className="flex w-full flex-col gap-4">
          <TextField label="New Password" helpText="Must be at least 6 characters">
            <TextField.Input
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              placeholder="Enter new password"
            />
          </TextField>

          <TextField label="Confirm New Password" helpText="Re-enter your new password">
            <TextField.Input
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="Confirm new password"
            />
          </TextField>

          <div className="flex w-full items-center justify-end gap-2">
            <Button
              variant="neutral-secondary"
              onClick={() => {
                setNewPassword("");
                setConfirmPassword("");
              }}
            >
              Cancel
            </Button>
            <Button onClick={handleChangePassword} disabled={saving || !newPassword || !confirmPassword}>
              {saving ? "Updating..." : "Update Password"}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

