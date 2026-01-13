"use client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronUp, Settings, DoorOpen, User } from "lucide-react";
import { cn } from "@/lib/utils";
import { api } from "@/lib/api";

export default function ProfileDropdown() {
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState<string | null>(null);
  const [name, setName] = useState<string | null>(null);
  const router = useRouter();

  useEffect(() => {
    if (typeof window !== "undefined") {
      setEmail(localStorage.getItem("user_email"));
      setName(localStorage.getItem("user_name"));
    }
  }, []);

  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const profile = await api<{ memberships: Array<{ role: string }> }>("/me").catch(() => null);
        if (profile) {
          const hasAdminRole = profile.memberships?.some((m) => m.role === "admin" || m.role === "ADMIN");
          setIsAdmin(hasAdminRole || false);
        }
      } catch (e) {
        console.error("Failed to check admin status:", e);
      }
    })();
  }, []);

  const menuItems = [
    { 
      icon: <User className="w-5 h-5" />, 
      label: "Profile",
      onClick: () => router.push("/profile")
    },
    { 
      icon: <Settings className="w-5 h-5" />, 
      label: isAdmin ? "Admin Settings" : "Settings",
      onClick: () => router.push(isAdmin ? "/settings" : "/profile")
    },
    {
      icon: <DoorOpen className="w-5 h-5" />,
      label: "Sign out",
      danger: true,
      onClick: () => {
        localStorage.removeItem("access_token");
        localStorage.removeItem("user_email");
        localStorage.removeItem("user_name");
        window.location.href = "/login";
      }
    }
  ];

  const displayName = name || email?.split("@")[0] || "User";
  const initials = displayName.slice(0, 2).toUpperCase();

  return (
    <div className="relative">
      <motion.button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-2 rounded-xl px-3 py-2 text-sm hover:bg-beta-navy/5 dark:hover:bg-neutral-800 transition-colors focus:outline-none focus:ring-2 focus:ring-beta-navy"
        whileHover={{ scale: 1.02 }}
        whileTap={{ scale: 0.98 }}
      >
        <div className="w-8 h-8 rounded-full bg-beta-navy flex items-center justify-center text-white font-semibold text-xs">
          {initials}
        </div>
        <span className="hidden md:inline text-beta-navy dark:text-neutral-200">
          {displayName}
        </span>
        <motion.div
          animate={{ rotate: open ? 180 : 0 }}
          transition={{ duration: 0.2 }}
        >
          <ChevronUp className="w-4 h-4 text-neutral-500" />
        </motion.div>
      </motion.button>

      <AnimatePresence>
        {open && (
          <>
            <div 
              className="fixed inset-0 z-30" 
              onClick={() => setOpen(false)}
            />
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 10 }}
              transition={{ duration: 0.2 }}
              className="absolute right-0 mt-2 w-64 rounded-2xl bg-white dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 shadow-lg overflow-hidden z-40"
            >
              <div className="p-4 border-b border-beta-gray/30 dark:border-neutral-700">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-beta-navy flex items-center justify-center text-white font-semibold">
                    {initials}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-semibold text-neutral-900 dark:text-white truncate">
                      {displayName}
                    </div>
                    {email && (
                      <div className="text-xs text-neutral-500 dark:text-neutral-400 truncate">
                        {email}
                      </div>
                    )}
                  </div>
                </div>
              </div>

              <div className="p-2">
                {menuItems.map((item, index) => (
                  <motion.button
                    key={index}
                    onClick={() => {
                      setOpen(false);
                      item.onClick();
                    }}
                    className={cn(
                      "w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors",
                      item.danger
                        ? "text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20"
                        : "text-neutral-700 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-700"
                    )}
                    whileHover={{ x: 4 }}
                    whileTap={{ scale: 0.98 }}
                  >
                    {item.icon}
                    <span>{item.label}</span>
                  </motion.button>
                ))}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}

