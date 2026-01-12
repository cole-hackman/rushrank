"use client";
import Sidebar from "@/components/Sidebar";
import ProfileDropdown from "@/components/ProfileDropdown";
import Protected from "@/components/Protected";
import ToastProvider from "@/components/ToastProvider";
import { ThemeProvider } from "@/components/ThemeProvider";

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <Protected>
      <ThemeProvider>
        <ToastProvider>
          <div className="flex min-h-screen bg-beta-surface dark:bg-neutral-900">
            <Sidebar />
            <div className="flex-1 flex flex-col">
              <header className="h-14 border-b border-beta-gray/30 dark:border-neutral-700 flex items-center justify-end px-6 bg-white dark:bg-neutral-800">
                <ProfileDropdown />
              </header>
              <main className="flex-1 p-6 bg-beta-surface dark:bg-neutral-900">
                {children}
              </main>
            </div>
          </div>
        </ToastProvider>
      </ThemeProvider>
    </Protected>
  );
}

