"use client";

import { useEffect } from "react";

export default function GoogleFonts() {
	useEffect(() => {
		// Check if fonts are already added
		const existingFonts = document.querySelectorAll('link[href*="fonts.googleapis.com"]');
		if (existingFonts.length > 0) return;

		// Create and append preconnect links
		const preconnect1 = document.createElement("link");
		preconnect1.rel = "preconnect";
		preconnect1.href = "https://fonts.googleapis.com";
		document.head.appendChild(preconnect1);

		const preconnect2 = document.createElement("link");
		preconnect2.rel = "preconnect";
		preconnect2.href = "https://fonts.gstatic.com";
		preconnect2.crossOrigin = "anonymous";
		document.head.appendChild(preconnect2);

		// Create and append font stylesheets
		const fonts = [
			"https://fonts.googleapis.com/css2?family=Work+Sans:wght@100;200;300;400;500;600;700;800;900&display=swap",
			"https://fonts.googleapis.com/css2?family=monospace:wght@100;200;300;400;500;600;700;800;900&display=swap",
			"https://fonts.googleapis.com/css2?family=Inter:wght@100;200;300;400;500;600;700;800;900&display=swap",
		];

		fonts.forEach((href) => {
			const link = document.createElement("link");
			link.href = href;
			link.rel = "stylesheet";
			document.head.appendChild(link);
		});
	}, []);

	return null;
}

