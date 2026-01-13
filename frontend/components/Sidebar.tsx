"use client";
import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Users,
  Vote,
  BarChart3,
  Calendar,
  Settings,
  LayoutDashboard
} from "lucide-react";
import {
  Sidebar as AceternitySidebar,
  SidebarBody,
  SidebarLink
} from "@/components/ui/ui/aceternity-sidebar";
import { cn } from "@/lib/utils";

const links = [
  {
    href: "/",
    label: "Dashboard",
    icon: <LayoutDashboard className="h-5 w-5 flex-shrink-0" />
  },
  {
    href: "/pnms",
    label: "PNMs",
    icon: <Users className="h-5 w-5 flex-shrink-0" />
  },
  {
    href: "/voting",
    label: "Voting",
    icon: <Vote className="h-5 w-5 flex-shrink-0" />
  },
  {
    href: "/results",
    label: "Results",
    icon: <BarChart3 className="h-5 w-5 flex-shrink-0" />
  },
  {
    href: "/events",
    label: "Events",
    icon: <Calendar className="h-5 w-5 flex-shrink-0" />
  },
  {
    href: "/settings",
    label: "Settings",
    icon: <Settings className="h-5 w-5 flex-shrink-0" />
  }
];

export default function Sidebar() {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();

  return (
    <AceternitySidebar open={open} setOpen={setOpen} animate>
      <SidebarBody className="justify-between gap-10 bg-beta-surface dark:bg-neutral-900">
        <div className="flex flex-col flex-1 overflow-y-auto overflow-x-hidden">
          <div className="mt-8 mb-2">
            <Link href="/" className="font-bold text-xl text-beta-navy dark:text-white">
              RushRank
            </Link>
          </div>
          <div className="mt-8 flex flex-col gap-2">
            {links.map((link) => {
              const isActive = pathname === link.href || (link.href !== "/" && pathname?.startsWith(link.href));
              return (
                <SidebarLink
                  key={link.href}
                  link={link}
                  className={cn(
                    "text-neutral-700 dark:text-neutral-300",
                    isActive && "bg-beta-navy/10 text-beta-navy dark:bg-beta-navy/20 dark:text-white font-semibold"
                  )}
                />
              );
            })}
          </div>
        </div>
      </SidebarBody>
    </AceternitySidebar>
  );
}

