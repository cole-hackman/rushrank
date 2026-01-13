import "./globals.css";
import type { Metadata } from "next";
import ToastProvider from "@/components/ToastProvider";
import GoogleFonts from "@/components/GoogleFonts";
import { QueryProvider } from "@/providers/QueryProvider";

export const metadata: Metadata = {
	title: "RushRank",
	description: "Digital rush voting platform",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
	return (
		<html lang="en">
			<body>
				<GoogleFonts />
				<QueryProvider>
					<ToastProvider>{children}</ToastProvider>
				</QueryProvider>
			</body>
		</html>
	);
}
