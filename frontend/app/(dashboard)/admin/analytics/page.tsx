"use client";

import React, { useEffect, useState, useMemo } from "react";
import { FeatherEdit } from "@subframe/core";
import { FeatherFilter } from "@subframe/core";
import { FeatherMoreHorizontal } from "@subframe/core";
import { FeatherSearch } from "@subframe/core";
import { FeatherShield } from "@subframe/core";
import { FeatherStar } from "@subframe/core";
import { FeatherTrash } from "@subframe/core";
import { FeatherUser } from "@subframe/core";
import { FeatherUserCheck } from "@subframe/core";
import { FeatherUserPlus } from "@subframe/core";
import { FeatherUsers } from "@subframe/core";
import { FeatherUserX } from "@subframe/core";
import * as SubframeCore from "@subframe/core";
import { Avatar } from "@/ui/components/Avatar";
import { Badge } from "@/ui/components/Badge";
import { Breadcrumbs } from "@/ui/components/Breadcrumbs";
import { Button } from "@/ui/components/Button";
import { DropdownMenu } from "@/ui/components/DropdownMenu";
import { IconButton } from "@/ui/components/IconButton";
import { IconWithBackground } from "@/ui/components/IconWithBackground";
import { Table } from "@/ui/components/Table";
import { TextField } from "@/ui/components/TextField";
import { api } from "@/lib/api";
import { useToast } from "@/components/ToastProvider";
import AdminProtected from "@/components/AdminProtected";

type Membership = {
  id: string;
  user_id: string;
  email: string;
  role: string;
  created_at: string | null;
  user_created_at: string | null;
};

function AnalyticsAndReports() {
  const { toast } = useToast();
  const [chapterId, setChapterId] = useState<string | null>(null);
  const [memberships, setMemberships] = useState<Membership[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState<string | null>(null);
  const [inviting, setInviting] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const chapters = await api<{ id: string; name: string }[]>("/chapters");
        setChapterId(chapters[0]?.id || null);
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
    }
  };

  const handleInvite = async () => {
    // Stub: Copy invite link to clipboard
    try {
      const inviteLink = `${window.location.origin}/login`;
      await navigator.clipboard.writeText(inviteLink);
      toast({
        title: "Invite link copied",
        description: "Invite link has been copied to clipboard. Share it with the user.",
      });
    } catch (e: any) {
      toast({ title: "Failed to copy invite", description: e?.message });
    }
  };

  const handleEditRole = (membership: Membership) => {
    // Open role editor modal or dropdown
    // For now, we'll use a simple prompt
    const newRole = prompt("Enter new role (admin, member, observer):", membership.role);
    if (newRole && newRole !== membership.role) {
      handleRoleChange(membership.id, newRole);
    }
  };

  const handleDeactivate = async (membership: Membership) => {
    // For now, change role to observer as a form of deactivation
    if (membership.role !== "observer") {
      await handleRoleChange(membership.id, "observer");
    }
  };

  const handleActivate = async (membership: Membership) => {
    // Activate by changing role to member
    if (membership.role === "observer") {
      await handleRoleChange(membership.id, "member");
    }
  };

  const handleRemove = async (membership: Membership) => {
    if (!confirm(`Are you sure you want to remove ${membership.email}?`)) {
      return;
    }
    // TODO: Implement remove endpoint
    toast({ title: "Remove functionality", description: "Remove endpoint not yet implemented" });
  };

  const filteredMemberships = useMemo(() => {
    let data = memberships;

    // Search filter
    if (search.trim()) {
      const term = search.trim().toLowerCase();
      data = data.filter((m) =>
        m.email.toLowerCase().includes(term)
      );
    }

    // Role filter
    if (roleFilter) {
      data = data.filter((m) => m.role === roleFilter);
    }

    return data;
  }, [memberships, search, roleFilter]);

  const stats = useMemo(() => {
    const total = memberships.length;
    const admins = memberships.filter((m) => m.role === "admin" || m.role === "ADMIN").length;
    const executives = memberships.filter((m) => m.role === "exec" || m.role === "EXEC" || m.role === "member").length;
    const brothers = memberships.filter((m) => m.role === "brother" || m.role === "BROTHER" || m.role === "observer").length;
    return { total, admins, executives, brothers };
  }, [memberships]);

  const getRoleBadge = (role: string) => {
    const normalizedRole = role.toLowerCase();
    if (normalizedRole === "admin" || normalizedRole === "administrator") {
      return <Badge>Admin</Badge>;
    } else if (normalizedRole === "exec" || normalizedRole === "executive" || normalizedRole === "member") {
      return <Badge variant="warning">Executive</Badge>;
    } else {
      return <Badge variant="neutral">Brother</Badge>;
    }
  };

  const getStatusBadge = (membership: Membership) => {
    const normalizedRole = membership.role.toLowerCase();
    if (normalizedRole === "observer") {
      return <Badge variant="neutral">Inactive</Badge>;
    } else {
      return <Badge variant="success">Active</Badge>;
    }
  };

  const formatDate = (dateString: string | null) => {
    if (!dateString) return "—";
    try {
      return new Date(dateString).toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
      });
    } catch {
      return "—";
    }
  };

  const getUserInitials = (email: string) => {
    const parts = email.split("@")[0].split(".");
    if (parts.length >= 2) {
      return (parts[0][0] + parts[1][0]).toUpperCase();
    }
    return email.slice(0, 2).toUpperCase();
  };

  const getRoleFilterLabel = () => {
    if (!roleFilter) return "All Roles";
    const roleMap: Record<string, string> = {
      admin: "Admin",
      member: "Member",
      exec: "Executive",
      executive: "Executive",
      observer: "Observer",
      brother: "Brother",
    };
    return roleMap[roleFilter] || roleFilter;
  };

  return (
    <AdminProtected>
      <div className="flex h-full w-full flex-col items-start bg-default-background overflow-auto">
        <div className="flex w-full items-center justify-between border-b border-solid border-neutral-border px-12 py-4 mobile:px-6 mobile:py-4">
          <Breadcrumbs>
            <Breadcrumbs.Item>RushRank</Breadcrumbs.Item>
            <Breadcrumbs.Divider />
            <Breadcrumbs.Item>Admin</Breadcrumbs.Item>
            <Breadcrumbs.Divider />
            <Breadcrumbs.Item active={true}>User Management</Breadcrumbs.Item>
          </Breadcrumbs>
          <Button
            icon={<FeatherUserPlus />}
            onClick={handleInvite}
          >
            Invite Member
          </Button>
        </div>
        <div className="container max-w-none flex w-full grow shrink-0 basis-0 flex-col items-start gap-8 bg-default-background py-12">
          <div className="flex w-full items-center justify-between">
            <span className="text-heading-1 font-heading-1 text-default-font">
              User Management
            </span>
          </div>
          <div className="flex w-full items-start gap-4 flex-wrap mobile:flex-col mobile:flex-nowrap mobile:gap-4">
            <div className="flex grow shrink-0 basis-0 flex-col items-start gap-2 rounded-md bg-neutral-100 px-6 py-6">
              <div className="flex w-full items-center gap-2">
                <IconWithBackground
                  variant="neutral"
                  size="small"
                  icon={<FeatherUsers />}
                />
                <span className="text-caption-bold font-caption-bold text-subtext-color">
                  TOTAL MEMBERS
                </span>
              </div>
              <span className="text-heading-1 font-heading-1 text-default-font">
                {stats.total}
              </span>
            </div>
            <div className="flex grow shrink-0 basis-0 flex-col items-start gap-2 rounded-md bg-brand-100 px-6 py-6">
              <div className="flex w-full items-center gap-2">
                <IconWithBackground size="small" icon={<FeatherShield />} />
                <span className="text-caption-bold font-caption-bold text-brand-700">
                  ADMINS
                </span>
              </div>
              <span className="text-heading-1 font-heading-1 text-brand-700">
                {stats.admins}
              </span>
            </div>
            <div className="flex grow shrink-0 basis-0 flex-col items-start gap-2 rounded-md bg-warning-100 px-6 py-6">
              <div className="flex w-full items-center gap-2">
                <IconWithBackground
                  variant="warning"
                  size="small"
                  icon={<FeatherStar />}
                />
                <span className="text-caption-bold font-caption-bold text-warning-700">
                  EXECUTIVES
                </span>
              </div>
              <span className="text-heading-1 font-heading-1 text-warning-700">
                {stats.executives}
              </span>
            </div>
            <div className="flex grow shrink-0 basis-0 flex-col items-start gap-2 rounded-md bg-success-100 px-6 py-6">
              <div className="flex w-full items-center gap-2">
                <IconWithBackground
                  variant="success"
                  size="small"
                  icon={<FeatherUser />}
                />
                <span className="text-caption-bold font-caption-bold text-success-700">
                  BROTHERS
                </span>
              </div>
              <span className="text-heading-1 font-heading-1 text-success-700">
                {stats.brothers}
              </span>
            </div>
          </div>
          <div className="flex w-full flex-col items-start gap-4">
            <div className="flex w-full items-center gap-4 mobile:flex-col mobile:flex-nowrap mobile:gap-4">
              <TextField
                className="h-auto grow shrink-0 basis-0"
                variant="filled"
                label=""
                helpText=""
                icon={<FeatherSearch />}
              >
                <TextField.Input
                  placeholder="Search members..."
                  value={search}
                  onChange={(event: React.ChangeEvent<HTMLInputElement>) => {
                    setSearch(event.target.value);
                  }}
                />
              </TextField>
              <div className="flex items-center gap-2">
                <Button
                  variant="neutral-tertiary"
                  icon={<FeatherFilter />}
                  onClick={(event: React.MouseEvent<HTMLButtonElement>) => {
                    // Toggle role filter
                    const roles = ["admin", "member", "exec", "observer", null];
                    const currentIndex = roles.indexOf(roleFilter);
                    const nextIndex = (currentIndex + 1) % roles.length;
                    setRoleFilter(roles[nextIndex] || null);
                  }}
                >
                  {getRoleFilterLabel()}
                </Button>
              </div>
            </div>
          </div>
          <div className="flex w-full flex-col items-start gap-4 overflow-hidden overflow-x-auto">
            {loading ? (
              <div className="flex h-48 items-center justify-center text-subtext-color">
                Loading members...
              </div>
            ) : filteredMemberships.length === 0 ? (
              <div className="flex h-48 items-center justify-center text-subtext-color">
                {search || roleFilter ? "No members match your filters." : "No members yet."}
              </div>
            ) : (
              <Table
                header={
                  <Table.HeaderRow>
                    <Table.HeaderCell>MEMBER</Table.HeaderCell>
                    <Table.HeaderCell>ROLE</Table.HeaderCell>
                    <Table.HeaderCell>STATUS</Table.HeaderCell>
                    <Table.HeaderCell>JOIN DATE</Table.HeaderCell>
                    <Table.HeaderCell />
                  </Table.HeaderRow>
                }
              >
                {filteredMemberships.map((membership) => (
                  <Table.Row key={membership.id}>
                    <Table.Cell>
                      <div className="flex items-center gap-3">
                        <Avatar>
                          {getUserInitials(membership.email)}
                        </Avatar>
                        <div className="flex flex-col items-start">
                          <span className="whitespace-nowrap text-body-bold font-body-bold text-default-font">
                            {membership.email.split("@")[0].replace(/\./g, " ").replace(/\b\w/g, (l) => l.toUpperCase())}
                          </span>
                          <span className="text-caption font-caption text-subtext-color">
                            {membership.email}
                          </span>
                        </div>
                      </div>
                    </Table.Cell>
                    <Table.Cell>
                      {getRoleBadge(membership.role)}
                    </Table.Cell>
                    <Table.Cell>
                      {getStatusBadge(membership)}
                    </Table.Cell>
                    <Table.Cell>
                      <span className="whitespace-nowrap text-body font-body text-subtext-color">
                        {formatDate(membership.created_at)}
                      </span>
                    </Table.Cell>
                    <Table.Cell>
                      <div className="flex items-center justify-end gap-2">
                        <SubframeCore.DropdownMenu.Root>
                          <SubframeCore.DropdownMenu.Trigger asChild={true}>
                            <IconButton
                              size="small"
                              icon={<FeatherMoreHorizontal />}
                              onClick={(
                                event: React.MouseEvent<HTMLButtonElement>
                              ) => { }}
                            />
                          </SubframeCore.DropdownMenu.Trigger>
                          <SubframeCore.DropdownMenu.Portal>
                            <SubframeCore.DropdownMenu.Content
                              side="bottom"
                              align="end"
                              sideOffset={4}
                              asChild={true}
                            >
                              <DropdownMenu>
                                <DropdownMenu.DropdownItem
                                  icon={<FeatherEdit />}
                                  onClick={() => handleEditRole(membership)}
                                >
                                  Edit Role
                                </DropdownMenu.DropdownItem>
                                {membership.role.toLowerCase() === "observer" ? (
                                  <DropdownMenu.DropdownItem
                                    icon={<FeatherUserCheck />}
                                    onClick={() => handleActivate(membership)}
                                  >
                                    Activate
                                  </DropdownMenu.DropdownItem>
                                ) : (
                                  <DropdownMenu.DropdownItem
                                    icon={<FeatherUserX />}
                                    onClick={() => handleDeactivate(membership)}
                                  >
                                    Deactivate
                                  </DropdownMenu.DropdownItem>
                                )}
                                <DropdownMenu.DropdownDivider />
                                <DropdownMenu.DropdownItem
                                  icon={<FeatherTrash />}
                                  onClick={() => handleRemove(membership)}
                                >
                                  Remove
                                </DropdownMenu.DropdownItem>
                              </DropdownMenu>
                            </SubframeCore.DropdownMenu.Content>
                          </SubframeCore.DropdownMenu.Portal>
                        </SubframeCore.DropdownMenu.Root>
                      </div>
                    </Table.Cell>
                  </Table.Row>
                ))}
              </Table>
            )}
          </div>
        </div>
      </div>
    </AdminProtected>
  );
}

export default AnalyticsAndReports;

