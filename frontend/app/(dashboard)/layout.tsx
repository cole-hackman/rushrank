"use client";
import { TopbarWithLeftNav } from "@/components/TopbarWithLeftNav";
import { SubframeCore } from "@/components/SubframeCore";
import { DropdownMenu } from "@/components/DropdownMenu";
import { IconButton } from "@/ui/components/IconButton";
import { Avatar } from "@/ui/components/Avatar";
import { Download, User, Settings, LogOut, Shield, Tag, Users, BarChart3, ListChecks, ScrollText, GitMerge } from "lucide-react";
import { useRouter, usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { signOut } from "@/lib/auth";
import Protected from "@/components/Protected";
import ToastProvider from "@/components/ToastProvider";
import { ThemeProvider } from "@/components/ThemeProvider";
import { ThemeToggleItems } from "@/components/ThemeToggle";
import { ChapterThemeProvider } from "@/components/ChapterThemeProvider";
import Link from "next/link";
import { BottomNav } from "@/components/BottomNav";

const ADMIN_STATUS_CACHE_KEY = "rushapp_admin_status";
const ADMIN_STATUS_CACHE_EXPIRY = 5 * 60 * 1000; // 5 minutes

function getCachedAdminStatus(): boolean | null {
  if (typeof window === "undefined") return null;
  try {
    const cached = localStorage.getItem(ADMIN_STATUS_CACHE_KEY);
    if (!cached) return null;
    
    const { isAdmin, timestamp } = JSON.parse(cached);
    const now = Date.now();
    
    // Check if cache is expired
    if (now - timestamp > ADMIN_STATUS_CACHE_EXPIRY) {
      localStorage.removeItem(ADMIN_STATUS_CACHE_KEY);
      return null;
    }
    
    return isAdmin;
  } catch {
    return null;
  }
}

function setCachedAdminStatus(isAdmin: boolean): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(ADMIN_STATUS_CACHE_KEY, JSON.stringify({
      isAdmin,
      timestamp: Date.now()
    }));
  } catch {
    // Ignore localStorage errors
  }
}

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [isAdmin, setIsAdmin] = useState(false);
  const [adminCheckReady, setAdminCheckReady] = useState(false);

  useEffect(() => {
    // Check cache first
    const cached = getCachedAdminStatus();
    if (cached !== null) {
      setIsAdmin(cached);
      setAdminCheckReady(true);
      return;
    }

    // Fetch from API if not cached
    (async () => {
      try {
        const profile = await api<{ memberships: Array<{ role: string }> }>("/me", { timeout: 15000 });
        const hasAdminRole = profile.memberships?.some((m) => m.role === "admin" || m.role === "ADMIN");
        setIsAdmin(hasAdminRole);
        setCachedAdminStatus(hasAdminRole);
      } catch (e: any) {
        console.error("Failed to check admin status:", e);
        // Don't show error toast for admin check - it's not critical
        setIsAdmin(false);
        setCachedAdminStatus(false);
      } finally {
        setAdminCheckReady(true);
      }
    })();
  }, []);

  const handleLogout = async () => {
    await signOut();
    window.location.href = "/login";
  };

  const getUserInitials = () => {
    if (typeof window === "undefined") return "U";
    const name = localStorage.getItem("user_name");
    const email = localStorage.getItem("user_email");
    const displayName = name || email?.split("@")[0] || "User";
    return displayName.slice(0, 2).toUpperCase();
  };

  const getUserImage = () => {
    // You can add user image URL from localStorage or API if available
    return null;
  };

  // Define mobile navigation items
  const mobileNavItems = [
    { label: "Home", href: "/dashboard" },
    { label: "Rush", href: "/rush" },
    { label: "PNMs", href: "/pnms" },
    { label: "Events", href: "/events" },
    { label: "Voting", href: "/voting" },
    ...(isAdmin
      ? [
          { label: "Bid List", href: "/bid-list" },
          { label: "Settings", href: "/settings" },
          { label: "Tag Management", href: "/admin/tags" },
          { label: "User Management", href: "/admin/users" },
          { label: "Duplicates", href: "/admin/duplicates" },
          { label: "Activity Log", href: "/admin/audit" },
          { label: "Analytics", href: "/analytics" },
        ]
      : []),
  ];

  return (
    <Protected>
      <ThemeProvider>
        <ChapterThemeProvider>
          <ToastProvider>
            <TopbarWithLeftNav
            mobileNavItems={mobileNavItems}
            leftSlot={
              <>
                <Link href="/dashboard">
                  <img
                    className="h-8 w-8 flex-none object-cover rounded-full"
                    src="/logo.png"
                    alt="RushRank"
                  />
                </Link>
                <div className="flex items-center gap-2">
                  <TopbarWithLeftNav.NavItem selected={pathname === "/dashboard"} href="/dashboard">
                    Home
                  </TopbarWithLeftNav.NavItem>
                  <TopbarWithLeftNav.NavItem selected={pathname === "/rush"} href="/rush">
                    Rush
                  </TopbarWithLeftNav.NavItem>
                  <TopbarWithLeftNav.NavItem selected={pathname === "/pnms"} href="/pnms">
                    PNMs
                  </TopbarWithLeftNav.NavItem>
                  <TopbarWithLeftNav.NavItem selected={pathname === "/voting"} href="/voting">
                    Voting
                  </TopbarWithLeftNav.NavItem>
                  <TopbarWithLeftNav.NavItem selected={pathname === "/results"} href="/results">
                    Results
                  </TopbarWithLeftNav.NavItem>
                  <TopbarWithLeftNav.NavItem selected={pathname === "/events"} href="/events">
                    Events
                  </TopbarWithLeftNav.NavItem>
                  {adminCheckReady && isAdmin && (
                    <SubframeCore.DropdownMenu.Root>
                      <SubframeCore.DropdownMenu.Trigger asChild>
                        <button
                          className={`flex items-center gap-1.5 px-3 py-2 text-sm font-medium rounded-lg transition-colors ${pathname?.startsWith("/admin") || pathname === "/settings" || pathname === "/analytics"
                            ? "bg-primary/10 text-primary"
                            : "text-muted-foreground hover:bg-primary/5 hover:text-primary"
                            }`}
                        >
                          <Shield className="h-3.5 w-3.5" />
                          Admin
                        </button>
                      </SubframeCore.DropdownMenu.Trigger>
                      <SubframeCore.DropdownMenu.Portal>
                        <SubframeCore.DropdownMenu.Content
                          side="bottom"
                          align="start"
                          sideOffset={4}
                        >
                          <DropdownMenu.DropdownItem
                            icon={<Settings className="h-4 w-4" />}
                            onClick={() => router.push("/settings")}
                          >
                            Settings
                          </DropdownMenu.DropdownItem>
                          <DropdownMenu.DropdownItem
                            icon={<Tag className="h-4 w-4" />}
                            onClick={() => router.push("/admin/tags")}
                          >
                            Tag Management
                          </DropdownMenu.DropdownItem>
                          <DropdownMenu.DropdownItem
                            icon={<Users className="h-4 w-4" />}
                            onClick={() => router.push("/admin/users")}
                          >
                            User Management
                          </DropdownMenu.DropdownItem>
                          <DropdownMenu.DropdownItem
                            icon={<GitMerge className="h-4 w-4" />}
                            onClick={() => router.push("/admin/duplicates")}
                          >
                            Duplicates
                          </DropdownMenu.DropdownItem>
                          <DropdownMenu.DropdownItem
                            icon={<ListChecks className="h-4 w-4" />}
                            onClick={() => router.push("/bid-list")}
                          >
                            Bid List
                          </DropdownMenu.DropdownItem>
                          <DropdownMenu.DropdownItem
                            icon={<ScrollText className="h-4 w-4" />}
                            onClick={() => router.push("/admin/audit")}
                          >
                            Activity Log
                          </DropdownMenu.DropdownItem>
                          <DropdownMenu.DropdownItem
                            icon={<BarChart3 className="h-4 w-4" />}
                            onClick={() => router.push("/analytics")}
                          >
                            Analytics
                          </DropdownMenu.DropdownItem>
                        </SubframeCore.DropdownMenu.Content>
                      </SubframeCore.DropdownMenu.Portal>
                    </SubframeCore.DropdownMenu.Root>
                  )}
                </div>
              </>
            }
            rightSlot={
              <>
                <SubframeCore.DropdownMenu.Root>
                  <SubframeCore.DropdownMenu.Trigger asChild={true}>
                    <button className="cursor-pointer">
                      <Avatar image={getUserImage() || undefined}>
                        {getUserInitials()}
                      </Avatar>
                    </button>
                  </SubframeCore.DropdownMenu.Trigger>
                  <SubframeCore.DropdownMenu.Portal>
                    <SubframeCore.DropdownMenu.Content
                      side="bottom"
                      align="end"
                      sideOffset={4}
                    >
                      <DropdownMenu.DropdownItem
                        icon={<User className="h-4 w-4" />}
                        onClick={() => router.push("/profile")}
                      >
                        Profile
                      </DropdownMenu.DropdownItem>
                      {isAdmin && (
                        <DropdownMenu.DropdownItem
                          icon={<Settings className="h-4 w-4" />}
                          onClick={() => router.push("/settings")}
                        >
                          Settings
                        </DropdownMenu.DropdownItem>
                      )}
                      <SubframeCore.DropdownMenu.Separator />
                      <SubframeCore.DropdownMenu.Label className="px-2 py-1.5 text-xs font-medium text-neutral-500 dark:text-neutral-400">
                        Theme
                      </SubframeCore.DropdownMenu.Label>
                      <ThemeToggleItems />
                      <DropdownMenu.DropdownItem
                        icon={<Download className="h-4 w-4" />}
                        onClick={() => router.push("/exports")}
                      >
                        Export Center
                      </DropdownMenu.DropdownItem>
                      <SubframeCore.DropdownMenu.Separator />
                      <DropdownMenu.DropdownItem
                        icon={<LogOut className="h-4 w-4" />}
                        onClick={handleLogout}
                      >
                        Log out
                      </DropdownMenu.DropdownItem>
                    </SubframeCore.DropdownMenu.Content>
                  </SubframeCore.DropdownMenu.Portal>
                </SubframeCore.DropdownMenu.Root>
              </>
            }
          >
            <div className="w-full p-6 pb-24 md:pb-6">{children}</div>
          </TopbarWithLeftNav>
          <BottomNav />
            </ToastProvider>
          </ChapterThemeProvider>
        </ThemeProvider>
      </Protected>
  );
}
