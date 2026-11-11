/**
 * Export utilities for CSV generation and downloads
 */
import { API_BASE } from "./api";
import { getAccessToken } from "./auth";

/**
 * Download CSV from API endpoint
 */
export async function downloadCSV(
  url: string,
  filename: string
): Promise<void> {
  try {
    const token = await getAccessToken();
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

/** A PNM as the roster and the /pnms endpoint describe it. */
export type ExportablePnm = {
  id: string;
  name: string;
  email?: string | null;
  phone?: string | null;
  major?: string | null;
  hometown?: string | null;
  year?: string | null;
  photo_url?: string | null;
  tags?: string[];
  attendance_count?: number;
  yes_percentage?: number;
  favorite_count?: number;
  gpa?: number | null;
  met_count?: number;
  archived?: boolean;
  created_at?: string | null;
};

const PNM_CSV_HEADERS = [
  "id", "name", "email", "phone", "major", "hometown", "year", "gpa", "tags",
  "attendance_count", "met_count", "yes_percentage", "favorite_count", "photo_url", "created_at",
];

function csvCell(value: unknown): string {
  return `"${String(value ?? "").replace(/"/g, '""')}"`;
}

/** The CSV text for a list of PNMs. Pure, so it can be tested. */
export function pnmsToCsv(pnms: ExportablePnm[]): string {
  const rows = pnms.map((p) => [
    p.id, p.name, p.email, p.phone, p.major, p.hometown, p.year,
    p.gpa ?? "", (p.tags || []).join(", "),
    p.attendance_count ?? 0, p.met_count ?? 0, p.yes_percentage ?? 0, p.favorite_count ?? 0,
    p.photo_url, p.created_at,
  ]);
  return [PNM_CSV_HEADERS.join(","), ...rows.map((r) => r.map(csvCell).join(","))].join("\n");
}

/** Save a list of PNMs the page already has as a CSV file. */
export function downloadPnmsCsv(pnms: ExportablePnm[], filename?: string): void {
  const blob = new Blob([pnmsToCsv(pnms)], { type: "text/csv;charset=utf-8;" });
  const downloadUrl = window.URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = downloadUrl;
  link.download = filename || `pnms_${new Date().toISOString().split("T")[0]}.csv`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  window.URL.revokeObjectURL(downloadUrl);
}

/**
 * The same filter the roster applies: text across name, major, hometown,
 * email and phone, and any of the chosen tags. Archived PNMs are left out.
 * Exported so the roster and this file cannot drift apart.
 */
export function filterPnms<T extends ExportablePnm>(
  pnms: T[],
  filters?: { search?: string; tags?: string[]; ids?: string[] },
): T[] {
  let out = pnms.filter((p) => !p.archived);
  if (filters?.ids && filters.ids.length > 0) {
    const wanted = new Set(filters.ids);
    out = out.filter((p) => wanted.has(p.id));
  }
  const term = (filters?.search || "").trim().toLowerCase();
  if (term) {
    out = out.filter((p) =>
      [p.name, p.major, p.hometown, p.email, p.phone].some((v) => (v || "").toLowerCase().includes(term)),
    );
  }
  if (filters?.tags && filters.tags.length > 0) {
    out = out.filter((p) => filters.tags!.some((t) => (p.tags || []).includes(t)));
  }
  return out;
}

/**
 * Export filtered PNMs.
 *
 * The backend's GET /pnms ignores search and tag parameters, so this used to
 * send them, get the whole roster back, and export everyone under a
 * "filtered" label. It now filters here, the same way the roster does.
 */
export async function exportFilteredPnms(
  chapterId: string,
  filters?: {
    search?: string;
    tags?: string[];
    ids?: string[];
  }
): Promise<number> {
  const token = await getAccessToken();
  const response = await fetch(`${API_BASE}/pnms?chapter_id=${encodeURIComponent(chapterId)}`, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
  if (!response.ok) {
    throw new Error(`Failed to fetch PNMs: ${response.statusText}`);
  }
  const pnms: ExportablePnm[] = await response.json();
  const chosen = filterPnms(pnms, filters);
  downloadPnmsCsv(chosen, `pnms_filtered_${new Date().toISOString().split("T")[0]}.csv`);
  return chosen.length;
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

