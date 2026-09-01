import "./globals.css";
import type { Metadata, Viewport } from "next";
import { Work_Sans, Instrument_Serif } from "next/font/google";
import ToastProvider from "@/components/ToastProvider";
import { QueryProvider } from "@/providers/QueryProvider";

// Fonts used to be injected by a client-side useEffect that appended <link>
// tags to <head> after hydration, which guaranteed a flash of fallback type on
// every single page load. next/font inlines the @font-face at build time and
// self-hosts the files, so there is no third-party request and no flash.
const workSans = Work_Sans({
	subsets: ["latin"],
	display: "swap",
	variable: "--font-sans",
});

// `font-serif` was already in use on the marketing headings with no serif
// family defined anywhere, so it fell through to the browser default -- Times
// on most machines, next to a geometric sans. This is the family those
// headings were written for.
const instrumentSerif = Instrument_Serif({
	subsets: ["latin"],
	weight: "400",
	display: "swap",
	variable: "--font-serif",
});

export const metadata: Metadata = {
	title: "RushRank",
	description: "Digital rush voting platform",
};

export const viewport: Viewport = {
	width: "device-width",
	initialScale: 1,
	// maximumScale: 1 and userScalable: false were set here, which disables
	// pinch zoom across the whole app. That is an accessibility failure
	// anywhere, and this is a product used on phones, in dim rooms, by people
	// squinting at a PNM's face before voting on him.
	viewportFit: "cover",
};

// Runs before first paint. ThemeProvider reads localStorage in an effect, which
// means the correct theme is only applied after hydration -- so a dark-mode user
// got a white flash on every navigation. Inline and blocking is the standard
// fix and the only one that actually works.
const THEME_SCRIPT = `
(function () {
  try {
    var stored = localStorage.getItem('theme');
    var dark = stored === 'dark' ||
      ((!stored || stored === 'system') &&
        window.matchMedia('(prefers-color-scheme: dark)').matches);
    if (dark) document.documentElement.classList.add('dark');
  } catch (e) {
    /* private mode, storage disabled -- fall through to light */
  }
})();
`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
	return (
		<html lang="en" className={`${workSans.variable} ${instrumentSerif.variable}`}>
			<head>
				<script dangerouslySetInnerHTML={{ __html: THEME_SCRIPT }} />
			</head>
			<body>
				<QueryProvider>
					<ToastProvider>{children}</ToastProvider>
				</QueryProvider>
			</body>
		</html>
	);
}
