"use client";
/**
 * React Query Provider for RushRank.
 * 
 * Wraps the application with QueryClientProvider and provides
 * default configuration for caching and refetching.
 */

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useState, ReactNode } from "react";

interface QueryProviderProps {
    children: ReactNode;
}

export function QueryProvider({ children }: QueryProviderProps) {
    // Create a client instance per session to avoid shared state between users
    const [queryClient] = useState(
        () =>
            new QueryClient({
                defaultOptions: {
                    queries: {
                        // Cache data for 5 minutes by default
                        staleTime: 5 * 60 * 1000,
                        // Keep unused data in cache for 10 minutes
                        gcTime: 10 * 60 * 1000,
                        // Retry failed requests once
                        retry: 1,
                        // Don't refetch on window focus in development
                        refetchOnWindowFocus: process.env.NODE_ENV === "production",
                    },
                    mutations: {
                        // Retry failed mutations once
                        retry: 1,
                    },
                },
            })
    );

    return (
        <QueryClientProvider client={queryClient}>
            {children}
        </QueryClientProvider>
    );
}
