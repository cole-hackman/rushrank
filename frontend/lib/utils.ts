import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Format phone number as (XXX)-XXX-XXXX
 * Strips all non-digit characters and formats as user types
 */
export function formatPhoneNumber(value: string): string {
  // Remove all non-digit characters
  const digits = value.replace(/\D/g, "");
  
  // Format based on length
  if (digits.length === 0) return "";
  if (digits.length <= 3) return `(${digits}`;
  if (digits.length <= 6) return `(${digits.slice(0, 3)})-${digits.slice(3)}`;
  return `(${digits.slice(0, 3)})-${digits.slice(3, 6)}-${digits.slice(6, 10)}`;
}

/**
 * Download a file from a URL in a mobile Safari compatible way.
 * Fetches the file as a blob and triggers a download via anchor element.
 * This works around Safari's limitations with window.open after async operations.
 * 
 * @param url - The URL to download
 * @param filename - The suggested filename for the download
 * @param onError - Optional callback for handling errors
 */
export async function downloadFileForMobile(
  url: string, 
  filename: string,
  onError?: (error: Error) => void
): Promise<boolean> {
  try {
    // Fetch the file as a blob
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Failed to fetch file: ${response.statusText}`);
    }
    
    const blob = await response.blob();
    
    // Create a blob URL
    const blobUrl = URL.createObjectURL(blob);
    
    // Create an anchor element and trigger download
    const link = document.createElement("a");
    link.href = blobUrl;
    link.download = filename;
    link.style.display = "none";
    document.body.appendChild(link);
    link.click();
    
    // Clean up
    setTimeout(() => {
      document.body.removeChild(link);
      URL.revokeObjectURL(blobUrl);
    }, 100);
    
    return true;
  } catch (error) {
    console.error("Download failed:", error);
    if (onError && error instanceof Error) {
      onError(error);
    }
    return false;
  }
}

/**
 * Check if the current device is iOS (iPhone, iPad, iPod)
 */
export function isIOSDevice(): boolean {
  if (typeof navigator === "undefined") return false;
  return /iPhone|iPad|iPod/i.test(navigator.userAgent);
}
