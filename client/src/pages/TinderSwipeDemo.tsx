import * as React from "react";
import { SwipeableCardStack } from "@/components/ui/tinder-like-swipe";

export default function TinderSwipeDemo() {
	const demoProps = {
		images: [
			"https://images.unsplash.com/photo-1548199973-03cce0bbc87b?q=80&w=1170&auto=format&fit=crop",
			"https://images.unsplash.com/photo-1517849845537-4d257902454a?q=80&w=735&auto=format&fit=crop",
			"https://images.unsplash.com/photo-1552053831-71594a27632d?q=80&w=662&auto=format&fit=crop",
		],
		rightIcon:
			"https://uploads-ssl.webflow.com/6226162356726c4835057a73/6232367c3761286ddff6004c_icon-like.svg",
		leftIcon:
			"https://uploads-ssl.webflow.com/6226162356726c4835057a73/6232367c825de783a6697a3c_icon-dislike.svg",
		borderRadius: 20,
	};

	return (
		<div
			style={{
				display: "grid",
				placeItems: "center",
				width: "100vw",
				height: "100vh",
				background: "#e0e0e0",
			}}
		>
			<div style={{ width: "300px", height: "400px" }}>
				<SwipeableCardStack {...demoProps} />
			</div>
		</div>
	);
}


