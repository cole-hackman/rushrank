/**
 * Export utilities for CSV generation and downloads
 */
import { API_BASE } from "./api";

/**
 * Download CSV from API endpoint
 */
export async function downloadCSV(
  url: string,
  filename: string
): Promise<void> {
  try {
    const token = typeof window !== "undefined" ? localStorage.getItem("access_token") : null;
    const response = await fetch(url, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });

    if (!response.ok) {
      throw new Error(`Export failed: ${response.statusText}`);
    }

    const blob = await response.blob();
    const downloadUrl = window.URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = downloadUrl;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    window.URL.revokeObjectURL(downloadUrl);
  } catch (error) {
    console.error("CSV download error:", error);
    throw error;
  }
}

/**
 * Export all PNMs for a chapter
 */
export async function exportAllPnms(chapterId: string): Promise<void> {
  const url = `${API_BASE}/export/csv?entity=pnms&chapter_id=${chapterId}`;
  await downloadCSV(url, `pnms_${chapterId}_${new Date().toISOString().split("T")[0]}.csv`);
}

/**
 * Export filtered PNMs (client-side CSV generation from filtered data)
 */
export async function exportFilteredPnms(
  chapterId: string,
  filters?: {
    search?: string;
    tags?: string[];
    ids?: string[];
  }
): Promise<void> {
  const token = typeof window !== "undefined" ? localStorage.getItem("access_token") : null;
  
  // Fetch filtered PNMs
  const params = new URLSearchParams();
  params.set("chapter_id", chapterId);
  if (filters?.search) {
    params.set("search", filters.search);
  }
  if (filters?.tags && filters.tags.length > 0) {
    params.set("tags", filters.tags.join(","));
  }
  
  const response = await fetch(`${API_BASE}/pnms?${params.toString()}`, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
  
  if (!response.ok) {
    throw new Error(`Failed to fetch PNMs: ${response.statusText}`);
  }
  
  const pnms = await response.json();
  
  // Filter by IDs if provided
  let filteredPnms = pnms;
  if (filters?.ids && filters.ids.length > 0) {
    filteredPnms = pnms.filter((p: any) => filters.ids!.includes(p.id));
  }
  
  // Generate CSV client-side
  const headers = [
    "id", "name", "email", "phone", "major", "hometown", "year", "photo_url", 
    "tags", "attendance_count", "yes_percentage", "favorite_count", "created_at"
  ];
  
  const rows = filteredPnms.map((p: any) => [
    p.id || "",
    p.name || "",
    p.email || "",
    p.phone || "",
    p.major || "",
    p.hometown || "",
    p.year || "",
    p.photo_url || "",
    (p.tags || []).join(","),
    p.attendance_count || 0,
    p.yes_percentage || 0,
    p.favorite_count || 0,
    p.created_at || "",
  ]);
  
  const csvContent = [
    headers.join(","),
    ...rows.map((row: any[]) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(",")),
  ].join("\n");
  
  const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
  const downloadUrl = window.URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = downloadUrl;
  link.download = `pnms_filtered_${new Date().toISOString().split("T")[0]}.csv`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  window.URL.revokeObjectURL(downloadUrl);
}

/**
 * Export round results
 */
export async function exportRoundResults(roundId: string): Promise<void> {
  const url = `${API_BASE}/export/csv?entity=results&roundId=${roundId}`;
  await downloadCSV(url, `results_${roundId}_${new Date().toISOString().split("T")[0]}.csv`);
}

/**
 * Export event attendance (client-side CSV generation)
 */
export async function exportEventAttendance(
  eventId: string,
  attendance: Array<{
    pnm_name: string;
    checked_in_at: string | null;
    notes?: string | null;
  }>
): Promise<void> {
  // Generate CSV client-side
  const headers = ["PNM Name", "Checked In At", "Notes"];
  const rows = attendance.map((a) => [
    a.pnm_name || "",
    a.checked_in_at ? new Date(a.checked_in_at).toLocaleString() : "",
    a.notes || "",
  ]);

  const csvContent = [
    headers.join(","),
    ...rows.map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(",")),
  ].join("\n");

  const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
  const downloadUrl = window.URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = downloadUrl;
  link.download = `event_attendance_${eventId}_${new Date().toISOString().split("T")[0]}.csv`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  window.URL.revokeObjectURL(downloadUrl);
}

