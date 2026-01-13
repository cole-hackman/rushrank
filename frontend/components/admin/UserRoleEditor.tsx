"use client";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { ChevronDown, Check } from "lucide-react";

/**
 * UserRoleEditor - Dropdown component for changing user roles
 * Shows current role and allows selection of new role
 */
type Role = "admin" | "member" | "observer";

interface UserRoleEditorProps {
  currentRole: string;
  membershipId: string;
  chapterId: string;
  onRoleChange: (membershipId: string, newRole: Role) => Promise<void>;
  disabled?: boolean;
}

const ROLE_LABELS: Record<string, string> = {
  admin: "Admin",
  member: "Member",
  observer: "Observer",
};

const ROLE_COLORS: Record<string, string> = {
  admin: "bg-red-50 text-red-700 border-red-200",
  member: "bg-blue-50 text-blue-700 border-blue-200",
  observer: "bg-gray-50 text-gray-700 border-gray-200",
};

export function UserRoleEditor({
  currentRole,
  membershipId,
  chapterId,
  onRoleChange,
  disabled = false,
}: UserRoleEditorProps) {
  const [open, setOpen] = useState(false);
  const [updating, setUpdating] = useState(false);

  const handleRoleSelect = async (newRole: Role) => {
    if (newRole === currentRole || updating) return;
    
    setUpdating(true);
    try {
      await onRoleChange(membershipId, newRole);
      setOpen(false);
    } catch (e) {
      console.error("Failed to update role:", e);
    } finally {
      setUpdating(false);
    }
  };

  const roles: Role[] = ["admin", "member", "observer"];

  return (
    <div className="relative">
      <button
        onClick={() => !disabled && !updating && setOpen(!open)}
        disabled={disabled || updating}
        className={cn(
          "flex items-center gap-2 rounded-lg border px-3 py-1.5 text-sm font-medium transition-colors",
          ROLE_COLORS[currentRole] || ROLE_COLORS.member,
          (disabled || updating) && "opacity-50 cursor-not-allowed",
          !disabled && !updating && "hover:opacity-80"
        )}
      >
        <span>{ROLE_LABELS[currentRole] || currentRole}</span>
        {!disabled && !updating && (
          <ChevronDown className={cn("h-3.5 w-3.5 transition-transform", open && "rotate-180")} />
        )}
        {updating && <span className="text-xs">Updating...</span>}
      </button>

      {open && !disabled && (
        <>
          <div
            className="fixed inset-0 z-10"
            onClick={() => setOpen(false)}
          />
          <div className="absolute top-full left-0 z-20 mt-1 w-48 rounded-lg border border-beta-gray/30 bg-white shadow-lg">
            {roles.map((role) => (
              <button
                key={role}
                onClick={() => handleRoleSelect(role)}
                className={cn(
                  "flex w-full items-center justify-between px-3 py-2 text-left text-sm transition-colors",
                  role === currentRole
                    ? "bg-beta-navy/10 text-beta-navy font-medium"
                    : "text-beta-navy hover:bg-beta-navy/5",
                  role !== roles[roles.length - 1] && "border-b border-beta-gray/20"
                )}
              >
                <span>{ROLE_LABELS[role]}</span>
                {role === currentRole && <Check className="h-4 w-4" />}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

