"use client";
/**
 * User Management Page
 * 
 * Features:
 * - List all chapter members with stats
 * - Role management (admin/member/observer)
 * - Search and filter by role
 * - Invite member functionality (stub)
 */
import { useEffect, useState, useMemo } from "react";
import { api, getChapterId } from "@/lib/api";
import { useToast } from "@/components/ToastProvider";
import { Button } from "@/ui/components/Button";
import { TextField } from "@/ui/components/TextField";
import { Table } from "@/ui/components/Table";
import { Avatar } from "@/ui/components/Avatar";
import { Badge } from "@/ui/components/Badge";
import { IconWithBackground } from "@/ui/components/IconWithBackground";
import { Breadcrumbs } from "@/ui/components/Breadcrumbs";
import { UserRoleEditor } from "@/components/admin/UserRoleEditor";
import AdminProtected from "@/components/AdminProtected";
import { FeatherSearch, FeatherUsers, FeatherShield, FeatherStar, FeatherUser, FeatherUserPlus, FeatherFilter } from "@subframe/core";
import { cn } from "@/lib/utils";

type Membership = {
  id: string;
  user_id: string;
  email: string;
  role: string;
  created_at: string | null;
  user_created_at: string | null;
};

export default function UsersPage() {
  const { toast } = useToast();
  const [chapterId, setChapterId] = useState<string | null>(null);
  const [memberships, setMemberships] = useState<Membership[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState<string | null>(null);
  const [inviteEmail, setInviteEmail] = useState("");
  const [bulkInviteEmails, setBulkInviteEmails] = useState("");
  const [inviteMode, setInviteMode] = useState<"single" | "bulk">("single");
  const [inviting, setInviting] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const cid = await getChapterId();
        setChapterId(cid);
      } catch (e: any) {
        toast({ title: "Failed to load chapter", description: e?.message });
      }
    })();
  }, [toast]);

  useEffect(() => {
    if (chapterId) {
      loadMemberships();
    }
  }, [chapterId]);

  const loadMemberships = async () => {
    if (!chapterId) return;
    setLoading(true);
    try {
      const data = await api<Membership[]>(`/memberships?chapter_id=${chapterId}`);
      setMemberships(data);
    } catch (e: any) {
      toast({ title: "Failed to load members", description: e?.message });
    } finally {
      setLoading(false);
    }
  };

  const handleRoleChange = async (membershipId: string, newRole: string) => {
    if (!chapterId) return;
    try {
      await api(`/memberships/${membershipId}?chapter_id=${chapterId}`, {
        method: "PUT",
        body: { role: newRole },
      });
      toast({ title: "Role updated", description: `User role changed to ${newRole}` });
      await loadMemberships();
    } catch (e: any) {
      toast({ title: "Failed to update role", description: e?.message });
      throw e;
    }
  };

  const handleInvite = async () => {
    if (!chapterId) {
      toast({ title: "No chapter", description: "Unable to send invitation" });
      return;
    }
    
    setInviting(true);
    try {
      if (inviteMode === "bulk") {
        // Parse emails from textarea (one per line)
        const emailLines = bulkInviteEmails
          .split("\n")
          .map((line) => line.trim())
          .filter((line) => line.length > 0 && line.includes("@"));
        
        if (emailLines.length === 0) {
          toast({ title: "Email required", description: "Please enter at least one valid email address" });
          setInviting(false);
          return;
        }
        
        const response = await api(`/memberships/invite?chapter_id=${chapterId}`, {
          method: "POST",
          body: { emails: emailLines, role: "member" },
        });
        
        const data = response as any;
        const succeeded = data?.data?.succeeded || 0;
        const failed = data?.data?.failed || 0;
        
        if (failed === 0) {
          toast({
            title: "Invitation sent",
            description: `Invitations sent to ${succeeded} member${succeeded !== 1 ? "s" : ""}`,
          });
        } else {
          toast({
            title: "Partial success",
            description: `${succeeded} invitation${succeeded !== 1 ? "s" : ""} sent, ${failed} failed`,
          });
        }
        
        setBulkInviteEmails("");
      } else {
        // Single invite
        if (!inviteEmail.trim()) {
          toast({ title: "Email required", description: "Please enter an email address" });
          setInviting(false);
          return;
        }
        
        await api(`/memberships/invite?chapter_id=${chapterId}`, {
          method: "POST",
          body: { email: inviteEmail.trim(), role: "member" },
        });
        toast({
          title: "Invitation sent",
          description: `Invitation sent to ${inviteEmail}`,
        });
        setInviteEmail("");
      }
      
      await loadMemberships();
    } catch (e: any) {
      toast({ title: "Failed to send invitation", description: e?.message || "Unable to send invitation" });
    } finally {
      setInviting(false);
    }
  };

  const filteredMemberships = useMemo(() => {
    let data = memberships;
    
    // Search filter
    if (search.trim()) {
      const term = search.trim().toLowerCase();
      data = data.filter((m) => m.email.toLowerCase().includes(term));
    }
    
    // Role filter
    if (roleFilter) {
      data = data.filter((m) => m.role === roleFilter);
    }
    
    return data;
  }, [memberships, search, roleFilter]);

  const stats = useMemo(() => {
    const total = memberships.length;
    const admins = memberships.filter((m) => m.role === "admin").length;
    const members = memberships.filter((m) => m.role === "member").length;
    const observers = memberships.filter((m) => m.role === "observer").length;
    return { total, admins, members, observers };
  }, [memberships]);

  const getRoleBadgeVariant = (role: string): "neutral" | "success" | "warning" | "error" => {
    switch (role) {
      case "admin":
        return "error";
      case "member":
        return "success";
      case "observer":
        return "neutral";
      default:
        return "neutral";
    }
  };

  const getRoleLabel = (role: string) => {
    switch (role) {
      case "admin":
        return "Admin";
      case "member":
        return "Member";
      case "observer":
        return "Observer";
      default:
        return role;
    }
  };

  return (
    <AdminProtected>
      <div className="flex w-full flex-col gap-6">
          <div className="flex w-full items-center justify-between">
            <Breadcrumbs>
              <Breadcrumbs.Item>Home</Breadcrumbs.Item>
              <Breadcrumbs.Divider />
              <Breadcrumbs.Item>Admin</Breadcrumbs.Item>
              <Breadcrumbs.Divider />
              <Breadcrumbs.Item active={true}>User Management</Breadcrumbs.Item>
            </Breadcrumbs>
            <div className="flex items-center gap-2 flex-wrap">
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setInviteMode("single")}
                  className={cn(
                    "rounded-md border border-solid px-3 py-1.5 text-caption-bold font-caption-bold transition-colors",
                    inviteMode === "single"
                      ? "border-[#162238ff] bg-[#162238ff] text-white"
                      : "border-neutral-border bg-white text-default-font hover:bg-neutral-50"
                  )}
                >
                  Single
                </button>
                <button
                  onClick={() => setInviteMode("bulk")}
                  className={cn(
                    "rounded-md border border-solid px-3 py-1.5 text-caption-bold font-caption-bold transition-colors",
                    inviteMode === "bulk"
                      ? "border-[#162238ff] bg-[#162238ff] text-white"
                      : "border-neutral-border bg-white text-default-font hover:bg-neutral-50"
                  )}
                >
                  Bulk
                </button>
              </div>
              
              {inviteMode === "single" ? (
                <TextField
                  className="min-w-[240px]"
                  label=""
                  helpText=""
                  icon={<FeatherSearch />}
                >
                  <TextField.Input
                    type="email"
                    placeholder="Email to invite..."
                    value={inviteEmail}
                    onChange={(e) => setInviteEmail(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && handleInvite()}
                  />
                </TextField>
              ) : (
                <div className="flex flex-col gap-1 min-w-[300px]">
                  <textarea
                    className="w-full min-h-[100px] rounded-md border border-solid border-neutral-border bg-white px-3 py-2 text-body font-body text-default-font placeholder:text-subtext-color focus:outline-none focus:ring-2 focus:ring-[#162238ff]"
                    placeholder="email1@example.com&#10;email2@example.com&#10;email3@example.com"
                    value={bulkInviteEmails}
                    onChange={(e) => setBulkInviteEmails(e.target.value)}
                  />
                </div>
              )}
              <Button
                icon={<FeatherUserPlus />}
                onClick={handleInvite}
                disabled={
                  inviting ||
                  (inviteMode === "single" && !inviteEmail.trim()) ||
                  (inviteMode === "bulk" && !bulkInviteEmails.trim())
                }
              >
                {inviting ? "Inviting..." : inviteMode === "bulk" ? "Invite All" : "Invite"}
              </Button>
            </div>
          </div>
          <div className="flex w-full flex-col items-start gap-2">
            <span className="text-heading-1 font-heading-1 text-default-font">User Management</span>
            <span className="text-body font-body text-subtext-color">
              Manage chapter members and roles
            </span>
          </div>

          {/* Stats */}
          <div className="flex w-full items-start gap-4 flex-wrap">
            <div className="flex grow shrink-0 basis-0 flex-col items-start gap-2 rounded-md bg-neutral-100 px-6 py-6">
              <div className="flex w-full items-center gap-2">
                <IconWithBackground variant="neutral" size="small" icon={<FeatherUsers />} />
                <span className="text-caption-bold font-caption-bold text-subtext-color">
                  TOTAL MEMBERS
                </span>
              </div>
              <span className="text-heading-1 font-heading-1 text-default-font">{stats.total}</span>
            </div>
            <div className="flex grow shrink-0 basis-0 flex-col items-start gap-2 rounded-md bg-error-100 px-6 py-6">
              <div className="flex w-full items-center gap-2">
                <IconWithBackground variant="error" size="small" icon={<FeatherShield />} />
                <span className="text-caption-bold font-caption-bold text-error-700">
                  ADMINS
                </span>
              </div>
              <span className="text-heading-1 font-heading-1 text-error-700">{stats.admins}</span>
            </div>
            <div className="flex grow shrink-0 basis-0 flex-col items-start gap-2 rounded-md bg-brand-100 px-6 py-6">
              <div className="flex w-full items-center gap-2">
                <IconWithBackground size="small" icon={<FeatherStar />} />
                <span className="text-caption-bold font-caption-bold text-brand-700">
                  MEMBERS
                </span>
              </div>
              <span className="text-heading-1 font-heading-1 text-brand-700">{stats.members}</span>
            </div>
            <div className="flex grow shrink-0 basis-0 flex-col items-start gap-2 rounded-md bg-neutral-100 px-6 py-6">
              <div className="flex w-full items-center gap-2">
                <IconWithBackground variant="neutral" size="small" icon={<FeatherUser />} />
                <span className="text-caption-bold font-caption-bold text-subtext-color">
                  OBSERVERS
                </span>
              </div>
              <span className="text-heading-1 font-heading-1 text-default-font">{stats.observers}</span>
            </div>
          </div>

          {/* Filters */}
          <div className="flex w-full flex-col items-start gap-4 rounded-md border border-solid border-neutral-border bg-white px-6 py-6 shadow-sm">
            <div className="flex w-full items-center gap-4 flex-wrap">
              <TextField
                className="min-w-[260px] flex-1"
                variant="filled"
                label=""
                helpText=""
                icon={<FeatherSearch />}
              >
                <TextField.Input
                  placeholder="Search by email..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </TextField>
              <div className="flex items-center gap-2">
                <FeatherFilter className="text-body font-body text-subtext-color" />
                <div className="flex gap-1">
                  <button
                    onClick={() => setRoleFilter(null)}
                    className={cn(
                      "rounded-md border border-solid px-3 py-1.5 text-caption-bold font-caption-bold transition-colors",
                      !roleFilter
                        ? "border-[#162238ff] bg-[#162238ff] text-white"
                        : "border-neutral-border bg-white text-default-font hover:bg-neutral-50"
                    )}
                  >
                    All
                  </button>
                  {["admin", "member", "observer"].map((role) => (
                    <button
                      key={role}
                      onClick={() => setRoleFilter(roleFilter === role ? null : role)}
                      className={cn(
                        "rounded-md border border-solid px-3 py-1.5 text-caption-bold font-caption-bold transition-colors",
                        roleFilter === role
                          ? "border-[#162238ff] bg-[#162238ff] text-white"
                          : "border-neutral-border bg-white text-default-font hover:bg-neutral-50"
                      )}
                    >
                      {getRoleLabel(role)}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Members Table */}
          <div className="flex w-full flex-col items-start gap-4 rounded-md border border-solid border-neutral-border bg-white shadow-sm">
            {loading ? (
              <div className="flex h-48 items-center justify-center text-subtext-color w-full">Loading members...</div>
            ) : filteredMemberships.length === 0 ? (
              <div className="flex h-48 flex-col items-center justify-center gap-2 text-center text-subtext-color w-full">
                <span>{search || roleFilter ? "No members match your filters." : "No members yet."}</span>
              </div>
            ) : (
              <Table
                header={
                  <Table.HeaderRow>
                    <Table.HeaderCell>Member</Table.HeaderCell>
                    <Table.HeaderCell>Role</Table.HeaderCell>
                    <Table.HeaderCell>Join Date</Table.HeaderCell>
                    <Table.HeaderCell>Actions</Table.HeaderCell>
                  </Table.HeaderRow>
                }
              >
                {filteredMemberships.map((membership) => (
                  <Table.Row key={membership.id}>
                    <Table.Cell>
                      <div className="flex items-center gap-3">
                        <Avatar size="small">
                          {membership.email.slice(0, 2).toUpperCase()}
                        </Avatar>
                        <div>
                          <div className="text-body-bold font-body-bold text-default-font">{membership.email}</div>
                          <div className="text-caption font-caption text-subtext-color">User ID: {membership.user_id.slice(0, 8)}...</div>
                        </div>
                      </div>
                    </Table.Cell>
                    <Table.Cell>
                      <Badge variant={getRoleBadgeVariant(membership.role) as any}>
                        {getRoleLabel(membership.role)}
                      </Badge>
                    </Table.Cell>
                    <Table.Cell>
                      <span className="text-body font-body text-subtext-color">
                        {membership.created_at
                          ? new Date(membership.created_at).toLocaleDateString()
                          : "—"}
                      </span>
                    </Table.Cell>
                    <Table.Cell>
                      <UserRoleEditor
                        currentRole={membership.role}
                        membershipId={membership.id}
                        chapterId={chapterId || ""}
                        onRoleChange={handleRoleChange}
                      />
                    </Table.Cell>
                  </Table.Row>
                ))}
              </Table>
            )}
          </div>

          <div className="text-body font-body text-subtext-color">
            Showing {filteredMemberships.length} of {memberships.length} members
          </div>
        </div>
    </AdminProtected>
  );
}

