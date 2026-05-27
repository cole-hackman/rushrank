import React from "react";
import { MarketingFooter } from "@/components/marketing/MarketingFooter";

export default function MarketingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen flex-col bg-bg">
      <main className="flex-1">{children}</main>
      <MarketingFooter />
    </div>
  );
}
