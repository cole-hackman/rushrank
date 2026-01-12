'use client'

import { Component as ProfileDropdown } from '@/components/ui/ui/profile-dropdown'
import { ThemeProvider } from '@/components/ThemeProvider'

export default function DemoPage() {
	return (
		<ThemeProvider>
			<div className="flex w-full h-screen justify-center items-center bg-neutral-50 dark:bg-neutral-900">
				<ProfileDropdown />
			</div>
		</ThemeProvider>
	)
}


